from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, Optional
from app.services.storage_validation import StorageValidator
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def get_storage_validator():
    return StorageValidator()

@router.get("/validation", response_model=Dict[str, Any])
async def validate_storage(
    subscription_id: str = Query(..., description="Azure Subscription ID"),
    resource_group: Optional[str] = Query(None, description="Azure Resource Group Name"),
    validator: StorageValidator = Depends(get_storage_validator)
):
    """
    Validate storage accounts and containers.
    Returns statistical analysis and lists of problematic resources.
    """
    try:
        result = await validator.validate_storage(subscription_id, resource_group)
        return result
    except Exception as e:
        logger.error(f"Error validating storage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validation/recommendations", response_model=Dict[str, Any])
async def get_storage_recommendations(
    validation_data: Dict[str, Any],
    validator: StorageValidator = Depends(get_storage_validator)
):
    """
    Generate LLM recommendations based on validation data.
    """
    try:
        recommendations = await validator.generate_llm_recommendations(validation_data)
        return recommendations
    except Exception as e:
        logger.error(f"Error generating storage recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))
