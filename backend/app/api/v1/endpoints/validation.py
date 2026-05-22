from fastapi import APIRouter, HTTPException, Query, File, UploadFile
from typing import Dict, Any, List
import pandas as pd
import io
from app.services.nsg_validation import NSGValidator

router = APIRouter()
validator = NSGValidator()

@router.post("/nsg-validation/offline")
async def validate_offline_nsg(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Validate NSG rules from an uploaded Excel/CSV file.
    """
    if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload .xlsx, .xls, or .csv")
    try:
        contents = await file.read()
        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        # Convert DataFrame to list of dicts, handling NaN values
        df = df.where(pd.notnull(df), None)
        rules_data = df.to_dict(orient='records')
        
        if not rules_data:
            raise HTTPException(status_code=400, detail="No data found in file")
            
        result = validator.analyze_offline_nsg_rules(rules_data, nsg_name=file.filename)
        return result
    except Exception as e:
        print(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

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
