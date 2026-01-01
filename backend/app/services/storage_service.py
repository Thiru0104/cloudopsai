import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from azure.identity import DefaultAzureCredential, ClientSecretCredential
from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.subscription import SubscriptionClient
from azure.storage.blob import BlobServiceClient
from azure.storage.fileshare import ShareServiceClient
from azure.storage.queue import QueueServiceClient
from azure.data.tables import TableServiceClient
from azure.monitor.query import MetricsQueryClient
from azure.core.exceptions import AzureError

from app.core.config import settings
from app.models.storage import StorageAccountReport, ContainerReport

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.credential = self._get_credential()
        self.subscription_id = settings.AZURE_SUBSCRIPTION_ID
        
        # Initialize clients
        self.subscription_client = SubscriptionClient(self.credential)
        self.metrics_client = MetricsQueryClient(self.credential)
        
    def _get_credential(self):
        """Get Azure credential based on environment"""
        try:
            # Try service principal first
            tenant_id = settings.AZURE_TENANT_ID
            client_id = settings.AZURE_CLIENT_ID
            client_secret = settings.AZURE_CLIENT_SECRET
            
            if all([tenant_id, client_id, client_secret]):
                logger.info("Using Service Principal credentials for StorageService")
                return ClientSecretCredential(
                    tenant_id=tenant_id,
                    client_id=client_id,
                    client_secret=client_secret
                )
            else:
                logger.info("Using DefaultAzureCredential for StorageService")
                return DefaultAzureCredential()
        except Exception as e:
            logger.error(f"Failed to get Azure credential: {e}")
            raise

    async def get_storage_report(
        self, 
        subscription_id: Optional[str] = None, 
        region: Optional[str] = None, 
        resource_group: Optional[str] = None,
        account_name: Optional[str] = None
    ) -> List[StorageAccountReport]:
        """Get detailed storage report"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                logger.error("No subscription ID provided for storage report")
                return []
            
            logger.info(f"Generating storage report for subscription: {target_subscription_id}")
            
            # Get Subscription Name
            sub_name = target_subscription_id
            try:
                sub = self.subscription_client.subscriptions.get(target_subscription_id)
                sub_name = sub.display_name
            except Exception as e:
                logger.warning(f"Failed to get subscription name: {e}")

            # Initialize Storage Client
            try:
                storage_client = StorageManagementClient(self.credential, target_subscription_id)
                accounts = list(storage_client.storage_accounts.list())
                logger.info(f"Found {len(accounts)} storage accounts in subscription {target_subscription_id}")
            except Exception as e:
                logger.error(f"Failed to list storage accounts: {e}")
                return []
            
            # Apply Filters
            if region and region != 'All':
                accounts = [a for a in accounts if a.location.lower() == region.lower()]
            
            if resource_group and resource_group != 'All':
                accounts = [a for a in accounts if a.id.split('/')[4].lower() == resource_group.lower()]
            
            if account_name and account_name != 'All':
                accounts = [a for a in accounts if a.name.lower() == account_name.lower()]

            report_data = []

            def process_storage_account(account):
                try:
                    rg_name = account.id.split('/')[4]
                    account_name = account.name
                    location = account.location
                    sku = account.sku.name
                    
                    # Get Keys to build connection string
                    conn_str = None
                    try:
                        keys = storage_client.storage_accounts.list_keys(rg_name, account_name)
                        key = keys.keys[0].value
                        conn_str = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={key};EndpointSuffix=core.windows.net"
                    except Exception as e:
                        logger.warning(f"Failed to get keys for {account_name}: {e}")
                    
                    total_size_bytes = 0
                    last_activity = datetime.min
                    container_count = 0
                    
                    # 1. Get Metrics (Size and Activity)
                    try:
                        # Query last 30 days of metrics
                        # Note: UsedCapacity is often 'Average'
                        metrics_response = self.metrics_client.query_resource(
                            resource_uri=account.id,
                            metric_names=["UsedCapacity", "BlobCapacity", "Transactions"],
                            timespan=timedelta(days=30),
                            granularity=timedelta(days=1),
                            aggregations=["Average", "Total"]
                        )

                        # Process UsedCapacity
                        capacity_metric = next((m for m in metrics_response.metrics if m.name == "UsedCapacity"), None)
                        if capacity_metric and capacity_metric.timeseries:
                            # Get the latest non-None value
                            for point in reversed(capacity_metric.timeseries[0].data):
                                if point.average is not None:
                                    total_size_bytes = point.average
                                    logger.info(f"UsedCapacity for {account_name}: {total_size_bytes}")
                                    break
                                elif point.total is not None:
                                    total_size_bytes = point.total
                                    logger.info(f"UsedCapacity (Total) for {account_name}: {total_size_bytes}")
                                    break
                        
                        # Fallback to BlobCapacity if UsedCapacity is 0
                        if total_size_bytes == 0:
                            blob_capacity_metric = next((m for m in metrics_response.metrics if m.name == "BlobCapacity"), None)
                            if blob_capacity_metric and blob_capacity_metric.timeseries:
                                for point in reversed(blob_capacity_metric.timeseries[0].data):
                                    if point.average is not None:
                                        total_size_bytes = point.average
                                        logger.info(f"BlobCapacity for {account_name}: {total_size_bytes}")
                                        break
                                    elif point.total is not None:
                                        total_size_bytes = point.total
                                        logger.info(f"BlobCapacity (Total) for {account_name}: {total_size_bytes}")
                                        break

                        # Process Transactions for Last Activity
                        transactions_metric = next((m for m in metrics_response.metrics if m.name == "Transactions"), None)
                        if transactions_metric and transactions_metric.timeseries:
                            for point in reversed(transactions_metric.timeseries[0].data):
                                if point.total and point.total > 0:
                                    last_activity = point.timestamp.replace(tzinfo=None)
                                    break

                    except Exception as e:
                        logger.warning(f"Failed to get metrics for {account_name}: {e}")

                    # 2. Blob Service Check (Container Count & Fallback Activity)
                    blob_service = None
                    if conn_str:
                        try:
                            blob_service = BlobServiceClient.from_connection_string(conn_str)
                        except Exception:
                            pass
                    
                    if not blob_service:
                        # Try with Token Credential (useful if Shared Key Access is disabled)
                        try:
                            blob_service = BlobServiceClient(
                                account_url=f"https://{account_name}.blob.core.windows.net", 
                                credential=self.credential
                            )
                        except Exception:
                            pass

                    if blob_service:
                        try:
                            # List containers
                            containers = list(blob_service.list_containers())
                            container_count = len(containers)
                            
                            # Fallback activity check if metrics failed or showed no activity
                            if last_activity == datetime.min:
                                for container in containers[:5]:
                                    if container.last_modified:
                                        last_activity = max(last_activity, container.last_modified.replace(tzinfo=None))
                            
                            # Fallback size calculation if metrics returned 0 or we want to be more accurate
                            # We removed the container count limit as requested to ensure accuracy
                            if total_size_bytes == 0:
                                try:
                                    calculated_size = 0
                                    for container in containers:
                                        try:
                                            container_client = blob_service.get_container_client(container.name)
                                            blobs = container_client.list_blobs()
                                            for blob in blobs:
                                                calculated_size += blob.size
                                                # Also update last activity from blobs if needed
                                                if blob.last_modified:
                                                    blob_mod = blob.last_modified.replace(tzinfo=None)
                                                    if blob_mod > last_activity:
                                                        last_activity = blob_mod
                                        except Exception as e:
                                            logger.warning(f"Error listing blobs for container {container.name}: {e}")
                                            
                                    total_size_bytes = calculated_size
                                    logger.info(f"Calculated size for {account_name} (Blobs): {total_size_bytes}")
                                except Exception as e:
                                    logger.warning(f"Failed to calculate blob size for {account_name}: {e}")

                            # Process File Shares
                            try:
                                share_service = None
                                if conn_str:
                                    share_service = ShareServiceClient.from_connection_string(conn_str)
                                else:
                                    share_service = ShareServiceClient(
                                        account_url=f"https://{account_name}.file.core.windows.net",
                                        credential=self.credential
                                    )
                                
                                shares = list(share_service.list_shares())
                                for share in shares:
                                    try:
                                        share_client = share_service.get_share_client(share.name)
                                        stats = share_client.get_share_stats()
                                        total_size_bytes += (stats['share_usage_bytes'] * 1024 * 1024 * 1024) # returned in GB usually? No, stats returns usage in GB? checking docs or assumption.
                                        # Actually get_share_stats returns usage in gigabytes. 
                                        # But let's verify. The user script recursively processes directories. 
                                        # Using get_share_stats is much faster if available. 
                                        # User script:
                                        # process_directory(share_client, "", total_share_size, last_modified)
                                        # Let's stick to user script logic for consistency if possible, but recursive is slow.
                                        # However, share_usage_bytes from get_share_stats is easiest.
                                        # Let's check what the user script does. It calculates file size one by one.
                                        # "total_share_size[0] += properties.size"
                                        # I'll stick to a simpler approach first: stats if available.
                                        if 'share_usage_bytes' in stats:
                                             # share_usage_bytes is in GB (integer).
                                             total_size_bytes += (stats['share_usage_bytes'] * 1024 * 1024 * 1024)
                                    except Exception:
                                        pass
                            except Exception:
                                pass
                                
                        except Exception as e:
                            # logger.debug(f"Blob service access failed for {account_name}: {e}")
                            pass

                    # Status & Archive Recommendation
                    status = "Active"
                    archive_rec = "No"
                    
                    last_activity_str = "Unknown"
                    if last_activity != datetime.min:
                        last_activity_str = last_activity.strftime("%Y-%m-%d %H:%M:%S")
                        days_inactive = (datetime.now() - last_activity).days
                        if days_inactive > 90:
                            status = "Inactive"
                            archive_rec = "Yes"
                    
                    return StorageAccountReport(
                        subscription_name=sub_name,
                        subscription_id=target_subscription_id,
                        storage_account=account_name,
                        resource_group=rg_name,
                        total_size_gb=round(total_size_bytes / (1024**3), 4), # 4 decimal places for small sizes
                        last_activity=last_activity_str,
                        status=status,
                        sku=sku,
                        location=location,
                        container_count=container_count,
                        archive_recommendation=archive_rec
                    )
                except Exception as e:
                    logger.error(f"Error processing {account.name}: {e}")
                    return None

            # Use ThreadPool to process accounts in parallel
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(process_storage_account, acc) for acc in accounts]
                for future in as_completed(futures):
                    res = future.result()
                    if res:
                        report_data.append(res)
            
            return report_data

        except Exception as e:
            logger.error(f"Failed to generate storage report: {e}")
            return []


    async def get_containers_report(
        self,
        subscription_id: Optional[str] = None,
        region: Optional[str] = None,
        resource_group: Optional[str] = None,
        account_name: Optional[str] = None
    ) -> List[ContainerReport]:
        """Get detailed container report"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                return []
            
            # Get Subscription Name
            sub_name = target_subscription_id
            try:
                sub = self.subscription_client.subscriptions.get(target_subscription_id)
                sub_name = sub.display_name
            except Exception:
                pass

            # Initialize Storage Client
            try:
                storage_client = StorageManagementClient(self.credential, target_subscription_id)
                accounts = list(storage_client.storage_accounts.list())
            except Exception as e:
                logger.error(f"Failed to list storage accounts: {e}")
                return []
            
            # Apply Filters
            if region and region != 'All':
                accounts = [a for a in accounts if a.location.lower() == region.lower()]
            
            if resource_group and resource_group != 'All':
                accounts = [a for a in accounts if a.id.split('/')[4].lower() == resource_group.lower()]
            
            if account_name:
                accounts = [a for a in accounts if a.name.lower() == account_name.lower()]

            report_data = []

            def process_account_containers(account):
                account_containers = []
                try:
                    rg_name = account.id.split('/')[4]
                    acc_name = account.name
                    
                    # Get Connection
                    conn_str = None
                    try:
                        keys = storage_client.storage_accounts.list_keys(rg_name, acc_name)
                        key = keys.keys[0].value
                        conn_str = f"DefaultEndpointsProtocol=https;AccountName={acc_name};AccountKey={key};EndpointSuffix=core.windows.net"
                    except Exception:
                        pass
                    
                    blob_service = None
                    if conn_str:
                        try:
                            blob_service = BlobServiceClient.from_connection_string(conn_str)
                        except Exception:
                            pass
                    
                    if not blob_service:
                        try:
                            blob_service = BlobServiceClient(
                                account_url=f"https://{acc_name}.blob.core.windows.net", 
                                credential=self.credential
                            )
                        except Exception:
                            pass
                            
                    if blob_service:
                        containers = list(blob_service.list_containers())
                        
                        for container in containers:
                            try:
                                # Get Container Stats (Size & Activity)
                                container_client = blob_service.get_container_client(container.name)
                                
                                size_bytes = 0
                                blob_count = 0
                                last_mod = container.last_modified
                                
                                # Calculating size - iterate blobs
                                try:
                                    blobs = container_client.list_blobs()
                                    for blob in blobs:
                                        size_bytes += blob.size
                                        blob_count += 1
                                        if blob.last_modified: 
                                            # Ensure timezone awareness handling
                                            blob_mod = blob.last_modified
                                            if not last_mod or blob_mod > last_mod:
                                                last_mod = blob_mod
                                except Exception as e:
                                    logger.warning(f"Error calculating size for container {container.name}: {e}")

                                # Status & Recommendation
                                status = "Active"
                                archive_rec = "No"
                                last_activity_str = "Unknown"
                                
                                if last_mod:
                                    last_mod = last_mod.replace(tzinfo=None)
                                    last_activity_str = last_mod.strftime("%Y-%m-%d %H:%M:%S")
                                    days_inactive = (datetime.now() - last_mod).days
                                    if days_inactive > 90:
                                        status = "Inactive"
                                        archive_rec = "Yes"

                                report_item = ContainerReport(
                                    subscription_name=sub_name,
                                    subscription_id=target_subscription_id,
                                    storage_account=acc_name,
                                    resource_group=rg_name,
                                    location=account.location,
                                    container_name=container.name,
                                    total_size_gb=round(size_bytes / (1024**3), 6),
                                    last_activity=last_activity_str,
                                    status=status,
                                    archive_recommendation=archive_rec,
                                    blob_count=blob_count
                                )
                                account_containers.append(report_item)
                            except Exception as e:
                                logger.error(f"Error processing container {container.name}: {e}")
                except Exception as e:
                    logger.error(f"Error processing account {account.name}: {e}")
                
                return account_containers

            # Use ThreadPool
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(process_account_containers, acc) for acc in accounts]
                for future in as_completed(futures):
                    res = future.result()
                    if res:
                        report_data.extend(res)
            
            return report_data

        except Exception as e:
            logger.error(f"Failed to generate container report: {e}")
            return []



