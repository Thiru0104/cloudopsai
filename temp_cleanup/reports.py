from typing import Any, Dict, List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
import csv
import io
from datetime import datetime
import logging

from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.resource import SubscriptionClient, ResourceManagementClient
from app.services.azure_service import AzureService
from app.services.nsg_validation import NSGValidator, NSGRule
from app.core.config import settings

# Import Azure SDK exceptions if needed
from azure.core.exceptions import AzureError

router = APIRouter()
logger = logging.getLogger(__name__)

class ReportRequest(BaseModel):
    subscription_id: Optional[str] = None
    resource_group: Optional[str] = None
    nsg_names: Optional[List[str]] = []

def _convert_to_nsg_rules(azure_rules) -> List[NSGRule]:
    """Convert Azure SDK rules to NSGRule objects for validation"""
    converted_rules = []
    for rule in azure_rules:
        # Handle prefixes
        src_prefix = rule.source_address_prefix or ""
        if hasattr(rule, 'source_address_prefixes') and rule.source_address_prefixes:
            src_prefix = ",".join(rule.source_address_prefixes)
            
        dest_prefix = rule.destination_address_prefix or ""
        if hasattr(rule, 'destination_address_prefixes') and rule.destination_address_prefixes:
            dest_prefix = ",".join(rule.destination_address_prefixes)
            
        # Handle ports
        src_port = rule.source_port_range or ""
        if hasattr(rule, 'source_port_ranges') and rule.source_port_ranges:
            src_port = ",".join(rule.source_port_ranges)
            
        dest_port = rule.destination_port_range or ""
        if hasattr(rule, 'destination_port_ranges') and rule.destination_port_ranges:
            dest_port = ",".join(rule.destination_port_ranges)
            
        # Handle ASGs
        src_asgs = []
        if rule.source_application_security_groups:
            src_asgs = [asg.id for asg in rule.source_application_security_groups]
            
        dest_asgs = []
        if rule.destination_application_security_groups:
            dest_asgs = [asg.id for asg in rule.destination_application_security_groups]
            
        converted_rules.append(NSGRule(
            id=rule.id if rule.id else f"rule-{rule.name}",
            name=rule.name,
            priority=rule.priority if rule.priority else 0,
            direction=rule.direction,
            access=rule.access,
            protocol=rule.protocol,
            source_address_prefix=src_prefix,
            source_port_range=src_port,
            destination_address_prefix=dest_prefix,
            destination_port_range=dest_port,
            source_application_security_groups=src_asgs,
            destination_application_security_groups=dest_asgs
        ))
    return converted_rules

def get_subscription_name(credential, subscription_id: str) -> str:
    try:
        sub_client = SubscriptionClient(credential)
        sub = sub_client.subscriptions.get(subscription_id)
        return sub.display_name
    except Exception:
        return "Unknown"

@router.post("/nsg-rules")
async def generate_nsg_rules_report(
    request: ReportRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
) -> Dict[str, Any]:
    """
    Generate a report of NSG rules for the selected NSGs.
    """
    try:
        subscription_id = request.subscription_id or azure_service.subscription_id
        resource_group = request.resource_group
        nsg_names = request.nsg_names

        logger.info(f"NSG Rules Report - Subscription: {subscription_id}, RG: {resource_group}, NSGs: {nsg_names}")

        credential = azure_service.credential
        network_client = NetworkManagementClient(credential, subscription_id)
        subscription_name = get_subscription_name(credential, subscription_id)
        
        raw_nsgs = []
        if resource_group:
            if nsg_names:
                for name in nsg_names:
                    try:
                        nsg = network_client.network_security_groups.get(resource_group, name)
                        raw_nsgs.append(nsg)
                    except Exception as e:
                        logger.warning(f"Could not fetch NSG {name}: {e}")
            else:
                raw_nsgs = list(network_client.network_security_groups.list(resource_group))
        else:
            raw_nsgs = list(network_client.network_security_groups.list_all())
            if nsg_names:
                raw_nsgs = [n for n in raw_nsgs if n.name in nsg_names]

        csv_data = []
        csv_headers = ["Subscription Name", "Subscription ID", "Resource Group", "NSG Name", "Source No of Rules", "Destination No of Rules", "Total User Rules", "Status"]
        
        processed_nsg_data = []
        
        max_rules = 1000
        
        for nsg in raw_nsgs:
            inbound_count = 0
            outbound_count = 0
            user_rules_count = 0
            
            # Count user rules (counted towards limit)
            for rule in (nsg.security_rules or []):
                user_rules_count += 1
                if rule.direction.lower() == 'inbound':
                    inbound_count += 1
                else:
                    outbound_count += 1
            
            # Count default rules (for information, but not for limit)
            # Note: The original report seemed to want total inbound/outbound. 
            # We will include default rules in inbound/outbound counts if that was the intent, 
            # but usually reports focus on user rules. 
            # Let's keep total inbound/outbound including default to match previous behavior for those columns,
            # but add a specific check for user_rules_count for compliance.
            
            default_inbound = 0
            default_outbound = 0
            for rule in (nsg.default_security_rules or []):
                if rule.direction.lower() == 'inbound':
                    default_inbound += 1
                else:
                    default_outbound += 1
            
            total_inbound = inbound_count + default_inbound
            total_outbound = outbound_count + default_outbound
            
            status = "Compliant"
            if user_rules_count > max_rules:
                status = "Non-Compliant"
            elif user_rules_count > (max_rules * 0.8):
                status = "Warning"
            
            processed_nsg_data.append({
                "subscription_name": subscription_name,
                "subscription_id": subscription_id,
                "resource_group": nsg.id.split('/')[4] if nsg.id else resource_group,
                "nsg_name": nsg.name,
                "source_rules": total_inbound,
                "destination_rules": total_outbound,
                "user_rules": user_rules_count,
                "location": nsg.location,
                "status": status
            })
            
            csv_data.append([
                subscription_name,
                subscription_id,
                nsg.id.split('/')[4] if nsg.id else resource_group,
                nsg.name,
                str(total_inbound),
                str(total_outbound),
                str(user_rules_count),
                status
            ])
            
        # Determine global validation status
        validation_status = "compliant"
        non_compliant_count = len([n for n in processed_nsg_data if n['status'] == 'Non-Compliant'])
        warning_count = len([n for n in processed_nsg_data if n['status'] == 'Warning'])
        
        if non_compliant_count > 0:
            validation_status = "non-compliant"
        elif warning_count > 0:
            validation_status = "warning"
        
        # Calculate compliance percentage (by NSG count)
        total_nsgs = len(processed_nsg_data)
        compliant_count = len([n for n in processed_nsg_data if n['status'] == 'Compliant'])
        compliance_percentage = (compliant_count / total_nsgs * 100) if total_nsgs > 0 else 100.0
        
        return {
            "success": True,
            "report_type": "nsg_rules",
            "generated_at": datetime.now().isoformat(),
            "data": {
                "total_nsgs": total_nsgs,
                "max_allowed_user_rules": max_rules,
                "validation_status": validation_status,
                "compliance_percentage": round(compliance_percentage, 2),
                "csv_headers": csv_headers,
                "csv_data": csv_data,
                "summary": {
                    "subscription_name": subscription_name,
                    "subscription_id": subscription_id,
                    "resource_group": resource_group or "All",
                    "nsg_filter": nsg_names if nsg_names else "All",
                    "total_nsgs_found": len(processed_nsg_data),
                    "compliant_nsgs": compliant_count,
                    "warning_nsgs": warning_count,
                    "non_compliant_nsgs": non_compliant_count
                }
            }
        }
    except Exception as e:
        logger.error(f"NSG rules report failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/asg-validation")
async def generate_asg_validation_report(
    request: ReportRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
) -> Dict[str, Any]:
    try:
        subscription_id = request.subscription_id or azure_service.subscription_id
        resource_group = request.resource_group
        nsg_names = request.nsg_names

        credential = azure_service.credential
        network_client = NetworkManagementClient(credential, subscription_id)
        subscription_name = get_subscription_name(credential, subscription_id)

        asg_data = []
        total_asgs = 0
        
        # Pre-fetch relevant NSGs for checking associations
        nsgs_to_check = []
        if resource_group:
            if nsg_names:
                for name in nsg_names:
                    try:
                        nsg = network_client.network_security_groups.get(resource_group, name)
                        nsgs_to_check.append(nsg)
                    except Exception:
                        pass
            else:
                nsgs_to_check = list(network_client.network_security_groups.list(resource_group))
        else:
            # If no RG specified, we might need to scan all NSGs.
            # This can be heavy, but necessary if we want to find associations globally (or within sub).
            nsgs_to_check = list(network_client.network_security_groups.list_all())
            if nsg_names:
                nsgs_to_check = [n for n in nsgs_to_check if n.name in nsg_names]

        # Helper to process ASGs
        def process_asgs(asgs_iterator, current_rg_name):
            nonlocal total_asgs
            for asg in asgs_iterator:
                total_asgs += 1
                source_nsgs = []
                dest_nsgs = []
                
                # Check NSG associations by iterating the pre-fetched NSGs
                for nsg in nsgs_to_check:
                    try:
                        # Optimization: Skip if NSG is in different region? Not necessarily, but usually yes.
                        # For now, check all fetched NSGs.
                        
                        for rule in (nsg.security_rules or []):
                            if rule.source_application_security_groups:
                                for src_asg in rule.source_application_security_groups:
                                    if src_asg.id.lower() == asg.id.lower():
                                        source_nsgs.append(nsg.name)
                            if rule.destination_application_security_groups:
                                for dest_asg in rule.destination_application_security_groups:
                                    if dest_asg.id.lower() == asg.id.lower():
                                        dest_nsgs.append(nsg.name)
                    except Exception:
                        continue
                
                unique_nsgs = sorted(list(set(source_nsgs + dest_nsgs)))
                nsg_display = ", ".join(unique_nsgs) if unique_nsgs else "No NSG associations"

                asg_entry = {
                    "subscription_name": subscription_name,
                    "subscription_id": subscription_id,
                    "resource_group": current_rg_name,
                    "nsg_name": nsg_display,
                    "source_asg": asg.name if source_nsgs else "",
                    "destination_asg": asg.name if dest_nsgs else "",
                    "asg_name": asg.name,
                    "asg_id": asg.id,
                    "location": asg.location
                }
                asg_data.append(asg_entry)

        if resource_group:
            asgs = network_client.application_security_groups.list(resource_group)
            process_asgs(asgs, resource_group)
        else:
            # List all resource groups first
            resource_client = ResourceManagementClient(credential, subscription_id)
            for rg in resource_client.resource_groups.list():
                try:
                    asgs = network_client.application_security_groups.list(rg.name)
                    process_asgs(asgs, rg.name)
                except Exception as e:
                    logger.warning(f"Failed to list ASGs in RG {rg.name}: {e}")

        max_asgs = 100
        validation_status = "compliant" if total_asgs <= max_asgs else "non-compliant"
        
        csv_data = []
        csv_headers = ["Subscription Name", "Subscription ID", "Resource Group", "NSG Name", "Source ASG", "Destination ASG"]
        
        for asg in asg_data:
            csv_data.append([
                asg["subscription_name"],
                asg["subscription_id"],
                asg["resource_group"],
                asg["nsg_name"],
                asg["source_asg"],
                asg["destination_asg"]
            ])

        return {
            "success": True,
            "report_type": "asg_validation",
            "generated_at": datetime.now().isoformat(),
            "data": {
                "total_asgs": total_asgs,
                "max_allowed": max_asgs,
                "validation_status": validation_status,
                "compliance_percentage": round((max_asgs - max(0, total_asgs - max_asgs)) / max_asgs * 100, 2),
                "csv_headers": csv_headers,
                "csv_data": csv_data,
                "summary": {
                    "subscription_name": subscription_name,
                    "subscription_id": subscription_id,
                    "resource_group": resource_group or "All",
                    "nsg_filter": nsg_names if nsg_names else "All",
                    "total_asgs_found": len(asg_data)
                }
            }
        }
    except Exception as e:
        logger.error(f"ASG validation report failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ip-limitations")
async def generate_ip_limitations_report(
    request: ReportRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
) -> Dict[str, Any]:
    try:
        subscription_id = request.subscription_id or azure_service.subscription_id
        resource_group = request.resource_group
        nsg_names = request.nsg_names
        
        credential = azure_service.credential
        network_client = NetworkManagementClient(credential, subscription_id)
        subscription_name = get_subscription_name(credential, subscription_id)
        
        nsgs = []
        if resource_group:
            if nsg_names:
                for name in nsg_names:
                    try:
                        nsg = network_client.network_security_groups.get(resource_group, name)
                        nsgs.append(nsg)
                    except Exception:
                        pass
            else:
                nsgs = list(network_client.network_security_groups.list(resource_group))
        else:
            nsgs = list(network_client.network_security_groups.list_all())
            if nsg_names:
                nsgs = [n for n in nsgs if n.name in nsg_names]
            
        nsg_validator = NSGValidator()
        csv_data = []
        csv_headers = ['Subscription Name', 'Subscription ID', 'Resource Group', 'NSG Name', 'Source IPs + ASGs', 'Destination IPs + ASGs', 'Total IP Count', 'Status']
        
        total_ip_count = 0
        nsg_details = []
        
        for nsg in nsgs:
            try:
                # Convert rules and analyze using NSGValidator
                all_rules = list(nsg.security_rules or []) + list(nsg.default_security_rules or [])
                converted_rules = _convert_to_nsg_rules(all_rules)
                analysis_result = nsg_validator.analyze_nsg_rules_from_demo(converted_rules)
                
                # Manual extraction for CSV display (Lists of IPs/ASGs)
                # We perform this because the Validator summary returns counts, not the full lists of strings needed for the report.
                source_ips_asgs = set()
                dest_ips_asgs = set()
                
                # Helper to process prefix
                def process_prefix(prefix, target_set):
                    if not prefix or prefix == '*': return
                    service_tags = {'VirtualNetwork', 'Internet', 'Any', 'AzureLoadBalancer', 'Storage', 'Sql', 'AzureActiveDirectory'}
                    entries = [e.strip() for e in prefix.split(',')]
                    for entry in entries:
                        if not entry or entry in service_tags: continue
                        target_set.add(entry)

                for rule in all_rules:
                    # Source
                    if hasattr(rule, 'source_address_prefix') and rule.source_address_prefix:
                        process_prefix(rule.source_address_prefix, source_ips_asgs)
                    if hasattr(rule, 'source_address_prefixes') and rule.source_address_prefixes:
                        for p in rule.source_address_prefixes:
                            process_prefix(p, source_ips_asgs)
                    if hasattr(rule, 'source_application_security_groups') and rule.source_application_security_groups:
                        for asg in rule.source_application_security_groups:
                            source_ips_asgs.add(f"ASG:{asg.id.split('/')[-1]}")
                            
                    # Dest
                    if hasattr(rule, 'destination_address_prefix') and rule.destination_address_prefix:
                        process_prefix(rule.destination_address_prefix, dest_ips_asgs)
                    if hasattr(rule, 'destination_address_prefixes') and rule.destination_address_prefixes:
                        for p in rule.destination_address_prefixes:
                            process_prefix(p, dest_ips_asgs)
                    if hasattr(rule, 'destination_application_security_groups') and rule.destination_application_security_groups:
                        for asg in rule.destination_application_security_groups:
                            dest_ips_asgs.add(f"ASG:{asg.id.split('/')[-1]}")

                # Use manual count for total display to match CSV content
                # Note: Summing source and dest sets gives a conservative (higher) count.
                current_nsg_ip_count = len(source_ips_asgs) + len(dest_ips_asgs)
                total_ip_count += current_nsg_ip_count
                
                # Compliance logic: Use Validator's result AND manual count check
                # Validator checks per category (Inbound/Outbound, Source/Dest) against limit (4000)
                violations = analysis_result.get('violations', [])
                ip_violations = [v for v in violations if v.get('type') == 'IP_LIMIT_EXCEEDED']
                
                is_compliant = len(ip_violations) == 0
                if current_nsg_ip_count > 4000:
                    is_compliant = False
                
                status = "Compliant"
                if not is_compliant:
                    status = "Non-Compliant"
                elif current_nsg_ip_count > 3000:
                    status = "Warning"
                
                csv_data.append([
                    subscription_name,
                    subscription_id,
                    nsg.id.split('/')[4] if nsg.id else resource_group,
                    nsg.name,
                    ', '.join(sorted(source_ips_asgs)) if source_ips_asgs else 'None',
                    ', '.join(sorted(dest_ips_asgs)) if dest_ips_asgs else 'None',
                    current_nsg_ip_count,
                    status
                ])
                
                nsg_details.append({
                    "name": nsg.name,
                    "resource_group": nsg.id.split('/')[4] if nsg.id else "Unknown",
                    "location": nsg.location,
                    "total_rules": len(all_rules),
                    "ip_count": current_nsg_ip_count,
                    "compliance_status": "compliant" if is_compliant else "non_compliant",
                    "risk_level": "low" if is_compliant and current_nsg_ip_count <= 2000 else "medium" if is_compliant else "high"
                })
                
            except Exception as e:
                logger.error(f"Error processing NSG {nsg.name}: {e}")
                
        validation_status = "compliant"
        # Check if ANY NSG is non-compliant
        if any(n['compliance_status'] == 'non_compliant' for n in nsg_details):
            validation_status = "non-compliant"
            
        # Calculate overall compliance percentage (percentage of compliant NSGs)
        if nsg_details:
            compliant_count = len([n for n in nsg_details if n['compliance_status'] == 'compliant'])
            compliance_percentage = (compliant_count / len(nsg_details)) * 100
        else:
            compliance_percentage = 100.0

        return {
            "success": True,
            "report_type": "ip_limitations",
            "generated_at": datetime.now().isoformat(),
            "data": {
                "subscription_id": subscription_id,
                "subscription_name": subscription_name,
                "resource_group": resource_group or "All Resource Groups",
                "total_nsgs_analyzed": len(nsgs),
                "total_ip_addresses": total_ip_count,
                "max_ip_limit": 4000,
                "validation_status": validation_status,
                "compliance_percentage": round(compliance_percentage, 2),
                "csv_headers": csv_headers,
                "csv_data": csv_data,
                "nsg_details": nsg_details,
                "summary": {
                    "compliant_nsgs": len([n for n in nsg_details if n['compliance_status'] == 'compliant']),
                    "warning_nsgs": len([n for n in nsg_details if n['risk_level'] == 'medium' and n['compliance_status'] == 'compliant']), # Approximate warning count
                    "non_compliant_nsgs": len([n for n in nsg_details if n['compliance_status'] == 'non_compliant'])
                }
            }
        }
    except Exception as e:
        logger.error(f"IP limitations report failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nsg-ports")
async def generate_nsg_ports_report(
    request: ReportRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
) -> Dict[str, Any]:
    try:
        subscription_id = request.subscription_id or azure_service.subscription_id
        resource_group = request.resource_group
        nsg_names = request.nsg_names
        
        credential = azure_service.credential
        network_client = NetworkManagementClient(credential, subscription_id)
        subscription_name = get_subscription_name(credential, subscription_id)
        
        nsgs = []
        if resource_group:
            if nsg_names:
                for name in nsg_names:
                    try:
                        nsg = network_client.network_security_groups.get(resource_group, name)
                        nsgs.append(nsg)
                    except Exception:
                        pass
            else:
                nsgs = list(network_client.network_security_groups.list(resource_group))
        else:
            nsgs = list(network_client.network_security_groups.list_all())
            if nsg_names:
                nsgs = [n for n in nsgs if n.name in nsg_names]
            
        csv_data = []
        csv_headers = ['Subscription Name', 'Subscription ID', 'Resource Group', 'NSG Name', 'Source Ports', 'Destination Ports', 'User Rule Count', 'Status']
        
        total_inbound_ports = 0
        total_outbound_ports = 0
        
        nsg_compliance_info = []
        MAX_RULES_PER_NSG = 1000
        
        for nsg in nsgs:
            try:
                source_ports = set()
                dest_ports = set()
                # These counts track ports usage across rules
                inbound_port_usage = 0
                outbound_port_usage = 0
                
                # Compliance is based on user defined rules
                user_rules = list(nsg.security_rules or [])
                user_rule_count = len(user_rules)
                
                # For port analysis, we might want to see everything, but usually reports focus on what users configured.
                # However, to be consistent with "NSG Ports", seeing default allowed ports is useful.
                # But for the "Status" calculation, we MUST use user_rule_count.
                all_rules = user_rules + list(nsg.default_security_rules or [])
                
                for rule in all_rules:
                    direction = rule.direction.lower() if hasattr(rule, 'direction') else 'unknown'
                    
                    # Source ports
                    if hasattr(rule, 'source_port_range') and rule.source_port_range and rule.source_port_range != '*':
                        source_ports.add(rule.source_port_range)
                        if direction == 'inbound': inbound_port_usage += 1
                        else: outbound_port_usage += 1
                            
                    if hasattr(rule, 'source_port_ranges') and rule.source_port_ranges:
                        for pr in rule.source_port_ranges:
                            source_ports.add(pr)
                            if direction == 'inbound': inbound_port_usage += 1
                            else: outbound_port_usage += 1

                    # Dest ports
                    if hasattr(rule, 'destination_port_range') and rule.destination_port_range and rule.destination_port_range != '*':
                        dest_ports.add(rule.destination_port_range)
                        if direction == 'inbound': inbound_port_usage += 1
                        else: outbound_port_usage += 1
                            
                    if hasattr(rule, 'destination_port_ranges') and rule.destination_port_ranges:
                        for pr in rule.destination_port_ranges:
                            dest_ports.add(pr)
                            if direction == 'inbound': inbound_port_usage += 1
                            else: outbound_port_usage += 1

                total_inbound_ports += inbound_port_usage
                total_outbound_ports += outbound_port_usage
                
                status = "Compliant"
                if user_rule_count > MAX_RULES_PER_NSG:
                    status = "Non-Compliant"
                elif user_rule_count > (MAX_RULES_PER_NSG * 0.8):
                    status = "Warning"

                csv_data.append([
                    subscription_name,
                    subscription_id,
                    nsg.id.split('/')[4] if nsg.id else resource_group,
                    nsg.name,
                    ', '.join(sorted(source_ports)) if source_ports else 'None',
                    ', '.join(sorted(dest_ports)) if dest_ports else 'None',
                    user_rule_count,
                    status
                ])
                
                nsg_compliance_info.append({
                    "name": nsg.name,
                    "rule_count": user_rule_count,
                    "status": status
                })
                
            except Exception as e:
                logger.error(f"Error processing NSG {nsg.name}: {e}")

        # Validation status for the whole report
        validation_status = "compliant"
        non_compliant_count = len([n for n in nsg_compliance_info if n['status'] == 'Non-Compliant'])
        warning_count = len([n for n in nsg_compliance_info if n['status'] == 'Warning'])
        
        if non_compliant_count > 0:
            validation_status = "non-compliant"
        elif warning_count > 0:
            validation_status = "warning"
            
        # Calculate overall compliance percentage (based on NSGs, not rules)
        total_nsgs = len(nsg_compliance_info)
        compliant_count = len([n for n in nsg_compliance_info if n['status'] == 'Compliant'])
        compliance_percentage = (compliant_count / total_nsgs * 100) if total_nsgs > 0 else 100.0
            
        return {
            "success": True,
            "report_type": "nsg_ports",
            "generated_at": datetime.now().isoformat(),
            "data": {
                "subscription_id": subscription_id,
                "subscription_name": subscription_name,
                "resource_group": resource_group or "All Resource Groups",
                "total_nsgs_analyzed": len(nsgs),
                "total_inbound_ports": total_inbound_ports,
                "total_outbound_ports": total_outbound_ports,
                "max_rules_per_nsg": MAX_RULES_PER_NSG,
                "validation_status": validation_status,
                "compliance_percentage": round(compliance_percentage, 2),
                "csv_headers": csv_headers,
                "csv_data": csv_data,
                "summary": {
                    "compliant_nsgs": compliant_count,
                    "warning_nsgs": warning_count,
                    "non_compliant_nsgs": non_compliant_count
                }
            }
        }
    except Exception as e:
        logger.error(f"NSG ports report failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/consolidation")
async def generate_consolidation_report(
    request: ReportRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
) -> Dict[str, Any]:
    try:
        subscription_id = request.subscription_id or azure_service.subscription_id
        resource_group = request.resource_group
        nsg_names = request.nsg_names
        
        credential = azure_service.credential
        network_client = NetworkManagementClient(credential, subscription_id)
        subscription_name = get_subscription_name(credential, subscription_id)
        
        nsgs = []
        if resource_group:
            if nsg_names:
                for name in nsg_names:
                    try:
                        nsg = network_client.network_security_groups.get(resource_group, name)
                        nsgs.append(nsg)
                    except Exception:
                        pass
            else:
                nsgs = list(network_client.network_security_groups.list(resource_group))
        else:
            nsgs = list(network_client.network_security_groups.list_all())
            if nsg_names:
                nsgs = [n for n in nsgs if n.name in nsg_names]
            
        nsg_validator = NSGValidator()
        consolidation_data = []
        all_opportunities = []
        
        total_rules_analyzed = 0
        total_duplicates_found = 0
        
        csv_data = []
        csv_headers = [
            'Subscription Name', 'Subscription ID', 'Resource Group', 'NSG Name',
            'Total Rules', 'Duplicate Rules', 'Optimization Score', 'Recommendations',
            'Potential Savings (Rules)', 'Risk Level'
        ]
        
        for nsg in nsgs:
            try:
                all_rules = list(nsg.security_rules or []) + list(nsg.default_security_rules or [])
                total_rules_analyzed += len(all_rules)
                converted_rules = _convert_to_nsg_rules(all_rules)
                
                # Analyze using NSGValidator
                analysis_result = nsg_validator.analyze_nsg_rules_from_demo(converted_rules)
                ai_analysis = analysis_result.get('aiAnalysis', {})
                
                redundant_rules = ai_analysis.get('redundantRules', [])
                consolidation_ops = ai_analysis.get('consolidationOpportunities', [])
                
                # Calculate metrics
                duplicate_count = len(redundant_rules)
                total_duplicates_found += duplicate_count
                
                # Calculate potential savings
                potential_savings = 0
                for op in consolidation_ops:
                    savings = op.get('potentialSavings', {}).get('ruleReduction', 0)
                    potential_savings += savings
                
                # Optimization score calculation (simplified based on findings)
                optimization_score = 100
                if duplicate_count > 0:
                    optimization_score -= (duplicate_count * 5)
                if potential_savings > 0:
                    optimization_score -= (potential_savings * 2)
                optimization_score = max(0, optimization_score)
                
                # Risk Level
                risk_level = 'Low'
                if optimization_score < 60: risk_level = 'High'
                elif optimization_score < 80: risk_level = 'Medium'
                
                # Recommendations
                recommendations = []
                if redundant_rules:
                    recommendations.append(f"Remove {len(redundant_rules)} redundant rules")
                for op in consolidation_ops:
                    recommendations.append(op.get('recommendation', 'Consolidate rules'))
                if not recommendations:
                    recommendations.append("No immediate consolidation needed")
                
                # Prepare CSV row
                csv_data.append([
                    subscription_name,
                    subscription_id,
                    nsg.id.split('/')[4] if nsg.id else resource_group,
                    nsg.name,
                    str(len(all_rules)),
                    str(duplicate_count),
                    f"{optimization_score}%",
                    '; '.join(recommendations[:3]), # Limit to top 3 recommendations
                    str(potential_savings),
                    risk_level
                ])
                
                # Collect detailed opportunities for the JSON response
                if redundant_rules or consolidation_ops:
                    all_opportunities.append({
                        'nsg_name': nsg.name,
                        'resource_group': nsg.id.split('/')[4] if nsg.id else resource_group,
                        'redundant_rules': redundant_rules,
                        'consolidation_opportunities': consolidation_ops
                    })
                    
            except Exception as e:
                logger.error(f"Error analyzing NSG {nsg.name} for consolidation: {e}")

        return {
            "success": True,
            "report_type": "consolidation",
            "generated_at": datetime.now().isoformat(),
            "data": {
                "subscription_id": subscription_id,
                "subscription_name": subscription_name,
                "resource_group": resource_group or "All",
                "analysis_summary": {
                    "total_nsgs_analyzed": len(nsgs),
                    "total_rules": total_rules_analyzed,
                    "duplicate_rules_found": total_duplicates_found,
                    "optimization_opportunities": len(all_opportunities)
                },
                "consolidation_opportunities": all_opportunities,
                "csv_headers": csv_headers,
                "csv_data": csv_data
            }
        }
    except Exception as e:
        logger.error(f"Consolidation report failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))