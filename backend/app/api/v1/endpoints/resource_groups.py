from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.azure_service import AzureService
from pydantic import BaseModel

router = APIRouter()

class ResourceGroup(BaseModel):
    name: str
    location: str
    id: str
    subscription_id: str
    provisioning_state: str
    tags: Dict[str, Any]

class ResourceGroupList(BaseModel):
    resource_groups: List[ResourceGroup]

async def get_azure_service():
    return AzureService()

@router.get("", response_model=ResourceGroupList)
async def list_resource_groups(
    subscription_id: Optional[str] = Query(None, description="Subscription ID to filter by"),
    azure_service: AzureService = Depends(get_azure_service)
) -> Any:
    """
    List all resource groups in a subscription.
    """
    try:
        rgs = await azure_service.list_resource_groups(subscription_id)
        return {"resource_groups": rgs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
