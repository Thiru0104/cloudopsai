from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Response
from pydantic import BaseModel
import csv
import io
import json
from datetime import datetime

from app.services.azure_service import AzureService
from app.core.config import settings

router = APIRouter()

class BackupCreateRequest(BaseModel):
    backup_name: str
    resource_type: str
    subscription_id: str
    resource_group: Optional[str] = None
    selected_nsgs: List[str]
    storage_account: str
    container_name: str
    backup_format: str = "json"

class ExportRequest(BaseModel):
    selectedSubscription: str
    selectedResourceGroup: Optional[str] = None
    selectedNSGs: List[str]
    selectedASGs: Optional[List[str]] = []
    format: str = "csv"
    separateColumns: bool = True
    includeRuleDetails: bool = True
    resourceType: str = "nsg"
    includeASGMapping: bool = False

class NSGMapping(BaseModel):
    original: str
    new: str
    resourceGroup: str
    location: Optional[str] = None

class BackupFilesRequest(BaseModel):
    storage_account: str
    container_name: str

class RestoreRequest(BaseModel):
    source_type: str
    storage_account: Optional[str] = None
    container_name: Optional[str] = None
    backup_file_name: Optional[str] = None
    csv_file: Optional[str] = None
    subscription_id: str
    target_resource_groups: List[str]
    target_type: str
    create_new_nsgs: bool = False
    new_nsg_names: List[Dict[str, Any]] = []
    overwrite_existing: bool = False
    validate_rules: bool = False
    create_backup_before_restore: bool = False
    edited_rules: List[Dict[str, Any]] = []
    apply_to_all_nsgs: bool = False
    selected_nsgs: List[str] = []

@router.post("/create")
async def create_backup(
    request: BackupCreateRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
):
    """Create a backup of selected NSGs"""
    try:
        results = []
        errors = []
        
        for nsg_name in request.selected_nsgs:
            try:
                # Fetch NSG data
                rg = request.resource_group
                if not rg:
                    # Try to find NSG or error. For now, skipping if no RG.
                    pass 
                
                nsg_data = await azure_service.get_nsg(rg, nsg_name)
                if not nsg_data:
                    errors.append(f"NSG {nsg_name} not found")
                    continue
                
                # Create backup
                backup_url = await azure_service.create_backup(
                    nsg_data, 
                    f"{request.backup_name}-{nsg_name}", 
                    request.container_name, 
                    request.backup_format
                )
                
                if backup_url:
                    results.append(backup_url)
                else:
                    errors.append(f"Failed to create backup for {nsg_name}")
                    
            except Exception as e:
                errors.append(f"Error backing up {nsg_name}: {str(e)}")
        
        if not results and errors:
            raise HTTPException(status_code=500, detail=f"Backup failed: {'; '.join(errors)}")
            
        return {
            "success": True, 
            "backup_file": results[0] if results else None,
            "count": len(results),
            "errors": errors
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export")
async def export_backup(
    request: ExportRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
):
    """Export NSGs to CSV"""
    try:
        all_nsg_data = []
        
        for nsg_name in request.selectedNSGs:
            rg = request.selectedResourceGroup
            if not rg:
                pass
            
            nsg_data = await azure_service.get_nsg(rg, nsg_name)
            if nsg_data:
                all_nsg_data.append(nsg_data)
        
        if not all_nsg_data:
            raise HTTPException(status_code=404, detail="No NSGs found to export")
            
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        if request.format == 'enhanced_csv':
            # Enhanced CSV Header
            headers = [
                "Subscription", "Resource Group", "NSG Name", "Rule Name", "Direction",
                "Priority", "Access", "Protocol", "Source Port", "Destination Port", 
                "Source Address", "Destination Address", "Source ASG", "Destination ASG", "Description"
            ]
            writer.writerow(headers)
            
            for nsg in all_nsg_data:
                # Combine inbound and outbound rules
                inbound = nsg.get("inbound_rules", [])
                outbound = nsg.get("outbound_rules", [])
                
                # Helper to process rules
                def process_rules(rules, direction):
                    for rule in rules:
                        # Handle addresses
                        source_addr = rule.get("source_address_prefix")
                        if not source_addr and rule.get("source_address_prefixes"):
                            source_addr = ",".join(rule.get("source_address_prefixes"))
                            
                        dest_addr = rule.get("destination_address_prefix")
                        if not dest_addr and rule.get("destination_address_prefixes"):
                            dest_addr = ",".join(rule.get("destination_address_prefixes"))
                            
                        # Handle ASGs (if available in rule data)
                        source_asgs = rule.get("source_application_security_groups", [])
                        dest_asgs = rule.get("destination_application_security_groups", [])
                        
                        source_asg_names = [asg.get("id", "").split("/")[-1] for asg in source_asgs] if source_asgs else []
                        dest_asg_names = [asg.get("id", "").split("/")[-1] for asg in dest_asgs] if dest_asgs else []
                        
                        writer.writerow([
                            nsg.get("subscription_id", request.selectedSubscription),
                            nsg.get("resource_group", request.selectedResourceGroup),
                            nsg.get("name"),
                            rule.get("name"),
                            direction,
                            rule.get("priority"),
                            rule.get("access"),
                            rule.get("protocol"),
                            rule.get("source_port_range"),
                            rule.get("destination_port_range"),
                            source_addr,
                            dest_addr,
                            ", ".join(source_asg_names) if source_asg_names else "None",
                            ", ".join(dest_asg_names) if dest_asg_names else "None",
                            rule.get("description", "")
                        ])

                process_rules(inbound, "Inbound")
                process_rules(outbound, "Outbound")
                
        else:
            # Standard CSV Header
            headers = [
                "Subscription", "Resource Group", "NSG Name", "Location",
                "Rule Name", "Priority", "Direction", "Access", "Protocol",
                "Source Port", "Destination Port", "Source Address", "Destination Address"
            ]
            writer.writerow(headers)
            
            for nsg in all_nsg_data:
                rules = nsg.get("inbound_rules", []) + nsg.get("outbound_rules", [])
                for rule in rules:
                    source_address = rule.get("source_address_prefix")
                    if not source_address and rule.get("source_address_prefixes"):
                        source_address = ",".join(rule.get("source_address_prefixes"))
                        
                    dest_address = rule.get("destination_address_prefix")
                    if not dest_address and rule.get("destination_address_prefixes"):
                        dest_address = ",".join(rule.get("destination_address_prefixes"))
                    
                    writer.writerow([
                        nsg.get("subscription_id", request.selectedSubscription),
                        nsg.get("resource_group", request.selectedResourceGroup),
                        nsg.get("name"),
                        nsg.get("location"),
                        rule.get("name"),
                        rule.get("priority"),
                        rule.get("direction"),
                        rule.get("access"),
                        rule.get("protocol"),
                        rule.get("source_port_range"),
                        rule.get("destination_port_range"),
                        source_address,
                        dest_address
                    ])
        
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=nsg_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/files")
async def list_backup_files(
    request: BackupFilesRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
):
    """List backup files in storage container"""
    try:
        files = await azure_service.list_blobs(request.container_name, request.storage_account)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore/preview")
async def preview_restore(
    request: RestoreRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
):
    try:
        rules = request.edited_rules or []
        error = None
        content = None
        
        # If rules are already provided, just return them (maybe for re-validation?)
        if rules:
             return {"preview": {"rules": rules, "error": None}}

        # Fetch content based on source type
        if request.source_type == 'storage':
            if not request.storage_account or not request.container_name or not request.backup_file_name:
                 raise HTTPException(status_code=400, detail="Missing storage details")
            try:
                content = await azure_service.read_blob_content(request.container_name, request.backup_file_name, request.storage_account)
            except Exception as e:
                error = f"Failed to read backup file from storage: {str(e)}"
                return {"preview": {"rules": [], "error": error}}
                
        elif request.source_type == 'csv':
            if not request.csv_file:
                 # It's possible the user selected CSV but hasn't uploaded yet, or something went wrong
                 error = "No CSV file content provided"
                 return {"preview": {"rules": [], "error": error}}
            content = request.csv_file

        if content:
            try:
                # Determine format (JSON or CSV)
                is_json = False
                if request.source_type == 'storage' and request.backup_file_name.lower().endswith('.json'):
                    is_json = True
                elif request.source_type == 'json': # Fallback
                    is_json = True
                
                parsed_rules = []
                
                if is_json:
                    data = json.loads(content)
                    # Handle different JSON structures (list of rules, or NSG object)
                    # Structure depends on how backup was created.
                    # Usually backups are list of NSGs or single NSG.
                    
                    # Normalizing to a list of rules
                    # This logic needs to match how backups are structured
                    
                    # Case 1: Root is list of NSGs
                    nsgs_list = []
                    if isinstance(data, list):
                        nsgs_list = data
                    elif isinstance(data, dict):
                         if "securityRules" in data: # Single NSG raw definition
                             nsgs_list = [data]
                         elif "value" in data and isinstance(data["value"], list): # Azure Resource Graph / List style
                             nsgs_list = data["value"]
                         elif "configuration" in data: # Custom backup format from earlier code
                             # This might be single NSG wrapper
                             nsgs_list = [data["configuration"]] # simplified assumption
                         else:
                             # treat as single NSG object if it looks like one
                             nsgs_list = [data]

                    for nsg in nsgs_list:
                        nsg_name = nsg.get("name", "Unknown")
                        
                        # Extract rules
                        # Standard Azure NSG JSON has "properties" -> "securityRules"
                        # Or flat "securityRules"
                        
                        rules_list = []
                        if "properties" in nsg and "securityRules" in nsg["properties"]:
                             rules_list = nsg["properties"]["securityRules"]
                        elif "securityRules" in nsg:
                             rules_list = nsg["securityRules"]
                        elif "inbound_rules" in nsg or "outbound_rules" in nsg: # Custom format
                             rules_list = (nsg.get("inbound_rules", []) + nsg.get("outbound_rules", []))
                        
                        for rule in rules_list:
                            # Normalize rule object
                            props = rule.get("properties", rule) # Unwrap properties if present
                            
                            rule_obj = {
                                "name": rule.get("name", props.get("name")),
                                "priority": props.get("priority"),
                                "direction": props.get("direction"),
                                "access": props.get("access"),
                                "protocol": props.get("protocol"),
                                "sourceAddressPrefix": props.get("sourceAddressPrefix", props.get("source_address_prefix")),
                                "sourcePortRange": props.get("sourcePortRange", props.get("source_port_range")),
                                "destinationAddressPrefix": props.get("destinationAddressPrefix", props.get("destination_address_prefix")),
                                "destinationPortRange": props.get("destinationPortRange", props.get("destination_port_range")),
                                "description": props.get("description"),
                                "nsg_name": nsg_name
                            }
                            parsed_rules.append(rule_obj)

                else:
                    # Assume CSV
                    # Remove BOM if present
                    if content.startswith('\ufeff'):
                        content = content[1:]
                        
                    csv_reader = csv.DictReader(io.StringIO(content))
                    
                    for row in csv_reader:
                        # Helper to safely get value with multiple potential keys
                        def get_val(keys, default=None):
                            for k in keys:
                                if k in row and row[k]:
                                    return row[k]
                            return default

                        rule_obj = {
                            "name": get_val(["Rule Name", "name", "Name"]),
                            "priority": int(get_val(["Priority", "priority"], 1000)),
                            "direction": get_val(["Direction", "direction"]),
                            "access": get_val(["Access", "access"]),
                            "protocol": get_val(["Protocol", "protocol"]),
                            "sourceAddressPrefix": get_val(["Source Address", "source_address_prefix", "SourceAddressPrefix"]),
                            "sourcePortRange": get_val(["Source Port", "source_port_range", "SourcePortRange"]),
                            "destinationAddressPrefix": get_val(["Destination Address", "destination_address_prefix", "DestinationAddressPrefix"]),
                            "destinationPortRange": get_val(["Destination Port", "destination_port_range", "DestinationPortRange"]),
                            # Add snake_case keys for frontend compatibility (View Mode uses snake_case)
                            "source_address_prefix": get_val(["Source Address", "source_address_prefix", "SourceAddressPrefix"]),
                            "source_port_range": get_val(["Source Port", "source_port_range", "SourcePortRange"]),
                            "destination_address_prefix": get_val(["Destination Address", "destination_address_prefix", "DestinationAddressPrefix"]),
                            "destination_port_range": get_val(["Destination Port", "destination_port_range", "DestinationPortRange"]),
                            "description": get_val(["Description", "description"]),
                            "nsg_name": get_val(["NSG Name", "nsg_name", "NSGName"])
                        }
                        parsed_rules.append(rule_obj)
                
                rules = parsed_rules
                
            except Exception as e:
                error = f"Failed to parse content: {str(e)}"
        
        return {
            "preview": {
                "rules": rules,
                "error": error
            }
        }
    except Exception as e:
        # Log the full error for server-side debugging
        print(f"Preview Error: {e}") 
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore/confirm")
async def confirm_restore(
    request: RestoreRequest,
    azure_service: AzureService = Depends(lambda: AzureService())
):
    """Restore NSGs from backup or CSV"""
    try:
        rules_to_restore = request.edited_rules
        
        # If rules are not provided in request (e.g. from preview), parse from CSV
        if not rules_to_restore and request.csv_file:
            # Parse CSV content
            csv_reader = csv.DictReader(io.StringIO(request.csv_file))
            rules_to_restore = list(csv_reader)
            
        restored_count = 0
        rules_processed_count = 0
        nsgs_created_count = 0
        
        # Group rules by NSG
        nsg_rules = {}
        for rule in rules_to_restore:
            # Determine NSG name
            nsg_name = rule.get("NSG Name") or rule.get("nsg_name")
            if not nsg_name:
                continue
                
            if nsg_name not in nsg_rules:
                nsg_rules[nsg_name] = {"inbound": [], "outbound": []}
            
            # Create rule object
            # Map CSV columns to API fields
            # Handle both Standard and Enhanced CSV headers
            
            # Helper to parse potential lists (comma separated)
            def parse_csv_list(value):
                if not value:
                    return None
                if ',' in str(value):
                    return [x.strip() for x in str(value).split(',')]
                return str(value)

            raw_source_port = rule.get("Source Port") or rule.get("source_port_range")
            raw_dest_port = rule.get("Destination Port") or rule.get("destination_port_range")
            raw_source_addr = rule.get("Source Address") or rule.get("source_address_prefix")
            raw_dest_addr = rule.get("Destination Address") or rule.get("destination_address_prefix")

            # Normalize direction
            raw_direction = rule.get("Direction") or rule.get("direction")
            direction = "Inbound"
            if raw_direction and raw_direction.lower() == "outbound":
                direction = "Outbound"
            elif raw_direction and raw_direction.lower() == "inbound":
                direction = "Inbound"

            rule_obj = {
                "name": rule.get("Rule Name") or rule.get("name"),
                "priority": int(rule.get("Priority") or rule.get("priority") or 1000),
                "direction": direction,
                "access": rule.get("Access") or rule.get("access"),
                "protocol": rule.get("Protocol") or rule.get("protocol"),
                "source_port_range": raw_source_port,
                "destination_port_range": raw_dest_port,
                "source_address_prefix": raw_source_addr,
                "destination_address_prefix": raw_dest_addr,
                "description": rule.get("Description") or rule.get("description")
            }

            # Handle multi-value fields (ports and addresses)
            parsed_source_ports = parse_csv_list(raw_source_port)
            if isinstance(parsed_source_ports, list):
                rule_obj["source_port_ranges"] = parsed_source_ports
                rule_obj["source_port_range"] = None
            
            parsed_dest_ports = parse_csv_list(raw_dest_port)
            if isinstance(parsed_dest_ports, list):
                rule_obj["destination_port_ranges"] = parsed_dest_ports
                rule_obj["destination_port_range"] = None
                
            parsed_source_addrs = parse_csv_list(raw_source_addr)
            if isinstance(parsed_source_addrs, list):
                rule_obj["source_address_prefixes"] = parsed_source_addrs
                rule_obj["source_address_prefix"] = None
                
            parsed_dest_addrs = parse_csv_list(raw_dest_addr)
            if isinstance(parsed_dest_addrs, list):
                rule_obj["destination_address_prefixes"] = parsed_dest_addrs
                rule_obj["destination_address_prefix"] = None
            
            # Handle ASGs if present (Enhanced CSV)
            if rule.get("Source ASG") and rule.get("Source ASG") != "None":
                 # Logic to resolve ASG IDs would be needed here, for now just passing names?
                 # Azure API needs IDs. This is complex if we only have names.
                 # We might need to look them up.
                 pass

            if rule_obj["direction"] == "Inbound":
                nsg_rules[nsg_name]["inbound"].append(rule_obj)
            else:
                nsg_rules[nsg_name]["outbound"].append(rule_obj)
        
        results = []
        
        # Process each NSG
        for nsg_name, rules in nsg_rules.items():
            # Determine list of targets for this NSG
            targets = []
            
            # Strategy 1: Explicit Mapping (Prioritized)
            mapped = False
            if request.new_nsg_names:
                # Convert to list of dicts if it's not already (it's a list of Pydantic models)
                mappings = [m.dict() if hasattr(m, 'dict') else m for m in request.new_nsg_names]
                
                strict_mappings = [m for m in mappings if m.get("original") == nsg_name]
                for m in strict_mappings:
                    mapped = True
                    targets.append({
                        "rg": m.get("resourceGroup"),
                        "nsg": m.get("new") or m.get("nsgName") or nsg_name,
                        "location": m.get("location", "eastus"),
                        "create": request.create_new_nsgs
                    })
            
            # Strategy 2: Implicit/Broadcast (if no explicit mapping found)
            if not mapped and request.target_resource_groups:
                for rg in request.target_resource_groups:
                    targets.append({
                        "rg": rg,
                        "nsg": nsg_name, # Keep same name
                        "location": "eastus",
                        "create": request.create_new_nsgs
                    })

            if not targets:
                 print(f"No targets found for NSG {nsg_name}")
                 continue

            for target in targets:
                target_rg = target["rg"]
                target_nsg_name = target["nsg"]
                location = target["location"]
                
                if target.get("create"):
                    # Create NSG if it doesn't exist
                    await azure_service.create_nsg(
                        resource_group=target_rg,
                        nsg_name=target_nsg_name,
                        location=location
                    )
                    nsgs_created_count += 1

                # Update rules
                # Call Azure Service
                await azure_service.update_nsg_rules(
                    resource_group=target_rg,
                    nsg_name=target_nsg_name,
                    inbound_rules=rules["inbound"],
                    outbound_rules=rules["outbound"]
                )
                results.append(f"Restored {nsg_name} to {target_nsg_name} in {target_rg}")
                restored_count += 1
                rules_processed_count += len(rules["inbound"]) + len(rules["outbound"])

        return {
            "success": True,
            "message": f"Restored {restored_count} NSGs",
            "details": results,
            "restored_rules_count": rules_processed_count,
            "nsgs_created": nsgs_created_count
        }
        
    except Exception as e:
        # print(f"Restore Error: {e}")
        # traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))





