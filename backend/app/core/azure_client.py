from azure.identity import ClientSecretCredential, DefaultAzureCredential
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.compute import ComputeManagementClient
from azure.keyvault.secrets import SecretClient
from azure.storage.blob import BlobServiceClient
from azure.mgmt.monitor import MonitorManagementClient
import logging
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime, timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


class AzureClient:
    """Azure client for managing NSGs, ASGs, and other Azure resources"""
    
    def __init__(self):
        self.credential = None
        self.network_client = None
        self.resource_client = None
        self.compute_client = None
        self.keyvault_client = None
        self.storage_client = None
        self.monitor_client = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize Azure clients with service principal credentials"""
        try:
            # Create credential
            self.credential = ClientSecretCredential(
                tenant_id=settings.AZURE_TENANT_ID,
                client_id=settings.AZURE_CLIENT_ID,
                client_secret=settings.AZURE_CLIENT_SECRET
            )
            
            # Initialize clients
            self.network_client = NetworkManagementClient(
                credential=self.credential,
                subscription_id=settings.AZURE_SUBSCRIPTION_ID
            )
            
            self.resource_client = ResourceManagementClient(
                credential=self.credential,
                subscription_id=settings.AZURE_SUBSCRIPTION_ID
            )
            
            self.compute_client = ComputeManagementClient(
                credential=self.credential,
                subscription_id=settings.AZURE_SUBSCRIPTION_ID
            )
            
            # Key Vault client
            if settings.AZURE_KEY_VAULT_URL:
                self.keyvault_client = SecretClient(
                    vault_url=settings.AZURE_KEY_VAULT_URL,
                    credential=self.credential
                )
            
            # Storage client
            if settings.AZURE_STORAGE_CONNECTION_STRING:
                self.storage_client = BlobServiceClient.from_connection_string(
                    settings.AZURE_STORAGE_CONNECTION_STRING
                )
            
            # Monitor client
            self.monitor_client = MonitorManagementClient(
                credential=self.credential,
                subscription_id=settings.AZURE_SUBSCRIPTION_ID
            )
            
            logger.info("Azure clients initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Azure clients: {e}")
            raise
    
    async def get_subscriptions(self) -> List[Dict[str, Any]]:
        """Get all subscriptions accessible to the service principal"""
        try:
            subscriptions = []
            async for sub in self.resource_client.subscriptions.list():
                subscriptions.append({
                    "id": sub.id,
                    "name": sub.display_name,
                    "state": sub.state,
                    "location_placement_id": sub.subscription_policies.location_placement_id
                })
            return subscriptions
        except Exception as e:
            logger.error(f"Failed to get subscriptions: {e}")
            raise
    
    async def get_nsgs(self, resource_group_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all NSGs or NSGs in a specific resource group"""
        try:
            nsgs = []
            if resource_group_name:
                # Get NSGs in specific resource group
                async for nsg in self.network_client.network_security_groups.list(resource_group_name):
                    nsgs.append(self._format_nsg(nsg))
            else:
                # Get all NSGs in subscription
                async for nsg in self.network_client.network_security_groups.list_all():
                    nsgs.append(self._format_nsg(nsg))
            return nsgs
        except Exception as e:
            logger.error(f"Failed to get NSGs: {e}")
            raise
    
    async def get_nsg_details(self, resource_group_name: str, nsg_name: str) -> Dict[str, Any]:
        """Get detailed information about a specific NSG"""
        try:
            nsg = await self.network_client.network_security_groups.get(
                resource_group_name=resource_group_name,
                network_security_group_name=nsg_name
            )
            return self._format_nsg(nsg)
        except Exception as e:
            logger.error(f"Failed to get NSG details: {e}")
            raise
    
    async def get_asgs(self, resource_group_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all ASGs or ASGs in a specific resource group"""
        try:
            asgs = []
            if resource_group_name:
                # Get ASGs in specific resource group
                async for asg in self.network_client.application_security_groups.list(resource_group_name):
                    asgs.append(self._format_asg(asg))
            else:
                # Get all ASGs in subscription
                async for asg in self.network_client.application_security_groups.list_all():
                    asgs.append(self._format_asg(asg))
            return asgs
        except Exception as e:
            logger.error(f"Failed to get ASGs: {e}")
            raise
    
    async def create_nsg(self, resource_group_name: str, nsg_name: str, location: str = "East US") -> Dict[str, Any]:
        """Create a new NSG"""
        try:
            nsg_parameters = {
                "location": location,
                "security_rules": []
            }
            
            operation = self.network_client.network_security_groups.begin_create_or_update(
                resource_group_name=resource_group_name,
                network_security_group_name=nsg_name,
                parameters=nsg_parameters
            )
            result = operation.result()
            logger.info(f"Successfully created NSG '{nsg_name}' in resource group '{resource_group_name}'")
            return self._format_nsg(result)
        except Exception as e:
            logger.error(f"Failed to create NSG '{nsg_name}': {e}")
            raise
    
    async def create_nsg_rule(self, resource_group_name: str, nsg_name: str, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new NSG rule"""
        try:
            rule = self.network_client.security_rules.begin_create_or_update(
                resource_group_name=resource_group_name,
                network_security_group_name=nsg_name,
                security_rule_name=rule_data["name"],
                security_rule_parameters=rule_data
            )
            result = rule.result()
            return self._format_security_rule(result)
        except Exception as e:
            logger.error(f"Failed to create NSG rule: {e}")
            raise
    
    async def update_nsg_rule(self, resource_group_name: str, nsg_name: str, rule_name: str, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing NSG rule"""
        try:
            rule = self.network_client.security_rules.begin_create_or_update(
                resource_group_name=resource_group_name,
                network_security_group_name=nsg_name,
                security_rule_name=rule_name,
                security_rule_parameters=rule_data
            )
            result = rule.result()
            return self._format_security_rule(result)
        except Exception as e:
            logger.error(f"Failed to update NSG rule: {e}")
            raise
    
    async def delete_nsg_rule(self, resource_group_name: str, nsg_name: str, rule_name: str) -> bool:
        """Delete an NSG rule"""
        try:
            await self.network_client.security_rules.begin_delete(
                resource_group_name=resource_group_name,
                network_security_group_name=nsg_name,
                security_rule_name=rule_name
            )
            return True
        except Exception as e:
            logger.error(f"Failed to delete NSG rule: {e}")
            raise
    
    async def get_nsg_traffic_analytics(self, resource_group_name: str, nsg_name: str, hours: int = 24) -> Dict[str, Any]:
        """Get NSG traffic analytics data"""
        try:
            # Get flow logs for the NSG
            flow_logs = []
            async for flow_log in self.network_client.network_watchers.list_all():
                # Get flow log status
                flow_log_status = await self.network_client.network_watchers.get_flow_log_status(
                    resource_group_name=flow_log.id.split('/')[4],
                    network_watcher_name=flow_log.name,
                    target_resource_id=f"/subscriptions/{settings.AZURE_SUBSCRIPTION_ID}/resourceGroups/{resource_group_name}/providers/Microsoft.Network/networkSecurityGroups/{nsg_name}"
                )
                if flow_log_status.enabled:
                    flow_logs.append({
                        "name": flow_log.name,
                        "enabled": flow_log_status.enabled,
                        "retention_policy": flow_log_status.retention_policy,
                        "storage_id": flow_log_status.storage_id
                    })
            
            return {
                "nsg_name": nsg_name,
                "flow_logs": flow_logs,
                "analytics_available": len(flow_logs) > 0
            }
        except Exception as e:
            logger.error(f"Failed to get NSG traffic analytics: {e}")
            raise
    
    async def backup_nsg_rules(self, resource_group_name: str, nsg_name: str) -> Dict[str, Any]:
        """Create a backup of NSG rules"""
        try:
            nsg = await self.get_nsg_details(resource_group_name, nsg_name)
            
            backup_data = {
                "nsg_name": nsg_name,
                "resource_group": resource_group_name,
                "subscription_id": settings.AZURE_SUBSCRIPTION_ID,
                "backup_timestamp": datetime.utcnow().isoformat(),
                "rules": {
                    "inbound": nsg.get("security_rules", []),
                    "outbound": nsg.get("default_security_rules", [])
                },
                "tags": nsg.get("tags", {}),
                "location": nsg.get("location", "")
            }
            
            # Store backup in Azure Blob Storage if available
            if self.storage_client:
                container_client = self.storage_client.get_container_client("nsg-backups")
                blob_name = f"{resource_group_name}/{nsg_name}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
                blob_client = container_client.get_blob_client(blob_name)
                await blob_client.upload_blob(str(backup_data), overwrite=True)
                backup_data["blob_url"] = blob_client.url
            
            return backup_data
        except Exception as e:
            logger.error(f"Failed to backup NSG rules: {e}")
            raise
    
    async def restore_nsg_rules(self, resource_group_name: str, nsg_name: str, backup_data: Dict[str, Any]) -> bool:
        """Restore NSG rules from backup"""
        try:
            # Clear existing rules (except default ones)
            nsg = await self.get_nsg_details(resource_group_name, nsg_name)
            existing_rules = nsg.get("security_rules", [])
            
            # Delete existing custom rules
            for rule in existing_rules:
                if not rule.get("name", "").startswith("default"):
                    await self.delete_nsg_rule(resource_group_name, nsg_name, rule["name"])
            
            # Restore rules from backup
            backup_rules = backup_data.get("rules", {}).get("inbound", [])
            for rule in backup_rules:
                if not rule.get("name", "").startswith("default"):
                    await self.create_nsg_rule(resource_group_name, nsg_name, rule)
            
            return True
        except Exception as e:
            logger.error(f"Failed to restore NSG rules: {e}")
            raise
    
    def _format_nsg(self, nsg) -> Dict[str, Any]:
        """Format NSG data for API response"""
        return {
            "id": nsg.id,
            "name": nsg.name,
            "location": nsg.location,
            "resource_group": nsg.id.split('/')[4],
            "tags": nsg.tags or {},
            "security_rules": [
                self._format_security_rule(rule) for rule in nsg.security_rules or []
            ],
            "default_security_rules": [
                self._format_security_rule(rule) for rule in nsg.default_security_rules or []
            ],
            "network_interfaces": [
                {"id": nic.id, "name": nic.name} for nic in nsg.network_interfaces or []
            ],
            "subnets": [
                {"id": subnet.id, "name": subnet.name} for subnet in nsg.subnets or []
            ],
            "provisioning_state": nsg.provisioning_state,
            "etag": nsg.etag
        }
    
    def _format_asg(self, asg) -> Dict[str, Any]:
        """Format ASG data for API response"""
        return {
            "id": asg.id,
            "name": asg.name,
            "location": asg.location,
            "resource_group": asg.id.split('/')[4],
            "tags": asg.tags or {},
            "network_interfaces": [
                {"id": nic.id, "name": nic.name} for nic in asg.network_interfaces or []
            ],
            "ip_configurations": [
                {"id": ip.id, "name": ip.name} for ip in asg.ip_configurations or []
            ],
            "provisioning_state": asg.provisioning_state,
            "etag": asg.etag
        }
    
    def _format_security_rule(self, rule) -> Dict[str, Any]:
        """Format security rule data for API response"""
        return {
            "id": rule.id,
            "name": rule.name,
            "priority": rule.priority,
            "direction": rule.direction,
            "access": rule.access,
            "protocol": rule.protocol,
            "source_port_range": rule.source_port_range,
            "destination_port_range": rule.destination_port_range,
            "source_address_prefix": rule.source_address_prefix,
            "destination_address_prefix": rule.destination_address_prefix,
            "source_address_prefixes": rule.source_address_prefixes or [],
            "destination_address_prefixes": rule.destination_address_prefixes or [],
            "source_application_security_groups": [
                {"id": asg.id, "name": asg.name} for asg in rule.source_application_security_groups or []
            ],
            "destination_application_security_groups": [
                {"id": asg.id, "name": asg.name} for asg in rule.destination_application_security_groups or []
            ],
            "provisioning_state": rule.provisioning_state,
            "etag": rule.etag
        }


# Global Azure client instance
azure_client = AzureClient()
