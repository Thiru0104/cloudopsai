from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
import logging
from app.services.azure_service import AzureService

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_azure_service():
    return AzureService()

@router.get("")
async def get_dashboard(azure_service: AzureService = Depends(get_azure_service)) -> Dict[str, Any]:
    """
    Get dashboard statistics aggregated across all subscriptions
    """
    try:
        logger.info("Processing dashboard request")
        
        # Use real Azure data
        try:
            subscriptions = await azure_service.list_subscriptions()
            logger.info(f"Retrieved {len(subscriptions)} subscriptions")
        except Exception as e:
            logger.error(f"Failed to list subscriptions: {e}")
            subscriptions = []
            
        # Initialize aggregated counters
        total_nsgs = 0
        total_rules = 0
        active_nsgs = 0
        high_risk_nsgs = 0
        total_resource_groups = 0
        all_nsgs = []
        active_subscriptions_count = 0
        
        subscription_breakdown = []
        
        # Iterate through all accessible subscriptions
        for subscription in subscriptions:
            subscription_id = subscription['id']
            subscription_name = subscription['display_name']
            logger.info(f"Fetching data for subscription: {subscription_name} ({subscription_id})")
            
            sub_total_nsgs = 0
            sub_total_rules = 0
            sub_high_risk_count = 0
            
            try:
                # Get resource groups data for this subscription
                resource_groups = await azure_service.list_resource_groups(subscription_id)
                sub_resource_groups_count = len(resource_groups)
                total_resource_groups += sub_resource_groups_count
                
                # Get NSGs data for this subscription
                # AzureService.list_nsgs returns a list of dictionaries
                subscription_nsgs = await azure_service.list_nsgs(subscription_id=subscription_id)
                
                # Add subscription info to each NSG for tracking
                for nsg in subscription_nsgs:
                    nsg['subscription_id'] = subscription_id
                    nsg['subscription_name'] = subscription_name
                    # Determine if NSG is high risk (mock logic if risk_level not present)
                    if 'risk_level' not in nsg:
                        # Simple heuristic: if any rule allows Any/Any, mark as high risk
                        is_high_risk = False
                        for rule in nsg.get('inbound_rules', []) + nsg.get('outbound_rules', []):
                            if rule.get('access') == 'Allow' and rule.get('source_address_prefix') == '*' and rule.get('destination_address_prefix') == '*':
                                is_high_risk = True
                                break
                        nsg['risk_level'] = 'high' if is_high_risk else 'low'

                all_nsgs.extend(subscription_nsgs)
                
                # Aggregate statistics for this subscription
                sub_total_nsgs = len(subscription_nsgs)
                sub_total_rules = sum(len(nsg.get('inbound_rules', [])) + len(nsg.get('outbound_rules', [])) for nsg in subscription_nsgs)
                sub_active_nsgs = len([nsg for nsg in subscription_nsgs if nsg.get('provisioning_state') == 'Succeeded'])
                sub_high_risk_nsgs = len([nsg for nsg in subscription_nsgs if nsg.get('risk_level') in ['high', 'critical']])
                sub_high_risk_count = sub_high_risk_nsgs

                total_nsgs += sub_total_nsgs
                total_rules += sub_total_rules
                active_nsgs += sub_active_nsgs
                high_risk_nsgs += sub_high_risk_nsgs
                
                active_subscriptions_count += 1
                logger.info(f"Subscription {subscription_name}: {sub_total_nsgs} NSGs, {sub_total_rules} rules")
                
                subscription_breakdown.append({
                    "subscription_id": subscription_id,
                    "subscription_name": subscription_name,
                    "status": subscription.get('state', 'Unknown'),
                    "nsg_count": sub_total_nsgs,
                    "rule_count": sub_total_rules,
                    "high_risk_count": sub_high_risk_count
                })

            except Exception as e:
                logger.error(f"Error fetching data for subscription {subscription_name}: {e}")
                # Add to breakdown with error status or zero counts
                subscription_breakdown.append({
                    "subscription_id": subscription_id,
                    "subscription_name": subscription_name,
                    "status": "Error",
                    "error": str(e),
                    "nsg_count": 0,
                    "rule_count": 0,
                    "high_risk_count": 0
                })
                continue
        
        response = {
            "metrics": {
                "live_connections": 0, # Placeholder as we don't have this metric yet
                "nsg_rules": total_rules,
                "security_groups": total_nsgs,
                "security_alerts": high_risk_nsgs
            },
            "recent_activity": [
                {
                    "id": 1,
                    "type": "multi_subscription_scan",
                    "title": "Multi-Subscription Scan Completed",
                    "description": f"Scanned {len(subscriptions)} subscriptions, found {total_nsgs} NSGs across {total_resource_groups} resource groups",
                    "status": "success",
                    "timestamp": "Just now"
                }
            ],
            "system_status": {
                "azure_api": "online",
                "database": "online",
                "monitoring": "warning",
                "backup_service": "offline"
            },
            "statistics": {
                "total_subscriptions": len(subscriptions),
                "active_subscriptions": active_subscriptions_count,
                "total_resource_groups": total_resource_groups,
                "total_nsgs": total_nsgs,
                "active_nsgs": active_nsgs,
                "total_rules": total_rules,
                "high_risk_nsgs": high_risk_nsgs
            },
            "subscription_breakdown": subscription_breakdown
        }
        
        logger.info("Dashboard data prepared successfully")
        return response
        
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard data: {str(e)}")