from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Optional, Any
from app.services.storage_service import StorageService
from app.models.storage import StorageReportResponse, ContainerReportResponse
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def get_storage_service():
    return StorageService()

@router.get("/report", response_model=StorageReportResponse)
async def get_storage_report(
    subscription_id: Optional[str] = None,
    region: Optional[str] = None,
    resource_group: Optional[str] = None,
    account_name: Optional[str] = None,
    storage_service: StorageService = Depends(get_storage_service)
):
    """Get detailed storage report"""
    try:
        report = await storage_service.get_storage_report(subscription_id, region, resource_group, account_name)
        return {"report": report}
    except Exception as e:
        logger.error(f"Error getting storage report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/containers", response_model=ContainerReportResponse)
async def get_containers_report(
    subscription_id: Optional[str] = None,
    region: Optional[str] = None,
    resource_group: Optional[str] = None,
    account_name: Optional[str] = None,
    storage_service: StorageService = Depends(get_storage_service)
):
    """Get detailed container report"""
    try:
        report = await storage_service.get_containers_report(subscription_id, region, resource_group, account_name)
        return {"report": report}
    except Exception as e:
        logger.error(f"Error getting container report: {e}")
        raise HTTPException(status_code=500, detail=str(e))