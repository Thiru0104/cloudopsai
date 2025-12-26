from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.azure_service import AzureService
from pydantic import BaseModel

router = APIRouter()

class Location(BaseModel):
    name: str
    display_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    subscription_id: str

class LocationList(BaseModel):
    locations: List[Location]

async def get_azure_service():
    return AzureService()

@router.get("", response_model=LocationList)
async def list_locations(
    subscription_id: Optional[str] = Query(None, description="Subscription ID to filter by"),
    azure_service: AzureService = Depends(get_azure_service)
) -> Any:
    """
    List all locations in a subscription.
    """
    try:
        locs = await azure_service.list_locations(subscription_id)
        return {"locations": locs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
