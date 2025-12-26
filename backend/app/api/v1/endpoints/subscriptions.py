from fastapi import APIRouter, Depends, HTTPException
from typing import List, Any, Dict
from pydantic import BaseModel
from app.services.azure_service import AzureService

router = APIRouter()

class Subscription(BaseModel):
    id: str
    display_name: str
    state: str
    tenant_id: str

class SubscriptionList(BaseModel):
    subscriptions: List[Subscription]

@router.get("", response_model=SubscriptionList)
async def list_subscriptions():
    """
    Get all Azure subscriptions accessible by the service principal.
    """
    try:
        azure_service = AzureService()
        subs = await azure_service.list_subscriptions()
        
        return SubscriptionList(subscriptions=[
            Subscription(
                id=sub['id'],
                display_name=sub['display_name'],
                state=sub['state'],
                tenant_id=sub.get('tenant_id', '')
            ) for sub in subs
        ])
    except Exception as e:
        print(f"Error fetching subscriptions: {str(e)}")
        return SubscriptionList(subscriptions=[])
