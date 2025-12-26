from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.services.azure_service import AzureService

router = APIRouter()

class Route(BaseModel):
    id: str
    name: str
    address_prefix: Optional[str] = None
    next_hop_type: Optional[str] = None
    next_hop_ip_address: Optional[str] = None
    provisioning_state: Optional[str] = None

class RouteTable(BaseModel):
    id: str
    name: str
    location: str
    resource_group: str
    subscription_id: str
    provisioning_state: str
    tags: Dict[str, str] = {}
    routes: List[Route] = []

class RouteTableListResponse(BaseModel):
    route_tables: List[RouteTable]

@router.get("", response_model=RouteTableListResponse)
async def list_route_tables(
    subscription_id: Optional[str] = Query(None, description="Azure Subscription ID"),
    resource_group: Optional[str] = Query(None, description="Resource Group name")
):
    """
    List Route Tables, optionally filtered by subscription and resource group.
    """
    try:
        azure_service = AzureService()
        route_tables_data = await azure_service.list_route_tables(
            subscription_id=subscription_id,
            resource_group=resource_group
        )
        return RouteTableListResponse(route_tables=route_tables_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
