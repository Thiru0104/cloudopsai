from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Optional, Any
from app.services.azure_service import AzureService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def get_azure_service():
    return AzureService()

@router.get("/storage-accounts")
async def list_storage_accounts(
    subscription_id: Optional[str] = None,
    azure_service: AzureService = Depends(get_azure_service)
):
    """List storage accounts"""
    try:
        storage_accounts = await azure_service.list_storage_accounts(subscription_id)
        return {"storage_accounts": storage_accounts}
    except Exception as e:
        logger.error(f"Error listing storage accounts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/containers")
async def list_containers(
    storage_account: Optional[str] = None,
    azure_service: AzureService = Depends(get_azure_service)
):
    """List containers in a storage account"""
    try:
        containers = await azure_service.list_containers(storage_account_name=storage_account)
        return {"containers": containers}
    except Exception as e:
        logger.error(f"Error listing containers: {e}")
        raise HTTPException(status_code=500, detail=str(e))
