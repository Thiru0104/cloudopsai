from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
import logging
from app.services.azure_service import AzureService
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Use dependency injection for AzureService to ensure fresh initialization per request
async def get_azure_service():
    return AzureService()

@router.get("")
async def get_dashboard(
    subscription_id: Optional[str] = Query(None, description="Filter by specific subscription ID"),
    region: Optional[str] = Query(None, description="Filter by region"),
    resource_group: Optional[str] = Query(None, description="Filter by resource group"),
    vm_name: Optional[str] = Query(None, description="Filter by virtual machine name"),
    time_range: Optional[str] = Query("24h", description="Time range for metrics"),
    azure_service: AzureService = Depends(get_azure_service)
) -> Dict[str, Any]:
    """
    Get dashboard statistics aggregated across all subscriptions or for a specific subscription,
    with optional filtering by region, resource group, and VM name.
    """
    try:
        logger.info(f"Processing dashboard request (sub={subscription_id}, region={region}, rg={resource_group}, vm={vm_name})")
        
        # Use real Azure data
        try:
            all_subscriptions = await azure_service.list_subscriptions()
            logger.info(f"Retrieved {len(all_subscriptions)} available subscriptions via API")
            for sub in all_subscriptions:
                logger.info(f"Found subscription: {sub.get('display_name')} ({sub.get('id')})")
        except Exception as e:
            logger.error(f"Failed to list subscriptions: {e}")
            all_subscriptions = []
            
        # If list_subscriptions failed or returned empty, but we have a configured subscription in env, ensure it's in the list
        if not all_subscriptions and settings.AZURE_SUBSCRIPTION_ID:
            logger.info(f"No subscriptions found via API, falling back to configured subscription: {settings.AZURE_SUBSCRIPTION_ID}")
            all_subscriptions = [{
                "id": settings.AZURE_SUBSCRIPTION_ID,
                "display_name": f"Subscription ({settings.AZURE_SUBSCRIPTION_ID})", 
                "state": "Enabled"
            }]

        # Filter subscriptions if a specific one is requested
        if subscription_id and subscription_id != "All":
            subscriptions = [s for s in all_subscriptions if s['id'] == subscription_id]
            if not subscriptions:
                logger.warning(f"Requested subscription {subscription_id} not found in available subscriptions. Using ID directly.")
                subscriptions = [{"id": subscription_id, "display_name": f"Subscription ({subscription_id})", "state": "Unknown"}]
        else:
            subscriptions = all_subscriptions
            
        if not subscriptions:
            logger.warning("No subscriptions available to process")
            return {
                "summary": {"virtual_machines": 0, "storage_accounts": 0, "web_apps": 0, "nsgs": 0, "wafs": 0, "key_vaults": 0},
                "resources": {"vms": [], "storage_accounts": []},
                "metrics": {},
                "recent_activity": [],
                "system_status": {"azure_api": "online"},
                "statistics": {},
                "subscription_breakdown": [],
                "available_subscriptions": [],
                "filter_options": {"regions": [], "resource_groups": [], "vms": []}
            }

        # Initialize collections for raw data (to be filtered later)
        raw_nsgs = []
        raw_vms = []
        raw_storage = []
        raw_web_apps = []
        raw_key_vaults = []
        raw_wafs = []
        raw_incidents = []
        raw_timeline = []
        
        # Sets for filter options
        available_regions = set()
        available_resource_groups = set()
        
        active_subscriptions_count = 0
        subscription_breakdown = []
        
        # Iterate through all accessible/selected subscriptions
        for subscription in subscriptions:
            sub_id = subscription['id']
            sub_name = subscription['display_name']
            
            try:
                # Fetch Data
                # 1. NSGs
                sub_nsgs = await azure_service.list_nsgs(subscription_id=sub_id)
                for item in sub_nsgs: item['subscription_name'] = sub_name
                raw_nsgs.extend(sub_nsgs)
                
                # 2. VMs
                sub_vms = await azure_service.list_vms(subscription_id=sub_id)
                for item in sub_vms: item['subscription_name'] = sub_name
                raw_vms.extend(sub_vms)

                # 3. Storage
                sub_storage = await azure_service.list_storage_accounts(subscription_id=sub_id)
                for item in sub_storage: item['subscription_name'] = sub_name
                raw_storage.extend(sub_storage)

                # 4. Web Apps
                sub_web_apps = await azure_service.list_web_apps(subscription_id=sub_id)
                for item in sub_web_apps: item['subscription_name'] = sub_name
                raw_web_apps.extend(sub_web_apps)

                # 5. Key Vaults
                sub_key_vaults = await azure_service.list_key_vaults(subscription_id=sub_id)
                for item in sub_key_vaults: item['subscription_name'] = sub_name
                raw_key_vaults.extend(sub_key_vaults)

                # 6. WAFs
                sub_wafs = await azure_service.list_wafs(subscription_id=sub_id)
                for item in sub_wafs: item['subscription_name'] = sub_name
                raw_wafs.extend(sub_wafs)

                # 7. Incidents & Timeline (Only if filtering by specific sub or if we want global incidents)
                # Fetching logs can be slow, so maybe limit this?
                # For now, we fetch.
                sub_incidents = await azure_service.get_recent_incidents(subscription_id=sub_id, time_range=time_range)
                for item in sub_incidents: item['subscription_name'] = sub_name
                raw_incidents.extend(sub_incidents)

                sub_timeline = await azure_service.get_incidents_timeline(subscription_id=sub_id, time_range=time_range)
                raw_timeline.extend(sub_timeline)
                
                active_subscriptions_count += 1
                
                # Initial breakdown (pre-filter) - strictly speaking breakdown should probably reflect filters too?
                # Usually breakdown is "per subscription", so it might be weird if it doesn't match the totals.
                # Let's calculate breakdown from filtered data later.

            except Exception as e:
                logger.error(f"Error fetching data for subscription {sub_name}: {e}")
                continue

        # Extract Available Filter Options (from ALL fetched data in scope)
        all_resources = raw_nsgs + raw_vms + raw_storage + raw_web_apps + raw_key_vaults + raw_wafs
        for r in all_resources:
            if r.get('location'): available_regions.add(r['location'])
            if r.get('resource_group'): available_resource_groups.add(r['resource_group'])
        
        available_vms = sorted([vm['name'] for vm in raw_vms])

        # Apply Filters
        def apply_filters(items, item_type=None):
            filtered = items
            if region and region != "All":
                filtered = [i for i in filtered if i.get('location') == region]
            if resource_group and resource_group != "All":
                filtered = [i for i in filtered if i.get('resource_group') == resource_group]
            
            # VM Name filter only applies to VMs
            if vm_name and vm_name != "All" and item_type == 'vm':
                 filtered = [i for i in filtered if i.get('name') == vm_name]
            
            return filtered

        filtered_nsgs = apply_filters(raw_nsgs)
        filtered_vms = apply_filters(raw_vms, item_type='vm')
        filtered_storage = apply_filters(raw_storage)
        filtered_web_apps = apply_filters(raw_web_apps)
        filtered_key_vaults = apply_filters(raw_key_vaults)
        filtered_wafs = apply_filters(raw_wafs)

        # Calculate Aggregates
        total_nsgs = len(filtered_nsgs)
        total_vms = len(filtered_vms)
        total_storage_accounts = len(filtered_storage)
        total_web_apps = len(filtered_web_apps)
        total_key_vaults = len(filtered_key_vaults)
        total_wafs = len(filtered_wafs)
        
        total_rules = sum(len(nsg.get('inbound_rules', [])) + len(nsg.get('outbound_rules', [])) for nsg in filtered_nsgs)
        
        # Risk Logic
        high_risk_nsgs = 0
        for nsg in filtered_nsgs:
            is_high_risk = False
            for rule in nsg.get('inbound_rules', []) + nsg.get('outbound_rules', []):
                    if rule.get('access') == 'Allow' and rule.get('source_address_prefix') == '*' and rule.get('destination_address_prefix') == '*':
                        is_high_risk = True
                        break
            if is_high_risk:
                high_risk_nsgs += 1

        # Re-calculate Subscription Breakdown based on FILTERED data
        # We need to group filtered items by subscription
        sub_stats = {}
        for sub in subscriptions:
            sub_id = sub['id']
            sub_stats[sub_id] = {
                "subscription_id": sub_id,
                "subscription_name": sub['display_name'],
                "status": sub.get('state', 'Unknown'),
                "nsg_count": 0, "rule_count": 0, "vm_count": 0, "storage_count": 0, 
                "web_app_count": 0, "key_vault_count": 0, "waf_count": 0
            }
        
        for nsg in filtered_nsgs:
            sid = nsg.get('subscription_id')
            if sid in sub_stats:
                sub_stats[sid]['nsg_count'] += 1
                sub_stats[sid]['rule_count'] += len(nsg.get('inbound_rules', [])) + len(nsg.get('outbound_rules', []))
        
        for vm in filtered_vms:
            sid = vm.get('subscription_id')
            if sid in sub_stats: sub_stats[sid]['vm_count'] += 1
            
        for sa in filtered_storage:
            sid = sa.get('subscription_id')
            if sid in sub_stats: sub_stats[sid]['storage_count'] += 1

        for wa in filtered_web_apps:
            sid = wa.get('subscription_id')
            if sid in sub_stats: sub_stats[sid]['web_app_count'] += 1

        for kv in filtered_key_vaults:
            sid = kv.get('subscription_id')
            if sid in sub_stats: sub_stats[sid]['key_vault_count'] += 1

        for waf in filtered_wafs:
            sid = waf.get('subscription_id')
            if sid in sub_stats: sub_stats[sid]['waf_count'] += 1

        subscription_breakdown = list(sub_stats.values())

        # Consolidate Timeline
        timeline_map = {}
        for item in raw_timeline:
            ts = item['timestamp']
            if ts not in timeline_map:
                timeline_map[ts] = {"timestamp": ts, "error": 0, "warning": 0, "critical": 0}
            
            for key in ["error", "warning", "critical"]:
                if key in item:
                    timeline_map[ts][key] += item[key]
        
        consolidated_timeline = sorted(list(timeline_map.values()), key=lambda x: x['timestamp'])

        response = {
            "summary": {
                "virtual_machines": total_vms,
                "storage_accounts": total_storage_accounts,
                "web_apps": total_web_apps,
                "nsgs": total_nsgs,
                "wafs": total_wafs,
                "key_vaults": total_key_vaults
            },
            "resources": {
                "vms": filtered_vms,
                "storage_accounts": filtered_storage
            },
            "metrics": {
                "live_connections": 0, 
                "nsg_rules": total_rules,
                "security_groups": total_nsgs,
                "security_alerts": high_risk_nsgs,
                "timeline": consolidated_timeline
            },
             "recent_activity": raw_incidents[:10], # Return top 10 incidents
            "system_status": {
                "azure_api": "online",
                "database": "online",
                "monitoring": "active",
                "backup_service": "standby"
            },
            "statistics": {
                "total_subscriptions": len(subscriptions),
                "active_subscriptions": active_subscriptions_count,
                "total_resource_groups": len(available_resource_groups), # Approximate from visible data
                "total_nsgs": total_nsgs,
                "active_nsgs": total_nsgs, 
                "total_rules": total_rules,
                "high_risk_nsgs": high_risk_nsgs
            },
            "subscription_breakdown": subscription_breakdown,
            "available_subscriptions": all_subscriptions,
            "filter_options": {
                "regions": sorted(list(available_regions)),
                "resource_groups": sorted(list(available_resource_groups)),
                "vms": available_vms
            }
        }
        
        logger.info("Dashboard data prepared successfully")
        return response
        
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard data: {str(e)}")