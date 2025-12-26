from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json
from pydantic import BaseModel

from app.core.database import get_db
from app.services.azure_service import AzureService
from app.models.nsg import NSG, NSGBackup, NSGChange, GoldenRule
from app.schemas.nsg import (
    NSGCreate, NSGUpdate, NSGResponse, 
    BackupCreate, BackupResponse, 
    ChangeResponse, GoldenRuleCreate, GoldenRuleResponse,
    ComplianceAnalysis
)

router = APIRouter()
azure_service = AzureService()

class NSGListResponse(BaseModel):
    nsgs: List[NSGResponse]

@router.get("", response_model=NSGListResponse)
async def list_nsgs(
    subscription_id: Optional[str] = Query(None, description="Azure subscription ID"),
    resource_group: Optional[str] = Query(None, description="Filter by resource group"),
    region: Optional[str] = Query(None, description="Filter by region/location"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    db: AsyncSession = Depends(get_db)
):
    """List all NSGs with optional filtering"""
    try:
        # Get NSGs from Azure
        azure_nsgs = await azure_service.list_nsgs(resource_group, subscription_id)
        
        # Sync with database
        nsg_responses = []
        db_nsgs_to_refresh = []
        
        for azure_nsg in azure_nsgs:
            # Check if NSG exists in database
            result = await db.execute(select(NSG).filter(NSG.azure_id == azure_nsg["id"]))
            db_nsg = result.scalar_one_or_none()
            
            if db_nsg:
                # Update existing NSG
                db_nsg.name = azure_nsg["name"]
                db_nsg.resource_group = azure_nsg["resource_group"]
                db_nsg.region = azure_nsg["location"]
                db_nsg.inbound_rules = azure_nsg["inbound_rules"]
                db_nsg.outbound_rules = azure_nsg["outbound_rules"]
                db_nsg.tags = azure_nsg["tags"]

                db_nsg.last_sync = datetime.utcnow()
            else:
                # Create new NSG
                db_nsg = NSG(
                    name=azure_nsg["name"],
                    resource_group=azure_nsg["resource_group"],
                    region=azure_nsg["location"],
                    subscription_id=azure_nsg["subscription_id"],
                    azure_id=azure_nsg["id"],
                    inbound_rules=azure_nsg["inbound_rules"],
                    outbound_rules=azure_nsg["outbound_rules"],
                    tags=azure_nsg["tags"]
                )
                db.add(db_nsg)
            
            db_nsgs_to_refresh.append(db_nsg)
        
        # Commit all changes at once
        await db.commit()
        
        # Refresh all NSGs and build response
        for db_nsg in db_nsgs_to_refresh:
            await db.refresh(db_nsg)
            
            # Apply filters
            if risk_level and db_nsg.risk_level != risk_level:
                continue
            if region and db_nsg.region != region:
                continue
                
            nsg_responses.append(NSGResponse(**db_nsg.to_dict()))
        
        return NSGListResponse(nsgs=nsg_responses)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list NSGs: {str(e)}")

@router.get("/subscriptions")
async def list_subscriptions():
    """List all available Azure subscriptions"""
    try:
        subscriptions = await azure_service.list_subscriptions()
        return {"subscriptions": subscriptions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subscriptions: {str(e)}")

@router.get("/resource-groups")
async def list_resource_groups(
    subscription_id: Optional[str] = Query(None, description="Azure subscription ID")
):
    """List all resource groups in a subscription"""
    try:
        resource_groups = await azure_service.list_resource_groups(subscription_id)
        return {"resource_groups": resource_groups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch resource groups: {str(e)}")

@router.get("/locations")
async def list_locations(
    subscription_id: Optional[str] = Query(None, description="Azure subscription ID")
):
    """List all available Azure locations/regions for a subscription"""
    try:
        locations = await azure_service.list_locations(subscription_id)
        return {"locations": locations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch locations: {str(e)}")

@router.get("/{nsg_id}", response_model=NSGResponse)
async def get_nsg(nsg_id: int, db: AsyncSession = Depends(get_db)):
    """Get specific NSG by ID"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        # Sync with Azure
        azure_nsg = await azure_service.get_nsg(nsg.resource_group, nsg.name)
        if azure_nsg:
            nsg.inbound_rules = azure_nsg["inbound_rules"]
            nsg.outbound_rules = azure_nsg["outbound_rules"]
            nsg.tags = azure_nsg["tags"]
            nsg.last_sync = datetime.utcnow()
            await db.commit()
            await db.refresh(nsg)
        
        return NSGResponse(**nsg.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get NSG: {str(e)}")

@router.put("/{nsg_id}/rules")
async def update_nsg_rules(
    nsg_id: int,
    inbound_rules: List[Dict],
    outbound_rules: List[Dict],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Update NSG security rules"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        # Create state snapshot before changes
        current_state = nsg.to_dict()
        snapshot = await azure_service.create_state_snapshot(
            current_state, "update", "api_user", "Rule update via API"
        )
        
        # Update rules in Azure
        success = await azure_service.update_nsg_rules(
            nsg.resource_group, nsg.name, inbound_rules, outbound_rules
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update NSG rules in Azure")
        
        # Update database
        nsg.inbound_rules = inbound_rules
        nsg.outbound_rules = outbound_rules
        nsg.updated_at = datetime.utcnow()
        
        # Record change
        change = NSGChange(
            nsg_id=nsg.id,
            change_type="update",
            previous_state=current_state,
            new_state=nsg.to_dict(),
            changes_summary=f"Updated {len(inbound_rules)} inbound and {len(outbound_rules)} outbound rules",
            changed_by="api_user",
            can_rollback=True
        )
        db.add(change)
        await db.commit()
        
        return {"message": "NSG rules updated successfully", "nsg_id": nsg_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update NSG rules: {str(e)}")

@router.post("/{nsg_id}/backup", response_model=BackupResponse)
async def create_backup(
    nsg_id: int,
    backup_data: BackupCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Create backup of NSG configuration"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        # Get current NSG data
        # Fetch live NSG details from Azure to ensure prefix arrays are included
        azure_nsg = await azure_service.get_nsg(nsg.resource_group, nsg.name)
        nsg_data = azure_nsg or nsg.to_dict()
        
        # Create backup in Azure blob storage
        blob_url = await azure_service.create_backup(
            nsg_data, backup_data.backup_name
        )
        
        if not blob_url:
            raise HTTPException(status_code=500, detail="Failed to create backup in blob storage")
        
        # Save backup record to database
        backup = NSGBackup(
            nsg_id=nsg.id,
            backup_name=backup_data.backup_name,
            backup_type=backup_data.backup_type,
            configuration=nsg_data,
            blob_url=blob_url,
            created_by=backup_data.created_by,
            description=backup_data.description
        )
        db.add(backup)
        
        # Update NSG last backup timestamp
        nsg.last_backup = datetime.utcnow()
        
        # Record change
        change = NSGChange(
            nsg_id=nsg.id,
            change_type="backup",
            new_state=nsg_data,
            changes_summary=f"Created backup: {backup_data.backup_name}",
            changed_by=backup_data.created_by,
            can_rollback=False
        )
        db.add(change)
        
        await db.commit()
        await db.refresh(backup)
        
        return BackupResponse(**backup.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create backup: {str(e)}")

@router.post("/{nsg_id}/restore/{backup_id}")
async def restore_backup(
    nsg_id: int,
    backup_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Restore NSG from backup"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        result = await db.execute(select(NSGBackup).filter(NSGBackup.id == backup_id, NSGBackup.nsg_id == nsg_id))
        backup = result.scalar_one_or_none()
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        
        # Create state snapshot before restore
        current_state = nsg.to_dict()
        snapshot = await azure_service.create_state_snapshot(
            current_state, "restore", "api_user", f"Restore from backup: {backup.backup_name}"
        )
        
        # Restore from Azure blob storage
        success = await azure_service.restore_backup(
            backup.blob_url, nsg.resource_group, nsg.name
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to restore NSG from backup")
        
        # Refresh NSG from Azure post-restore to ensure prefix arrays are captured
        live_nsg = await azure_service.get_nsg(nsg.resource_group, nsg.name)
        if live_nsg:
            nsg.inbound_rules = live_nsg.get("inbound_rules", [])
            nsg.outbound_rules = live_nsg.get("outbound_rules", [])
        else:
            # Fallback to backup configuration if live fetch fails
            restored_config = backup.configuration
            nsg.inbound_rules = restored_config.get("inbound_rules", [])
            nsg.outbound_rules = restored_config.get("outbound_rules", [])
        nsg.updated_at = datetime.utcnow()
        
        # Record change
        change = NSGChange(
            nsg_id=nsg.id,
            change_type="restore",
            previous_state=current_state,
            new_state=nsg.to_dict(),
            changes_summary=f"Restored from backup: {backup.backup_name}",
            changed_by="api_user",
            can_rollback=True,
            rollback_backup_id=backup.id
        )
        db.add(change)
        await db.commit()
        
        return {"message": "NSG restored successfully", "backup_name": backup.backup_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {str(e)}")

@router.post("/{nsg_id}/export")
async def export_nsg_config(
    nsg_id: int,
    filename: str,
    db: AsyncSession = Depends(get_db)
):
    """Export NSG configuration to CSV"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        # Prefer live NSG data from Azure to ensure prefix arrays are present
        azure_nsg = await azure_service.get_nsg(nsg.resource_group, nsg.name)
        nsg_data = azure_nsg or nsg.to_dict()

        # Delegate CSV generation to the Azure service which expands all prefixes
        blob_url = await azure_service.export_to_csv(nsg_data, filename, container_name="nsg-exports")

        if not blob_url:
            raise HTTPException(status_code=500, detail="Failed to export NSG configuration")
        
        return {"message": "NSG configuration exported successfully", "download_url": blob_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export NSG: {str(e)}")

@router.post("/{nsg_id}/compliance", response_model=ComplianceAnalysis)
async def analyze_compliance(
    nsg_id: int,
    golden_rule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Analyze NSG compliance against golden rules"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        result = await db.execute(select(GoldenRule).filter(GoldenRule.id == golden_rule_id))
        golden_rule = result.scalar_one_or_none()
        if not golden_rule:
            raise HTTPException(status_code=404, detail="Golden rule not found")
        
        nsg_data = nsg.to_dict()
        golden_rules_data = golden_rule.to_dict()
        
        analysis = await azure_service.analyze_compliance(nsg_data, golden_rules_data)
        
        # Update NSG compliance score
        nsg.compliance_score = analysis["compliance_score"]
        nsg.risk_level = analysis["risk_level"]
        await db.commit()
        
        return ComplianceAnalysis(**analysis)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze compliance: {str(e)}")

@router.get("/{nsg_id}/changes", response_model=List[ChangeResponse])
async def get_nsg_changes(
    nsg_id: int,
    limit: int = Query(10, description="Number of changes to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get change history for NSG"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        result = await db.execute(
            select(NSGChange).filter(
                NSGChange.nsg_id == nsg_id
            ).order_by(NSGChange.changed_at.desc()).limit(limit)
        )
        changes = result.scalars().all()
        
        return [ChangeResponse(**change.to_dict()) for change in changes]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get NSG changes: {str(e)}")

@router.post("/{nsg_id}/rollback/{change_id}")
async def rollback_change(
    nsg_id: int,
    change_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Rollback NSG to a previous state"""
    try:
        result = await db.execute(select(NSG).filter(NSG.id == nsg_id))
        nsg = result.scalar_one_or_none()
        if not nsg:
            raise HTTPException(status_code=404, detail="NSG not found")
        
        result = await db.execute(
            select(NSGChange).filter(
                NSGChange.id == change_id, 
                NSGChange.nsg_id == nsg_id,
                NSGChange.can_rollback == True
            )
        )
        change = result.scalar_one_or_none()
        
        if not change:
            raise HTTPException(status_code=404, detail="Change not found or cannot be rolled back")
        
        if not change.previous_state:
            raise HTTPException(status_code=400, detail="No previous state available for rollback")
        
        # Create state snapshot before rollback
        current_state = nsg.to_dict()
        snapshot = await azure_service.create_state_snapshot(
            current_state, "rollback", "api_user", f"Rollback to change: {change.change_type}"
        )
        
        # Restore previous state
        previous_config = change.previous_state
        success = await azure_service.update_nsg_rules(
            nsg.resource_group, nsg.name,
            previous_config.get("inbound_rules", []),
            previous_config.get("outbound_rules", [])
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to rollback NSG")
        
        # Update database
        nsg.inbound_rules = previous_config.get("inbound_rules", [])
        nsg.outbound_rules = previous_config.get("outbound_rules", [])
        nsg.updated_at = datetime.utcnow()
        
        # Record rollback change
        rollback_change = NSGChange(
            nsg_id=nsg.id,
            change_type="rollback",
            previous_state=current_state,
            new_state=nsg.to_dict(),
            changes_summary=f"Rolled back to change: {change.change_type}",
            changed_by="api_user",
            can_rollback=False
        )
        db.add(rollback_change)
        await db.commit()
        
        return {"message": "NSG rolled back successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rollback NSG: {str(e)}")

# Golden Rules endpoints
@router.get("/golden-rules/", response_model=List[GoldenRuleResponse])
async def list_golden_rules(db: AsyncSession = Depends(get_db)):
    """List all golden rules"""
    try:
        result = await db.execute(select(GoldenRule).filter(GoldenRule.is_active == True))
        golden_rules = result.scalars().all()
        return [GoldenRuleResponse(**rule.to_dict()) for rule in golden_rules]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list golden rules: {str(e)}")

@router.post("/golden-rules/", response_model=GoldenRuleResponse)
async def create_golden_rule(
    golden_rule_data: GoldenRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new golden rule"""
    try:
        golden_rule = GoldenRule(
            name=golden_rule_data.name,
            description=golden_rule_data.description,
            inbound_rules=golden_rule_data.inbound_rules,
            outbound_rules=golden_rule_data.outbound_rules,
            compliance_rules=golden_rule_data.compliance_rules,
            created_by=golden_rule_data.created_by
        )
        db.add(golden_rule)
        await db.commit()
        await db.refresh(golden_rule)
        
        return GoldenRuleResponse(**golden_rule.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create golden rule: {str(e)}")

@router.get("/golden-rules/{rule_id}", response_model=GoldenRuleResponse)
async def get_golden_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    """Get specific golden rule"""
    try:
        result = await db.execute(select(GoldenRule).filter(GoldenRule.id == rule_id))
        golden_rule = result.scalar_one_or_none()
        if not golden_rule:
            raise HTTPException(status_code=404, detail="Golden rule not found")
        
        return GoldenRuleResponse(**golden_rule.to_dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get golden rule: {str(e)}")

# Dashboard endpoints
@router.get("/dashboard/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Get dashboard statistics"""
    try:
        total_nsgs_result = await db.execute(select(NSG))
        total_nsgs = len(total_nsgs_result.scalars().all())
        
        high_risk_result = await db.execute(select(NSG).filter(NSG.risk_level.in_(["high", "critical"])))
        high_risk_nsgs = len(high_risk_result.scalars().all())
        
        compliant_result = await db.execute(select(NSG).filter(NSG.compliance_score >= 80))
        compliant_nsgs = len(compliant_result.scalars().all())
        
        recent_backups_result = await db.execute(
            select(NSGBackup).filter(
                NSGBackup.created_at >= datetime.utcnow() - timedelta(days=7)
            )
        )
        recent_backups = len(recent_backups_result.scalars().all())
        
        return {
            "total_nsgs": total_nsgs,
            "high_risk_nsgs": high_risk_nsgs,
            "compliant_nsgs": compliant_nsgs,
            "recent_backups": recent_backups,
            "compliance_rate": (compliant_nsgs / total_nsgs * 100) if total_nsgs > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard stats: {str(e)}")

@router.get("/audit/recent")
async def get_recent_activity(limit: int = Query(10, description="Number of activities to return"), db: AsyncSession = Depends(get_db)):
    """Get recent activity across all NSGs"""
    try:
        result = await db.execute(
            select(NSGChange).order_by(NSGChange.changed_at.desc()).limit(limit)
        )
        changes = result.scalars().all()
        
        activities = []
        for change in changes:
            nsg_result = await db.execute(select(NSG).filter(NSG.id == change.nsg_id))
            nsg = nsg_result.scalar_one_or_none()
            if nsg:
                activities.append({
                    "id": change.id,
                    "timestamp": change.changed_at.isoformat() if change.changed_at else None,
                    "user": change.changed_by,
                    "action": change.change_type,
                    "resource": nsg.name,
                    "status": "Success"
                })
        
        return activities
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recent activity: {str(e)}")