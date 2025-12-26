import os
import json
import csv
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from azure.identity import DefaultAzureCredential, ClientSecretCredential
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.subscription import SubscriptionClient
from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.web import WebSiteManagementClient
from azure.mgmt.keyvault import KeyVaultManagementClient
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from azure.storage.fileshare import ShareServiceClient
from azure.storage.queue import QueueServiceClient
from azure.data.tables import TableServiceClient
from azure.monitor.query import LogsQueryClient, LogsQueryStatus
from azure.core.exceptions import AzureError
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

class AzureService:
    def __init__(self):
        self.subscription_id = settings.AZURE_SUBSCRIPTION_ID
        self.storage_connection_string = settings.AZURE_STORAGE_CONNECTION_STRING
        self.storage_account_name = getattr(settings, 'AZURE_STORAGE_ACCOUNT_NAME', None)
        self.storage_account_key = getattr(settings, 'AZURE_STORAGE_ACCOUNT_KEY', None)
        
        # Initialize credential first
        self.credential = self._get_credential()
        
        # Initialize subscription client (doesn't need subscription_id)
        self.subscription_client = SubscriptionClient(self.credential)

        # Initialize Logs Query Client
        try:
            self.logs_query_client = LogsQueryClient(self.credential)
        except Exception as e:
            logger.error(f"Failed to initialize LogsQueryClient: {e}")
            self.logs_query_client = None
        
        # Initialize clients only if subscription_id is available
        if self.subscription_id:
            self.network_client = NetworkManagementClient(self.credential, self.subscription_id)
            self.resource_client = ResourceManagementClient(self.credential, self.subscription_id)
            self.storage_client = StorageManagementClient(self.credential, self.subscription_id)
            self.compute_client = ComputeManagementClient(self.credential, self.subscription_id)
            self.web_client = WebSiteManagementClient(self.credential, self.subscription_id)
            self.keyvault_client = KeyVaultManagementClient(self.credential, self.subscription_id)
            self.blob_service_client = self._get_blob_service_client()
        else:
            logger.warning("Azure subscription ID not found. Some Azure services will not be available.")
            self.network_client = None
            self.resource_client = None
            self.storage_client = None
            self.compute_client = None
            self.web_client = None
            self.keyvault_client = None
            self.blob_service_client = None
    
    def _get_credential(self):
        """Get Azure credential based on environment"""
        try:
            # Try service principal first
            tenant_id = settings.AZURE_TENANT_ID
            client_id = settings.AZURE_CLIENT_ID
            client_secret = settings.AZURE_CLIENT_SECRET
            
            if all([tenant_id, client_id, client_secret]):
                return ClientSecretCredential(
                    tenant_id=tenant_id,
                    client_id=client_id,
                    client_secret=client_secret
                )
            else:
                # Fall back to default credential
                return DefaultAzureCredential()
        except Exception as e:
            logger.error(f"Failed to get Azure credential: {e}")
            raise
    
    def _get_blob_service_client(self):
        """Get blob service client"""
        try:
            if self.storage_connection_string:
                return BlobServiceClient.from_connection_string(self.storage_connection_string)
            elif self.storage_account_name and self.storage_account_key:
                account_url = f"https://{self.storage_account_name}.blob.core.windows.net"
                return BlobServiceClient(account_url=account_url, credential=self.storage_account_key)
            else:
                logger.warning("No storage credentials provided, blob operations will be disabled")
                return None
        except Exception as e:
            logger.error(f"Failed to get blob service client: {e}")
            return None
    
    def get_blob_service_client_for_account(self, storage_account_name: str) -> Optional[BlobServiceClient]:
        """Get blob service client for a specific storage account"""
        try:
            # If requesting the default account and we have connection string, use existing client
            if self.storage_account_name and storage_account_name.lower() == self.storage_account_name.lower():
                 if self.blob_service_client:
                    return self.blob_service_client
            
            # Otherwise, create client using credential (assuming it has access)
            account_url = f"https://{storage_account_name}.blob.core.windows.net"
            return BlobServiceClient(account_url=account_url, credential=self.credential)
        except Exception as e:
            logger.error(f"Failed to get blob service client for {storage_account_name}: {e}")
            return None

    async def get_recent_incidents(self, subscription_id: str, time_range: str = "24h") -> List[Dict]:
        """
        Get recent incidents from Azure Activity Log using KQL.
        """
        if not self.logs_query_client:
            logger.warning("LogsQueryClient is not initialized")
            return []
            
        try:
            # Map time range to KQL timespan
            timespan_map = {
                "24h": "24h",
                "7d": "7d",
                "30d": "30d"
            }
            timespan_str = timespan_map.get(time_range, "24h")
            timespan_delta = timedelta(hours=24)
            if time_range == "7d":
                timespan_delta = timedelta(days=7)
            elif time_range == "30d":
                timespan_delta = timedelta(days=30)
            
            query = f"""
            AzureActivity
            | where TimeGenerated > ago({timespan_str})
            | where Level == 'Error' or Level == 'Warning' or Level == 'Critical'
            | project TimeGenerated, ResourceId, Level, OperationName, Caller, ResourceGroup, ResourceProvider
            | order by TimeGenerated desc
            | take 50
            """
            
            logger.info(f"Querying Activity Logs for subscription {subscription_id} with range {time_range}")
            
            # Query the subscription resource directly for Activity Logs
            # Note: query_resource takes resource_id. For Activity Log, we target the subscription ID.
            response = await asyncio.to_thread(
                self.logs_query_client.query_resource,
                resource_id=f"/subscriptions/{subscription_id}",
                query=query,
                timespan=timespan_delta
            )
            
            if response.status == LogsQueryStatus.PARTIAL:
                error = response.partial_error
                data = response.tables
                logger.warning(f"Partial success for KQL query: {error}")
            elif response.status == LogsQueryStatus.FAILURE:
                logger.error(f"KQL query failed: {response}")
                return []
            else:
                data = response.tables

            incidents = []
            if data:
                for table in data:
                    # Get column indices
                    col_map = {}
                    for idx, col in enumerate(table.columns):
                        if hasattr(col, 'name'):
                            col_map[col.name] = idx
                        else:
                            col_map[str(col)] = idx
                    
                    for row in table.rows:
                        incidents.append({
                            "timestamp": row[col_map["TimeGenerated"]].isoformat() if row[col_map["TimeGenerated"]] else None,
                            "resource_id": row[col_map["ResourceId"]],
                            "level": row[col_map["Level"]],
                            "operation": row[col_map["OperationName"]],
                            "caller": row[col_map["Caller"]],
                            "resource_group": row[col_map["ResourceGroup"]],
                            "resource_provider": row[col_map["ResourceProvider"]]
                        })
            
            logger.info(f"Found {len(incidents)} incidents")
            return incidents

        except Exception as e:
            logger.error(f"Failed to query Azure Activity Logs: {e}")
            return []

    async def get_incidents_timeline(self, subscription_id: str, time_range: str = "24h") -> List[Dict]:
        """
        Get incident timeline data for chart.
        """
        if not self.logs_query_client:
            return []
            
        try:
            timespan_map = {
                "24h": "24h",
                "7d": "7d",
                "30d": "30d"
            }
            timespan_str = timespan_map.get(time_range, "24h")
            timespan_delta = timedelta(hours=24)
            if time_range == "7d":
                timespan_delta = timedelta(days=7)
            elif time_range == "30d":
                timespan_delta = timedelta(days=30)
                
            # Determine bin size based on range
            bin_size = "1h"
            if time_range == "7d":
                bin_size = "6h"
            elif time_range == "30d":
                bin_size = "1d"
            
            query = f"""
            AzureActivity
            | where TimeGenerated > ago({timespan_str})
            | where Level == 'Error' or Level == 'Warning' or Level == 'Critical'
            | summarize Count=count() by bin(TimeGenerated, {bin_size}), Level
            | order by TimeGenerated asc
            """
            
            response = await asyncio.to_thread(
                self.logs_query_client.query_resource,
                resource_id=f"/subscriptions/{subscription_id}",
                query=query,
                timespan=timespan_delta
            )
            
            if response.status == LogsQueryStatus.FAILURE:
                return []
                
            data = response.tables
            timeline = []
            
            if data:
                for table in data:
                    col_map = {}
                    for idx, col in enumerate(table.columns):
                        if hasattr(col, 'name'):
                            col_map[col.name] = idx
                        else:
                            col_map[str(col)] = idx
                            
                    for row in table.rows:
                        # Find existing bucket or create new
                        timestamp = row[col_map["TimeGenerated"]].isoformat() if row[col_map["TimeGenerated"]] else None
                        level = row[col_map["Level"]]
                        count = row[col_map["Count"]]
                        
                        # We want a format like {timestamp: '...', error: 5, warning: 2}
                        found = False
                        for item in timeline:
                            if item["timestamp"] == timestamp:
                                item[level.lower()] = count
                                found = True
                                break
                        
                        if not found:
                            entry = {"timestamp": timestamp}
                            entry[level.lower()] = count
                            timeline.append(entry)
            
            return timeline
        except Exception as e:
            logger.error(f"Failed to get incidents timeline: {e}")
            return []

    # Subscription Management Methods
    async def list_subscriptions(self) -> List[Dict]:
        """List all available subscriptions"""
        return await asyncio.to_thread(self._list_subscriptions_sync)

    def _list_subscriptions_sync(self) -> List[Dict]:
        try:
            subscriptions = []
            try:
                for subscription in self.subscription_client.subscriptions.list():
                    subscriptions.append({
                        "id": subscription.subscription_id,
                        "display_name": subscription.display_name,
                        "state": subscription.state.value if hasattr(subscription.state, 'value') else str(subscription.state) if subscription.state else "Unknown",
                        "tenant_id": getattr(subscription, 'tenant_id', settings.AZURE_TENANT_ID)
                    })
            except Exception as e:
                logger.warning(f"Failed to list subscriptions via client: {e}")

            # Ensure the subscription from .env is included if list is empty or missed it
            env_sub_id = settings.AZURE_SUBSCRIPTION_ID
            if env_sub_id and not any(s['id'] == env_sub_id for s in subscriptions):
                try:
                    # Try to get details for the specific subscription from env
                    sub_details = self.subscription_client.subscriptions.get(env_sub_id)
                    subscriptions.append({
                        "id": sub_details.subscription_id,
                        "display_name": sub_details.display_name,
                        "state": sub_details.state.value if hasattr(sub_details.state, 'value') else str(sub_details.state) if sub_details.state else "Unknown",
                        "tenant_id": getattr(sub_details, 'tenant_id', settings.AZURE_TENANT_ID)
                    })
                except Exception as e:
                    logger.warning(f"Failed to get details for env subscription: {e}")
                    # Fallback if we can't fetch details but have the ID
                    subscriptions.append({
                        "id": env_sub_id,
                        "display_name": f"Subscription ({env_sub_id})",
                        "state": "Enabled", # Assume enabled if manually configured
                        "tenant_id": settings.AZURE_TENANT_ID
                    })
            
            return subscriptions
        except Exception as e:
            logger.error(f"Failed to list subscriptions: {e}")
            # Fallback to env subscription if everything fails
            if settings.AZURE_SUBSCRIPTION_ID:
                return [{
                    "id": settings.AZURE_SUBSCRIPTION_ID,
                    "display_name": f"Subscription ({settings.AZURE_SUBSCRIPTION_ID})",
                    "state": "Enabled",
                    "tenant_id": settings.AZURE_TENANT_ID
                }]
            raise
    
    async def list_resource_groups(self, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all resource groups in a subscription"""
        return await asyncio.to_thread(self._list_resource_groups_sync, subscription_id)

    def _list_resource_groups_sync(self, subscription_id: Optional[str] = None) -> List[Dict]:
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            # Re-create client for target subscription if needed, or use existing if matches
            if target_subscription_id == self.subscription_id and self.resource_client:
                resource_client = self.resource_client
            else:
                resource_client = ResourceManagementClient(self.credential, target_subscription_id)
            
            resource_groups = []
            
            for rg in resource_client.resource_groups.list():
                resource_groups.append({
                    "name": rg.name,
                    "location": rg.location,
                    "id": rg.id,
                    "subscription_id": target_subscription_id,
                    "provisioning_state": rg.properties.provisioning_state if rg.properties else "Unknown",
                    "tags": rg.tags or {}
                })
            
            return resource_groups
        except Exception as e:
            logger.error(f"Failed to list resource groups: {e}")
            raise
    
    async def list_locations(self, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all available Azure locations/regions for a subscription"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            # Use subscription client to get locations
            locations = []
            for location in self.subscription_client.subscriptions.list_locations(target_subscription_id):
                locations.append({
                    "name": location.name,
                    "display_name": location.display_name,
                    "latitude": location.latitude,
                    "longitude": location.longitude,
                    "subscription_id": target_subscription_id
                })
            
            return locations
        except Exception as e:
            logger.error(f"Failed to list locations: {e}")
            raise
    
    # NSG Management Methods
    async def list_nsgs(self, resource_group: Optional[str] = None, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all NSGs in subscription or specific resource group"""
        try:
            # Use provided subscription_id or fall back to default
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            # Create network client for the target subscription
            network_client = NetworkManagementClient(self.credential, target_subscription_id)
            
            nsgs = []
            if resource_group:
                nsg_list = network_client.network_security_groups.list(resource_group)
            else:
                nsg_list = network_client.network_security_groups.list_all()
            
            for nsg in nsg_list:
                nsg_data = {
                    "id": nsg.id,
                    "name": nsg.name,
                    "location": nsg.location,
                    "resource_group": nsg.id.split('/')[4],
                    "subscription_id": target_subscription_id,
                    "provisioning_state": nsg.provisioning_state,
                    "etag": nsg.etag,
                    "tags": nsg.tags or {},
                    "inbound_rules": [],
                    "outbound_rules": [],
                    "network_interfaces": [],
                    "subnets": []
                }
                
                # Extract security rules - filter by direction
                if nsg.security_rules:
                    # Separate inbound and outbound rules based on direction
                    inbound_rules = [rule for rule in nsg.security_rules if rule.direction == 'Inbound']
                    outbound_rules = [rule for rule in nsg.security_rules if rule.direction == 'Outbound']
                    
                    nsg_data["inbound_rules"] = [
                        {
                            "id": rule.id,
                            "name": rule.name,
                            "priority": rule.priority,
                            "direction": rule.direction,
                            "access": rule.access,
                            "protocol": rule.protocol,
                            "source_port_range": rule.source_port_range,
                            "destination_port_range": rule.destination_port_range,
                            "source_address_prefix": getattr(rule, "source_address_prefix", None),
                            "destination_address_prefix": getattr(rule, "destination_address_prefix", None),
                            "source_address_prefixes": getattr(rule, "source_address_prefixes", None) or [],
                            "destination_address_prefixes": getattr(rule, "destination_address_prefixes", None) or [],
                            "provisioning_state": rule.provisioning_state
                        }
                        for rule in inbound_rules
                    ]
                    
                    nsg_data["outbound_rules"] = [
                        {
                            "id": rule.id,
                            "name": rule.name,
                            "priority": rule.priority,
                            "direction": rule.direction,
                            "access": rule.access,
                            "protocol": rule.protocol,
                            "source_port_range": rule.source_port_range,
                            "destination_port_range": rule.destination_port_range,
                            "source_address_prefix": getattr(rule, "source_address_prefix", None),
                            "destination_address_prefix": getattr(rule, "destination_address_prefix", None),
                            "source_address_prefixes": getattr(rule, "source_address_prefixes", None) or [],
                            "destination_address_prefixes": getattr(rule, "destination_address_prefixes", None) or [],
                            "provisioning_state": rule.provisioning_state
                        }
                        for rule in outbound_rules
                    ]
                
                nsgs.append(nsg_data)
            
            return nsgs
        except AzureError as e:
            logger.error(f"Failed to list NSGs: {e}")
            raise
    
    async def get_nsg(self, resource_group: str, nsg_name: str) -> Optional[Dict]:
        """Get specific NSG details"""
        return await asyncio.to_thread(self._get_nsg_sync, resource_group, nsg_name)

    def _get_nsg_sync(self, resource_group: str, nsg_name: str) -> Optional[Dict]:
        try:
            nsg = self.network_client.network_security_groups.get(resource_group, nsg_name)
            return {
                "id": nsg.id,
                "name": nsg.name,
                "location": nsg.location,
                "resource_group": resource_group,
                "subscription_id": self.subscription_id,
                "provisioning_state": nsg.provisioning_state,
                "etag": nsg.etag,
                "tags": nsg.tags or {},
                "inbound_rules": [
                    {
                        "id": rule.id,
                        "name": rule.name,
                        "priority": rule.priority,
                        "direction": rule.direction,
                        "access": rule.access,
                        "protocol": rule.protocol,
                        "source_port_range": rule.source_port_range,
                        "destination_port_range": rule.destination_port_range,
                        "source_address_prefix": getattr(rule, "source_address_prefix", None),
                        "destination_address_prefix": getattr(rule, "destination_address_prefix", None),
                        "source_address_prefixes": getattr(rule, "source_address_prefixes", None) or [],
                        "destination_address_prefixes": getattr(rule, "destination_address_prefixes", None) or [],
                        "provisioning_state": rule.provisioning_state
                    }
                    for rule in (nsg.security_rules or []) if rule.direction == 'Inbound'
                ],
                "outbound_rules": [
                    {
                        "id": rule.id,
                        "name": rule.name,
                        "priority": rule.priority,
                        "direction": rule.direction,
                        "access": rule.access,
                        "protocol": rule.protocol,
                        "source_port_range": rule.source_port_range,
                        "destination_port_range": rule.destination_port_range,
                        "source_address_prefix": getattr(rule, "source_address_prefix", None),
                        "destination_address_prefix": getattr(rule, "destination_address_prefix", None),
                        "source_address_prefixes": getattr(rule, "source_address_prefixes", None) or [],
                        "destination_address_prefixes": getattr(rule, "destination_address_prefixes", None) or [],
                        "provisioning_state": rule.provisioning_state
                    }
                    for rule in (nsg.security_rules or []) if rule.direction == 'Outbound'
                ]
            }
        except AzureError as e:
            logger.error(f"Failed to get NSG {nsg_name}: {e}")
            return None
    
    async def update_nsg_rules(self, resource_group: str, nsg_name: str, 
                             inbound_rules: List[Dict], outbound_rules: List[Dict]) -> bool:
        """Update NSG security rules, supporting prefix lists and both directions"""
        return await asyncio.to_thread(self._update_nsg_rules_sync, resource_group, nsg_name, inbound_rules, outbound_rules)

    def _update_nsg_rules_sync(self, resource_group: str, nsg_name: str, 
                             inbound_rules: List[Dict], outbound_rules: List[Dict]) -> bool:
        try:
            # Get current NSG
            nsg = self.network_client.network_security_groups.get(resource_group, nsg_name)

            # Update security rules
            from azure.mgmt.network.models import SecurityRule

            security_rules = []

            # Helper to build a SecurityRule from data, preferring list fields when provided
            def build_rule(rule_data: Dict) -> SecurityRule:
                source_prefixes = rule_data.get("source_address_prefixes") or []
                dest_prefixes = rule_data.get("destination_address_prefixes") or []

                return SecurityRule(
                    name=rule_data["name"],
                    priority=rule_data["priority"],
                    direction=rule_data.get("direction", "Inbound"),
                    access=rule_data["access"],
                    protocol=rule_data.get("protocol", "*"),
                    # Ports: support single or list if present
                    source_port_range=rule_data.get("source_port_range"),
                    destination_port_range=rule_data.get("destination_port_range"),
                    source_port_ranges=rule_data.get("source_port_ranges"),
                    destination_port_ranges=rule_data.get("destination_port_ranges"),
                    # Addresses: prefer list fields when provided
                    source_address_prefix=None if source_prefixes else rule_data.get("source_address_prefix"),
                    destination_address_prefix=None if dest_prefixes else rule_data.get("destination_address_prefix"),
                    source_address_prefixes=source_prefixes or None,
                    destination_address_prefixes=dest_prefixes or None
                )

            # Convert inbound rules
            for rule_data in inbound_rules or []:
                # Ensure direction is correctly set for inbound
                rule_data = {**rule_data, "direction": rule_data.get("direction", "Inbound")}
                security_rules.append(build_rule(rule_data))

            # Convert outbound rules
            for rule_data in outbound_rules or []:
                # Ensure direction is correctly set for outbound
                rule_data = {**rule_data, "direction": rule_data.get("direction", "Outbound")}
                security_rules.append(build_rule(rule_data))

            # Update NSG
            nsg.security_rules = security_rules

            # Apply changes
            poller = self.network_client.network_security_groups.begin_create_or_update(
                resource_group, nsg_name, nsg
            )
            poller.result()  # Wait for completion

            logger.info(f"Successfully updated NSG {nsg_name}")
            return True
        except AzureError as e:
            logger.error(f"Failed to update NSG {nsg_name}: {e}")
            return False

    async def create_nsg(self, resource_group: str, nsg_name: str, location: str, tags: Dict = None) -> Dict:
        """Create a new NSG"""
        return await asyncio.to_thread(self._create_nsg_sync, resource_group, nsg_name, location, tags)

    def _create_nsg_sync(self, resource_group: str, nsg_name: str, location: str, tags: Dict = None) -> Dict:
        try:
            from azure.mgmt.network.models import NetworkSecurityGroup
            
            nsg_params = NetworkSecurityGroup(
                location=location,
                tags=tags or {}
            )
            
            poller = self.network_client.network_security_groups.begin_create_or_update(
                resource_group,
                nsg_name,
                nsg_params
            )
            
            nsg = poller.result()
            
            return {
                "id": nsg.id,
                "name": nsg.name,
                "location": nsg.location,
                "resource_group": resource_group,
                "subscription_id": self.subscription_id,
                "provisioning_state": nsg.provisioning_state,
                "etag": nsg.etag,
                "tags": nsg.tags or {},
                "inbound_rules": [],
                "outbound_rules": []
            }
        except AzureError as e:
            logger.error(f"Failed to create NSG {nsg_name}: {e}")
            raise

    async def list_route_tables(self, resource_group: Optional[str] = None, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all Route Tables in subscription or specific resource group"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            network_client = NetworkManagementClient(self.credential, target_subscription_id)
            
            route_tables = []
            if resource_group:
                rt_list = network_client.route_tables.list(resource_group)
            else:
                rt_list = network_client.route_tables.list_all()
            
            for rt in rt_list:
                rt_data = {
                    "id": rt.id,
                    "name": rt.name,
                    "location": rt.location,
                    "resource_group": rt.id.split('/')[4],
                    "subscription_id": target_subscription_id,
                    "provisioning_state": rt.provisioning_state,
                    "tags": rt.tags or {},
                    "routes": []
                }
                
                if rt.routes:
                    rt_data["routes"] = [
                        {
                            "id": route.id,
                            "name": route.name,
                            "address_prefix": route.address_prefix,
                            "next_hop_type": route.next_hop_type,
                            "next_hop_ip_address": getattr(route, "next_hop_ip_address", None),
                            "provisioning_state": route.provisioning_state
                        }
                        for route in rt.routes
                    ]
                
                route_tables.append(rt_data)
            
            return route_tables
        except Exception as e:
            logger.error(f"Failed to list route tables: {e}")
            raise
    
    # Backup and Restore Methods
    async def create_backup(self, nsg_data: Dict, backup_name: str, 
                          container_name: str = "nsg-backups", backup_format: str = "json") -> Optional[str]:
        """Create backup of NSG configuration to blob storage in JSON and/or CSV format"""
        if not self.blob_service_client:
            logger.error("Blob service client not available")
            return None
        
        try:
            # Create container if it doesn't exist
            container_client = self.blob_service_client.get_container_client(container_name)
            try:
                container_client.get_container_properties()
            except:
                container_client.create_container()
            
            # Create backup data structure
            backup_content = {
                "backup_metadata": {
                    "backup_id": f"backup-{hash(str(nsg_data)) % 10000}",
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "backup_name": backup_name,
                    "backup_type": "manual",
                    "resource_type": "nsg",
                    "storage_account": container_name,
                    "container": container_name
                },
                "nsgs": [nsg_data]
            }
            
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            json_blob_url = None
            csv_blob_url = None
            
            # Create JSON backup if requested
            if backup_format in ['json', 'both']:
                json_blob_name = f"{nsg_data['name']}/{backup_name}_{timestamp}.json"
                json_blob_client = container_client.get_blob_client(json_blob_name)
                
                json_blob_client.upload_blob(
                    json.dumps(backup_content, indent=2),
                    overwrite=True
                )
                json_blob_url = json_blob_client.url
                logger.info(f"JSON backup created successfully: {json_blob_url}")
            
            # Create CSV backup if requested
            if backup_format in ['csv', 'both']:
                # Generate enhanced CSV content
                csv_content = await self._create_enhanced_csv_content(nsg_data)
                
                csv_blob_name = f"{nsg_data['name']}/{backup_name}_{timestamp}.csv"
                csv_blob_client = container_client.get_blob_client(csv_blob_name)
                
                csv_blob_client.upload_blob(
                    csv_content,
                    overwrite=True,
                    content_type="text/csv"
                )
                csv_blob_url = csv_blob_client.url
                logger.info(f"Enhanced CSV backup created successfully: {csv_blob_url}")
            
            # Return the appropriate URL based on format
            if backup_format == 'csv':
                return csv_blob_url
            elif backup_format == 'json':
                return json_blob_url
            else:  # 'both'
                return json_blob_url or csv_blob_url
                
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            return None
    
    async def _create_enhanced_csv_content(self, nsg_data: Dict) -> str:
        """Create enhanced CSV content using the same format as create_standardized_csv_format"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write enhanced CSV header
        header = [
            "Subscription", "Resource Group", "NSG Name", "Rule Name", "Direction",
            "Priority", "Access", "Protocol", "Source", "Destination", 
            "Owner Address", "Destination Address", "Source ASG", "Destination ASG", "Description"
        ]
        writer.writerow(header)
        
        subscription_id = nsg_data.get('subscription_id', 'N/A')
        resource_group = nsg_data.get('resource_group', 'N/A')
        nsg_name = nsg_data.get('name', 'N/A')
        
        # Process inbound rules
        inbound_rules = nsg_data.get('inbound_rules', [])
        if inbound_rules:
            for rule in inbound_rules:
                # Handle source addresses
                source_addresses = []
                if rule.get('source_address_prefixes'):
                    source_addresses = rule['source_address_prefixes']
                elif rule.get('source_address_prefix'):
                    source_addresses = [rule['source_address_prefix']]
                
                # Handle destination addresses
                dest_addresses = []
                if rule.get('destination_address_prefixes'):
                    dest_addresses = rule['destination_address_prefixes']
                elif rule.get('destination_address_prefix'):
                    dest_addresses = [rule['destination_address_prefix']]
                
                # Handle ASGs
                source_asg = "None"
                dest_asg = "None"
                
                if rule.get('source_application_security_groups'):
                    asgs = rule['source_application_security_groups']
                    if isinstance(asgs, list) and asgs:
                        asg_names = []
                        for asg in asgs:
                            if isinstance(asg, dict) and 'name' in asg:
                                asg_names.append(asg['name'])
                            elif isinstance(asg, str) and '/applicationSecurityGroups/' in asg:
                                asg_names.append(asg.split('/')[-1])
                        source_asg = ', '.join(asg_names) if asg_names else "None"
                
                if rule.get('destination_application_security_groups'):
                    asgs = rule['destination_application_security_groups']
                    if isinstance(asgs, list) and asgs:
                        asg_names = []
                        for asg in asgs:
                            if isinstance(asg, dict) and 'name' in asg:
                                asg_names.append(asg['name'])
                            elif isinstance(asg, str) and '/applicationSecurityGroups/' in asg:
                                asg_names.append(asg.split('/')[-1])
                        dest_asg = ', '.join(asg_names) if asg_names else "None"
                
                # Write rule row
                writer.writerow([
                    subscription_id,
                    resource_group,
                    nsg_name,
                    rule.get('name', 'N/A'),
                    'Inbound',
                    rule.get('priority', 'N/A'),
                    rule.get('access', 'N/A'),
                    rule.get('protocol', 'N/A'),
                    rule.get('source_port_range', 'N/A'),
                    rule.get('destination_port_range', 'N/A'),
                    ', '.join(source_addresses) if source_addresses else 'N/A',
                    ', '.join(dest_addresses) if dest_addresses else 'N/A',
                    source_asg,
                    dest_asg,
                    rule.get('description', f"NSG {nsg_name} inbound rule")
                ])
        
        # Process outbound rules
        outbound_rules = nsg_data.get('outbound_rules', [])
        if outbound_rules:
            for rule in outbound_rules:
                # Handle source addresses
                source_addresses = []
                if rule.get('source_address_prefixes'):
                    source_addresses = rule['source_address_prefixes']
                elif rule.get('source_address_prefix'):
                    source_addresses = [rule['source_address_prefix']]
                
                # Handle destination addresses
                dest_addresses = []
                if rule.get('destination_address_prefixes'):
                    dest_addresses = rule['destination_address_prefixes']
                elif rule.get('destination_address_prefix'):
                    dest_addresses = [rule['destination_address_prefix']]
                
                # Handle ASGs
                source_asg = "None"
                dest_asg = "None"
                
                if rule.get('source_application_security_groups'):
                    asgs = rule['source_application_security_groups']
                    if isinstance(asgs, list) and asgs:
                        asg_names = []
                        for asg in asgs:
                            if isinstance(asg, dict) and 'name' in asg:
                                asg_names.append(asg['name'])
                            elif isinstance(asg, str) and '/applicationSecurityGroups/' in asg:
                                asg_names.append(asg.split('/')[-1])
                        source_asg = ', '.join(asg_names) if asg_names else "None"
                
                if rule.get('destination_application_security_groups'):
                    asgs = rule['destination_application_security_groups']
                    if isinstance(asgs, list) and asgs:
                        asg_names = []
                        for asg in asgs:
                            if isinstance(asg, dict) and 'name' in asg:
                                asg_names.append(asg['name'])
                            elif isinstance(asg, str) and '/applicationSecurityGroups/' in asg:
                                asg_names.append(asg.split('/')[-1])
                        dest_asg = ', '.join(asg_names) if asg_names else "None"
                
                # Write rule row
                writer.writerow([
                    subscription_id,
                    resource_group,
                    nsg_name,
                    rule.get('name', 'N/A'),
                    'Outbound',
                    rule.get('priority', 'N/A'),
                    rule.get('access', 'N/A'),
                    rule.get('protocol', 'N/A'),
                    rule.get('source_port_range', 'N/A'),
                    rule.get('destination_port_range', 'N/A'),
                    ', '.join(source_addresses) if source_addresses else 'N/A',
                    ', '.join(dest_addresses) if dest_addresses else 'N/A',
                    source_asg,
                    dest_asg,
                    rule.get('description', f"NSG {nsg_name} outbound rule")
                ])
        
        return output.getvalue()

    async def restore_backup(self, blob_url: str, resource_group: str, 
                           nsg_name: str) -> bool:
        """Restore NSG configuration from backup"""
        try:
            # Download backup data
            blob_client = BlobClient.from_blob_url(blob_url)
            backup_content = blob_client.download_blob().readall()
            backup_data = json.loads(backup_content)
            
            # Extract configuration with backward compatibility
            inbound_rules = []
            outbound_rules = []
            if isinstance(backup_data, dict) and "configuration" in backup_data:
                nsg_config = backup_data["configuration"]
                inbound_rules = nsg_config.get("inbound_rules", [])
                outbound_rules = nsg_config.get("outbound_rules", [])
            elif isinstance(backup_data, dict) and "rules" in backup_data:
                rules = backup_data["rules"] or {}
                inbound_rules = rules.get("inbound", []) or rules.get("inbound_rules", []) or []
                outbound_rules = rules.get("outbound", []) or rules.get("outbound_rules", []) or []
            elif isinstance(backup_data, dict) and "nsgs" in backup_data:
                # Older multi-NSG backup format: find matching NSG or fallback to the first
                selected_nsg = None
                for nsg_entry in backup_data.get("nsgs", []):
                    if nsg_entry.get("name") == nsg_name:
                        selected_nsg = nsg_entry
                        break
                if not selected_nsg and backup_data.get("nsgs"):
                    selected_nsg = backup_data["nsgs"][0]
                if selected_nsg:
                    inbound_rules = selected_nsg.get("inbound_rules", [])
                    outbound_rules = selected_nsg.get("outbound_rules", [])
            else:
                logger.error("Unrecognized backup format: missing configuration/rules/nsgs")
                inbound_rules = []
                outbound_rules = []
            
            success = await self.update_nsg_rules(
                resource_group, nsg_name, inbound_rules, outbound_rules
            )
            
            if success:
                logger.info(f"Successfully restored NSG {nsg_name} from backup")
                return True
            else:
                logger.error(f"Failed to restore NSG {nsg_name}")
                return False
        except Exception as e:
            logger.error(f"Failed to restore backup: {e}")
            return False
    
    async def export_to_csv(self, nsg_data: Dict, filename: str,
                          container_name: str = "nsg-exports") -> Optional[str]:
        """Export NSG configuration to CSV format"""
        if not self.blob_service_client:
            logger.error("Blob service client not available")
            return None
        
        try:
            # Create container if it doesn't exist
            container_client = self.blob_service_client.get_container_client(container_name)
            try:
                container_client.get_container_properties()
            except:
                container_client.create_container()
            
            # Prepare enhanced CSV data matching the detailed format
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header matching the enhanced detailed format
            writer.writerow([
                'Subscription', 'Resource Group', 'NSG Name', 'Rule Name', 'Direction', 
                'Priority', 'Access', 'Protocol', 'Source', 'Destination', 
                'Owner Address', 'Destination Address', 'Source ASG', 'Destination ASG', 'Description'
            ])
            
            subscription_id = nsg_data.get('subscription_id', '')[:8] if nsg_data.get('subscription_id') else 'Prod'
            resource_group = nsg_data.get('resource_group', '') or 'rg-nsg'
            nsg_name = nsg_data.get('name', '') or 'nsg_name'
            
            # Add inbound rules
            for rule in nsg_data.get("inbound_rules", []):
                source_port = rule.get('source_port_range', '*')
                dest_port = rule.get('destination_port_range', '*')
                
                # Prefer array fields when present; fall back to singular
                src_prefixes = rule.get('source_address_prefixes') or []
                dst_prefixes = rule.get('destination_address_prefixes') or []

                # Normalize to list of strings
                if not isinstance(src_prefixes, list):
                    src_prefixes = []
                if not isinstance(dst_prefixes, list):
                    dst_prefixes = []

                # If arrays are empty, use singular values
                if not src_prefixes:
                    singular_src = rule.get('source_address_prefix', '*')
                    src_prefixes = [singular_src] if singular_src else ['*']
                if not dst_prefixes:
                    singular_dst = rule.get('destination_address_prefix', '*')
                    dst_prefixes = [singular_dst] if singular_dst else ['*']

                # Join multiple prefixes for display
                source_addr = ', '.join([str(p) for p in src_prefixes if p]) or '*'
                dest_addr = ', '.join([str(p) for p in dst_prefixes if p]) or '*'
                
                # Get ASG information
                source_asgs = rule.get('source_application_security_groups', [])
                dest_asgs = rule.get('destination_application_security_groups', [])
                
                # Handle both ASG objects and ASG ID strings
                source_asg_names = []
                if source_asgs:
                    for asg in source_asgs:
                        if isinstance(asg, dict):
                            source_asg_names.append(asg.get('name', ''))
                        else:
                            # ASG is an ID string, extract name from it
                            asg_name = str(asg).split('/')[-1] if '/' in str(asg) else str(asg)
                            source_asg_names.append(asg_name)
                
                dest_asg_names = []
                if dest_asgs:
                    for asg in dest_asgs:
                        if isinstance(asg, dict):
                            dest_asg_names.append(asg.get('name', ''))
                        else:
                            # ASG is an ID string, extract name from it
                            asg_name = str(asg).split('/')[-1] if '/' in str(asg) else str(asg)
                            dest_asg_names.append(asg_name)

                writer.writerow([
                    subscription_id,
                    resource_group,
                    nsg_name,
                    rule.get('name', ''),
                    'Inbound',
                    rule.get('priority', ''),
                    rule.get('access', ''),
                    rule.get('protocol', ''),
                    source_port,
                    dest_port,
                    source_addr,
                    dest_addr,
                    ', '.join(source_asg_names) if source_asg_names else 'None',
                    ', '.join(dest_asg_names) if dest_asg_names else 'None',
                    rule.get('description', '')
                ])
            
            # Add outbound rules
            for rule in nsg_data.get("outbound_rules", []):
                source_port = rule.get('source_port_range', '*')
                dest_port = rule.get('destination_port_range', '*')
                
                # Prefer array fields when present; fall back to singular
                src_prefixes = rule.get('source_address_prefixes') or []
                dst_prefixes = rule.get('destination_address_prefixes') or []

                # Normalize to list of strings
                if not isinstance(src_prefixes, list):
                    src_prefixes = []
                if not isinstance(dst_prefixes, list):
                    dst_prefixes = []

                # If arrays are empty, use singular values
                if not src_prefixes:
                    singular_src = rule.get('source_address_prefix', '*')
                    src_prefixes = [singular_src] if singular_src else ['*']
                if not dst_prefixes:
                    singular_dst = rule.get('destination_address_prefix', '*')
                    dst_prefixes = [singular_dst] if singular_dst else ['*']

                # Join multiple prefixes for display
                source_addr = ', '.join([str(p) for p in src_prefixes if p]) or '*'
                dest_addr = ', '.join([str(p) for p in dst_prefixes if p]) or '*'
                
                # Get ASG information
                source_asgs = rule.get('source_application_security_groups', [])
                dest_asgs = rule.get('destination_application_security_groups', [])
                
                # Handle both ASG objects and ASG ID strings
                source_asg_names = []
                if source_asgs:
                    for asg in source_asgs:
                        if isinstance(asg, dict):
                            source_asg_names.append(asg.get('name', ''))
                        else:
                            # ASG is an ID string, extract name from it
                            asg_name = str(asg).split('/')[-1] if '/' in str(asg) else str(asg)
                            source_asg_names.append(asg_name)
                
                dest_asg_names = []
                if dest_asgs:
                    for asg in dest_asgs:
                        if isinstance(asg, dict):
                            dest_asg_names.append(asg.get('name', ''))
                        else:
                            # ASG is an ID string, extract name from it
                            asg_name = str(asg).split('/')[-1] if '/' in str(asg) else str(asg)
                            dest_asg_names.append(asg_name)

                writer.writerow([
                    subscription_id,
                    resource_group,
                    nsg_name,
                    rule.get('name', ''),
                    'Outbound',
                    rule.get('priority', ''),
                    rule.get('access', ''),
                    rule.get('protocol', ''),
                    source_port,
                    dest_port,
                    source_addr,
                    dest_addr,
                    ', '.join(source_asg_names) if source_asg_names else 'None',
                    ', '.join(dest_asg_names) if dest_asg_names else 'None',
                    rule.get('description', '')
                ])
            csv_content = output.getvalue()
            
            # Upload to blob storage
            blob_name = f"{nsg_data['name']}/{filename}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            blob_client = container_client.get_blob_client(blob_name)
            
            blob_client.upload_blob(csv_content, overwrite=True)
            
            blob_url = blob_client.url
            logger.info(f"CSV export created successfully: {blob_url}")
            return blob_url
        except Exception as e:
            logger.error(f"Failed to export to CSV: {e}")
            return None
    
    async def upload_blob(self, content: str, filename: str, container_name: str = "nsg-backups", content_type: str = "text/plain") -> Optional[str]:
        """Upload content to blob storage (async version)"""
        return await asyncio.to_thread(self.upload_blob_sync, content, filename, container_name, content_type)

    def upload_blob_sync(self, content: str, filename: str, container_name: str = "nsg-backups", content_type: str = "text/plain") -> Optional[str]:
        """Upload content to blob storage (synchronous version)"""
        if not self.blob_service_client:
            logger.error("Blob service client not available")
            return None
        
        try:
            # Create container if it doesn't exist
            container_client = self.blob_service_client.get_container_client(container_name)
            try:
                container_client.get_container_properties()
            except:
                container_client.create_container()
            
            # Upload to blob storage
            blob_client = container_client.get_blob_client(filename)
            try:
                from azure.storage.blob import ContentSettings
                content_settings = ContentSettings(content_type=content_type)
                blob_client.upload_blob(content, overwrite=True, content_settings=content_settings)
            except Exception as cs_error:
                # Fallback without content settings if there's an issue
                logger.warning(f"ContentSettings error: {cs_error}, uploading without content settings")
                blob_client.upload_blob(content, overwrite=True)
            
            blob_url = blob_client.url
            logger.info(f"File uploaded successfully: {blob_url}")
            return blob_url
        except Exception as e:
            logger.error(f"Failed to upload blob: {e}")
            return None
    
    # Compliance and Analysis Methods
    async def analyze_compliance(self, nsg_data: Dict, golden_rules: Dict) -> Dict:
        """Analyze NSG compliance against golden rules"""
        try:
            analysis = {
                "compliance_score": 0,
                "missing_rules": [],
                "extra_rules": [],
                "recommendations": [],
                "risk_level": "low"
            }
            
            current_inbound = {rule["name"]: rule for rule in nsg_data.get("inbound_rules", [])}
            current_outbound = {rule["name"]: rule for rule in nsg_data.get("outbound_rules", [])}
            
            golden_inbound = {rule["name"]: rule for rule in golden_rules.get("inbound_rules", [])}
            golden_outbound = {rule["name"]: rule for rule in golden_rules.get("outbound_rules", [])}
            
            # Find missing rules
            for rule_name, rule_data in golden_inbound.items():
                if rule_name not in current_inbound:
                    analysis["missing_rules"].append(rule_name)
            
            for rule_name, rule_data in golden_outbound.items():
                if rule_name not in current_outbound:
                    analysis["missing_rules"].append(rule_name)
            
            # Find extra rules
            for rule_name in current_inbound:
                if rule_name not in golden_inbound:
                    analysis["extra_rules"].append(rule_name)
            
            for rule_name in current_outbound:
                if rule_name not in golden_outbound:
                    analysis["extra_rules"].append(rule_name)
            
            # Calculate compliance score
            total_golden_rules = len(golden_inbound) + len(golden_outbound)
            missing_count = len(analysis["missing_rules"])
            extra_count = len(analysis["extra_rules"])
            
            if total_golden_rules > 0:
                base_score = 100 - (missing_count / total_golden_rules * 100)
                # Penalize extra rules
                penalty = min(extra_count * 5, 20)  # Max 20% penalty for extra rules
                analysis["compliance_score"] = max(0, base_score - penalty)
            else:
                analysis["compliance_score"] = 100
            
            # Determine risk level
            if analysis["compliance_score"] >= 90:
                analysis["risk_level"] = "low"
            elif analysis["compliance_score"] >= 70:
                analysis["risk_level"] = "medium"
            elif analysis["compliance_score"] >= 50:
                analysis["risk_level"] = "high"
            else:
                analysis["risk_level"] = "critical"
            
            # Generate recommendations
            if analysis["missing_rules"]:
                analysis["recommendations"].append(
                    f"Add missing rules: {', '.join(analysis['missing_rules'])}"
                )
            
            if analysis["extra_rules"]:
                analysis["recommendations"].append(
                    f"Review and potentially remove extra rules: {', '.join(analysis['extra_rules'])}"
                )
            
            return analysis
        except Exception as e:
            logger.error(f"Failed to analyze compliance: {e}")
            return {
                "compliance_score": 0,
                "missing_rules": [],
                "extra_rules": [],
                "recommendations": ["Failed to analyze compliance"],
                "risk_level": "unknown"
            }
    
    # State Management Methods
    async def create_state_snapshot(self, nsg_data: Dict, change_type: str, 
                                  changed_by: str, change_reason: str = None) -> Dict:
        """Create a state snapshot for rollback purposes"""
        try:
            snapshot = {
                "nsg_id": nsg_data["id"],
                "nsg_name": nsg_data["name"],
                "resource_group": nsg_data["resource_group"],
                "change_type": change_type,
                "changed_by": changed_by,
                "change_reason": change_reason,
                "timestamp": datetime.utcnow().isoformat(),
                "configuration": nsg_data,
                "etag": nsg_data.get("etag")
            }
            
            # Store snapshot in blob storage
            if self.blob_service_client:
                container_name = "nsg-snapshots"
                container_client = self.blob_service_client.get_container_client(container_name)
                try:
                    container_client.get_container_properties()
                except:
                    container_client.create_container()
                
                blob_name = f"{nsg_data['name']}/snapshot_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
                blob_client = container_client.get_blob_client(blob_name)
                
                blob_client.upload_blob(
                    json.dumps(snapshot, indent=2),
                    overwrite=True
                )
                
                snapshot["blob_url"] = blob_client.url
            
            return snapshot
        except Exception as e:
            logger.error(f"Failed to create state snapshot: {e}")
            return {}
    
    async def rollback_to_snapshot(self, snapshot: Dict) -> bool:
        """Rollback NSG to a previous state snapshot"""
        try:
            if "blob_url" not in snapshot:
                logger.error("No blob URL in snapshot")
                return False
            
            # Download snapshot data
            blob_client = BlobClient.from_blob_url(snapshot["blob_url"])
            snapshot_content = blob_client.download_blob().readall()
            snapshot_data = json.loads(snapshot_content)
            
            # Restore configuration
            nsg_config = snapshot_data["configuration"]
            resource_group = nsg_config["resource_group"]
            nsg_name = nsg_config["name"]
            
            inbound_rules = nsg_config.get("inbound_rules", [])
            outbound_rules = nsg_config.get("outbound_rules", [])
            
            success = await self.update_nsg_rules(
                resource_group, nsg_name, inbound_rules, outbound_rules
            )
            
            if success:
                logger.info(f"Successfully rolled back NSG {nsg_name} to snapshot")
                return True
            else:
                logger.error(f"Failed to rollback NSG {nsg_name}")
                return False
        except Exception as e:
            logger.error(f"Failed to rollback to snapshot: {e}")
            return False
    
    async def list_containers(self, storage_account_name: Optional[str] = None) -> List[Dict]:
        """List all containers in the storage account"""
        return await asyncio.to_thread(self._list_containers_sync, storage_account_name)

    def _list_containers_sync(self, storage_account_name: Optional[str] = None) -> List[Dict]:
        client = self.blob_service_client
        if storage_account_name:
            client = self.get_blob_service_client_for_account(storage_account_name)
            
        if not client:
            logger.error("Blob service client not available")
            return []
        
        try:
            containers = []
            for container in client.list_containers():
                containers.append({
                    "name": container.name,
                    "last_modified": container.last_modified.isoformat() if container.last_modified else None,
                    "public_access": container.public_access.value if container.public_access else "None",
                    "metadata": container.metadata or {}
                })
            return containers
        except Exception as e:
            logger.error(f"Failed to list containers: {e}")
            return []

    async def list_blobs(self, container_name: str, storage_account_name: Optional[str] = None) -> List[Dict]:
        """List all blobs in a container"""
        return await asyncio.to_thread(self._list_blobs_sync, container_name, storage_account_name)

    def _list_blobs_sync(self, container_name: str, storage_account_name: Optional[str] = None) -> List[Dict]:
        client = self.blob_service_client
        if storage_account_name:
            client = self.get_blob_service_client_for_account(storage_account_name)

        if not client:
            logger.error("Blob service client not available")
            return []
            
        try:
            container_client = client.get_container_client(container_name)
            blobs = []
            for blob in container_client.list_blobs():
                blobs.append({
                    "name": blob.name,
                    "size": blob.size,
                    "last_modified": blob.last_modified.isoformat() if blob.last_modified else None,
                    "content_type": blob.content_settings.content_type if blob.content_settings else None
                })
            return blobs
        except Exception as e:
            logger.error(f"Failed to list blobs in container {container_name}: {e}")
            return []

    async def read_blob_content(self, container_name: str, blob_name: str, storage_account_name: Optional[str] = None) -> str:
        """Read content of a blob"""
        return await asyncio.to_thread(self._read_blob_content_sync, container_name, blob_name, storage_account_name)

    def _read_blob_content_sync(self, container_name: str, blob_name: str, storage_account_name: Optional[str] = None) -> str:
        client = self.blob_service_client
        if storage_account_name:
            client = self.get_blob_service_client_for_account(storage_account_name)

        if not client:
            raise Exception("Blob service client not available")
            
        try:
            container_client = client.get_container_client(container_name)
            blob_client = container_client.get_blob_client(blob_name)
            return blob_client.download_blob().readall().decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to read blob {blob_name} in container {container_name}: {e}")
            raise

    async def list_storage_accounts(self, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all storage accounts in the subscription"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            # Use the correct subscription if different from default
            storage_client = self.storage_client
            if subscription_id and subscription_id != self.subscription_id:
                storage_client = StorageManagementClient(self.credential, target_subscription_id)
            elif not storage_client: # Initialize if not exists
                 storage_client = StorageManagementClient(self.credential, target_subscription_id)

            storage_accounts = []
            for account in storage_client.storage_accounts.list():
                # Get additional properties
                try:
                    account_details = storage_client.storage_accounts.get_properties(
                        account.name.split('/')[-3],  # resource group name
                        account.name.split('/')[-1]   # storage account name
                    )
                except:
                    account_details = account # Fallback

                storage_accounts.append({
                    "id": account.id,
                    "name": account.name.split('/')[-1],
                    "resource_group": account.id.split('/')[4],
                    "location": account.location,
                    "sku": account.sku.name if account.sku else "Unknown",
                    "kind": account.kind.value if hasattr(account.kind, 'value') else str(account.kind) if account.kind else "Unknown",
                    "subscription_id": target_subscription_id,
                    "provisioning_state": getattr(account_details, 'provisioning_state', 'Unknown'),
                    "creation_time": getattr(account_details, 'creation_time', None).isoformat() if getattr(account_details, 'creation_time', None) else None,
                    "primary_endpoints": {
                        "blob": account_details.primary_endpoints.blob if getattr(account_details, 'primary_endpoints', None) else None,
                        "file": account_details.primary_endpoints.file if getattr(account_details, 'primary_endpoints', None) else None,
                        "queue": account_details.primary_endpoints.queue if getattr(account_details, 'primary_endpoints', None) else None,
                        "table": account_details.primary_endpoints.table if getattr(account_details, 'primary_endpoints', None) else None
                    } if getattr(account_details, 'primary_endpoints', None) else {}
                })
            
            return storage_accounts
        except Exception as e:
            logger.error(f"Failed to list storage accounts: {e}")
            return []

    async def list_vms(self, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all Virtual Machines in the subscription"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            compute_client = self.compute_client
            if subscription_id and subscription_id != self.subscription_id:
                compute_client = ComputeManagementClient(self.credential, target_subscription_id)
            elif not compute_client:
                 compute_client = ComputeManagementClient(self.credential, target_subscription_id)

            vms = []
            for vm in compute_client.virtual_machines.list_all():
                vms.append({
                    "id": vm.id,
                    "name": vm.name,
                    "resource_group": vm.id.split('/')[4],
                    "location": vm.location,
                    "subscription_id": target_subscription_id,
                    "provisioning_state": vm.provisioning_state,
                    "vm_size": vm.hardware_profile.vm_size if vm.hardware_profile else "Unknown",
                    "os_type": vm.storage_profile.os_disk.os_type.value if vm.storage_profile and vm.storage_profile.os_disk else "Unknown"
                })
            return vms
        except Exception as e:
            logger.error(f"Failed to list VMs: {e}")
            return []

    async def list_web_apps(self, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all Web Apps in the subscription"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            web_client = self.web_client
            if subscription_id and subscription_id != self.subscription_id:
                web_client = WebSiteManagementClient(self.credential, target_subscription_id)
            elif not web_client:
                 web_client = WebSiteManagementClient(self.credential, target_subscription_id)

            web_apps = []
            for app in web_client.web_apps.list():
                web_apps.append({
                    "id": app.id,
                    "name": app.name,
                    "resource_group": app.resource_group,
                    "location": app.location,
                    "subscription_id": target_subscription_id,
                    "state": app.state,
                    "default_host_name": app.default_host_name,
                    "https_only": app.https_only
                })
            return web_apps
        except Exception as e:
            logger.error(f"Failed to list Web Apps: {e}")
            return []

    async def list_key_vaults(self, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all Key Vaults in the subscription"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            keyvault_client = self.keyvault_client
            if subscription_id and subscription_id != self.subscription_id:
                keyvault_client = KeyVaultManagementClient(self.credential, target_subscription_id)
            elif not keyvault_client:
                 keyvault_client = KeyVaultManagementClient(self.credential, target_subscription_id)

            vaults = []
            for vault in keyvault_client.vaults.list():
                vaults.append({
                    "id": vault.id,
                    "name": vault.name,
                    "resource_group": vault.id.split('/')[4],
                    "location": vault.location,
                    "subscription_id": target_subscription_id,
                    "sku": vault.properties.sku.name.value if vault.properties and vault.properties.sku else "Unknown",
                    "provisioning_state": vault.properties.provisioning_state if vault.properties else "Unknown"
                })
            return vaults
        except Exception as e:
            logger.error(f"Failed to list Key Vaults: {e}")
            return []

    async def list_wafs(self, subscription_id: Optional[str] = None) -> List[Dict]:
        """List all WAF Policies in the subscription"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided and no default subscription configured")
            
            network_client = self.network_client
            if subscription_id and subscription_id != self.subscription_id:
                network_client = NetworkManagementClient(self.credential, target_subscription_id)
            elif not network_client:
                 network_client = NetworkManagementClient(self.credential, target_subscription_id)

            wafs = []
            for waf in network_client.web_application_firewall_policies.list_all():
                 wafs.append({
                    "id": waf.id,
                    "name": waf.name,
                    "resource_group": waf.id.split('/')[4],
                    "location": waf.location,
                    "subscription_id": target_subscription_id,
                    "provisioning_state": waf.provisioning_state,
                    "policy_settings": {
                        "state": waf.policy_settings.state if waf.policy_settings else None,
                        "mode": waf.policy_settings.mode if waf.policy_settings else None
                    } if waf.policy_settings else None
                })
            return wafs
        except Exception as e:
            logger.error(f"Failed to list WAFs: {e}")
            return []

    async def get_storage_report(self, subscription_id: Optional[str] = None, region: Optional[str] = None, resource_group: Optional[str] = None) -> List[Dict]:
        """Get detailed storage report similar to the reference script"""
        try:
            target_subscription_id = subscription_id or self.subscription_id
            if not target_subscription_id:
                raise ValueError("No subscription ID provided")
            
            # Get Subscription Name
            sub_name = target_subscription_id
            try:
                sub = self.subscription_client.subscriptions.get(target_subscription_id)
                sub_name = sub.display_name
            except Exception:
                pass

            storage_client = self.storage_client
            if subscription_id and subscription_id != self.subscription_id:
                storage_client = StorageManagementClient(self.credential, target_subscription_id)
            elif not storage_client:
                storage_client = StorageManagementClient(self.credential, target_subscription_id)

            accounts = list(storage_client.storage_accounts.list())
            
            # Apply Filters
            if region and region != 'All':
                accounts = [a for a in accounts if a.location.lower() == region.lower()]
            
            if resource_group and resource_group != 'All':
                accounts = [a for a in accounts if a.id.split('/')[4].lower() == resource_group.lower()]

            report_data = []

            def process_storage_account(account):
                try:
                    rg_name = account.id.split('/')[4]
                    account_name = account.name
                    location = account.location
                    sku = account.sku.name
                    
                    # Get Keys
                    keys = storage_client.storage_accounts.list_keys(rg_name, account_name)
                    key = keys.keys[0].value
                    conn_str = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={key};EndpointSuffix=core.windows.net"
                    
                    total_size_bytes = 0
                    last_activity = datetime.min
                    container_count = 0
                    
                    # Blob Service
                    try:
                        blob_service = BlobServiceClient.from_connection_string(conn_str)
                        containers = list(blob_service.list_containers())
                        container_count = len(containers)
                        
                        # We limit the depth of checking to avoid timeout
                        # Check up to 5 containers for last modified
                        for container in containers[:5]:
                            if container.last_modified:
                                last_activity = max(last_activity, container.last_modified.replace(tzinfo=None))
                            
                    except Exception as e:
                        # logger.warning(f"Blob service error for {account_name}: {e}")
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
                    
                    return {
                        "subscription_name": sub_name,
                        "subscription_id": target_subscription_id,
                        "storage_account": account_name,
                        "resource_group": rg_name,
                        "total_size_gb": round(total_size_bytes / (1024**3), 2),
                        "last_activity": last_activity_str,
                        "status": status,
                        "sku": sku,
                        "location": location,
                        "container_count": container_count,
                        "archive_recommendation": archive_rec
                    }
                except Exception as e:
                    logger.error(f"Error processing {account.name}: {e}")
                    return None

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


