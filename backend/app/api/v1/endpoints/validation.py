from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List
from app.services.nsg_validation import NSGValidator

router = APIRouter()
validator = NSGValidator()

@router.get("/nsg-validation/{nsg_name}")
def validate_nsg(
    nsg_name: str,
    subscription_id: str = Query(..., description="Azure Subscription ID"),
    resource_group: str = Query(..., description="Azure Resource Group Name")
) -> Dict[str, Any]:
    """
    Validate NSG rules and return analysis results.
    """
    try:
        print(f"Validating NSG: {nsg_name} in RG: {resource_group}")
        result = validator.analyze_nsg_rules(subscription_id, resource_group, nsg_name)
        if result is None:
            print("WARNING: analyze_nsg_rules returned None")
            raise ValueError("Analysis result is None")
        return result
    except Exception as e:
        print(f"Error validating NSG: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nsg-recommendations/{nsg_name}")
async def get_recommendations(
    nsg_name: str,
    subscription_id: str = Query(...),
    resource_group: str = Query(...)
) -> Dict[str, Any]:
    try:
        # analyze_nsg_rules is sync, so we should run it in a threadpool to not block the loop
        # since this route is async (because generate_llm_recommendations is async).
        
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        loop = asyncio.get_event_loop()
        analysis = await loop.run_in_executor(
            None, 
            validator.analyze_nsg_rules, 
            subscription_id, 
            resource_group, 
            nsg_name
        )
        
        # generate_llm_recommendations is async
        recommendations = await validator.generate_llm_recommendations(analysis)
        
        return {"recommendations": recommendations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
