from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_sync_db, get_db
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from app.core.database import get_db
from app.services.agent_service import agent_service
from app.services.ai_service import ai_service
from app.models.agent import Agent, AgentExecution, RemediationPlan
from app.schemas.agent import (
    AgentCreate, AgentUpdate, AgentResponse,
    AgentExecutionCreate, AgentExecutionResponse,
    RemediationPlanCreate, RemediationPlanUpdate, RemediationPlanResponse,
    AIModelsResponse, NSGAnalysisRequest, NSGAnalysisResponse,
    AgentStats, BulkAgentOperation, BulkOperationResponse,
    AgentStatus, AgentType, AIModel
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Agent Management Endpoints

@router.get("", response_model=List[AgentResponse])
async def list_agents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    agent_type: Optional[AgentType] = None,
    status: Optional[AgentStatus] = None,
    is_active: Optional[bool] = None
):
    """List all agents with optional filters"""
    try:
        agents = await agent_service.get_agents(
            skip=skip,
            limit=limit,
            agent_type=agent_type,
            status=status,
            is_active=is_active
        )
        return agents
    except Exception as e:
        logger.error(f"Error listing agents: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("", response_model=AgentResponse)
async def create_agent(
    agent_data: AgentCreate
):
    """Create a new agent"""
    try:
        agent = await agent_service.create_agent(
            agent_data=agent_data,
            created_by="system"  # TODO: Get from authentication
        )
        return agent
    except Exception as e:
        logger.error(f"Error creating agent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int
):
    """Get agent details by ID"""
    try:
        agent = await agent_service.get_agent(agent_id=agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        return agent
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: int,
    agent_data: AgentUpdate
):
    """Update agent"""
    try:
        agent = await agent_service.update_agent(
            agent_id=agent_id,
            agent_data=agent_data
        )
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        return agent
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: int
):
    """Delete agent"""
    try:
        success = await agent_service.delete_agent(agent_id=agent_id)
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found")
        return {"message": "Agent deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agent {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Agent Execution Endpoints

@router.post("/{agent_id}/start")
async def start_agent(
    agent_id: int,
    execution_data: Optional[AgentExecutionCreate] = None,
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Start agent execution"""
    try:
        input_data = execution_data.input_data if execution_data else {}
        execution_id = await agent_service.start_agent(
            agent_id=agent_id,
            input_data=input_data
        )
        return {
            "message": "Agent started successfully",
            "execution_id": execution_id,
            "agent_id": agent_id
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting agent {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{agent_id}/execute-nsg-validation")
async def execute_agent_nsg_validation(
    agent_id: int,
    nsg_ids: List[int],
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Execute agent against selected NSG rules for validation and remediation"""
    try:
        # Validate agent exists
        agent = await agent_service.get_agent(agent_id=agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Prepare input data with NSG IDs
        input_data = {
            "nsg_ids": nsg_ids,
            "analysis_type": "validation",
            "include_remediation": True
        }
        
        # Start agent execution
        execution_id = await agent_service.start_agent(
            agent_id=agent_id,
            input_data=input_data
        )
        
        return {
            "message": "Agent NSG validation started successfully",
            "execution_id": execution_id,
            "agent_id": agent_id,
            "nsg_count": len(nsg_ids)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting agent NSG validation {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{agent_id}/stop")
async def stop_agent(
    agent_id: int
):
    """Stop agent execution"""
    try:
        success = await agent_service.stop_agent(agent_id=agent_id)
        if not success:
            raise HTTPException(status_code=404, detail="Agent not found")
        return {"message": "Agent stopped successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping agent {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{agent_id}/executions", response_model=List[AgentExecutionResponse])
async def get_agent_executions(
    agent_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[AgentStatus] = None
):
    """Get agent execution history"""
    try:
        executions = await agent_service.get_agent_executions(
            agent_id=agent_id,
            status=status,
            skip=skip,
            limit=limit
        )
        return executions
    except Exception as e:
        logger.error(f"Error getting executions for agent {agent_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/executions/{execution_id}", response_model=AgentExecutionResponse)
async def get_execution_details(
    execution_id: str
):
    """Get execution details by execution ID"""
    try:
        execution = await agent_service.get_agent_execution(
            execution_id=execution_id
        )
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        return execution
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting execution {execution_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# AI Models Endpoint

@router.get("/models", response_model=AIModelsResponse)
async def get_available_models():
    """Get available AI models"""
    try:
        models = await ai_service.get_available_models()
        # Find a suitable default model (e.g., Azure GPT-4 or OpenAI GPT-4)
        default_model = "azure-gpt-4" # Fallback
        for model in models:
            if "gpt-4" in model.name:
                default_model = model.name
                break
                
        return AIModelsResponse(models=models, default_model_id=default_model)
    except Exception as e:
        logger.error(f"Error getting available models: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# NSG Analysis Endpoints

@router.post("/analyze-nsg", response_model=NSGAnalysisResponse)
async def analyze_nsg(
    analysis_request: NSGAnalysisRequest
):
    """Analyze NSG configuration using AI"""
    try:
        result = await agent_service.analyze_nsg(request=analysis_request)
        return NSGAnalysisResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error analyzing NSG: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Remediation Plan Endpoints

@router.get("/remediation-plans", response_model=List[RemediationPlanResponse])
async def get_remediation_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    agent_id: Optional[int] = None,
    nsg_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get remediation plans with filters"""
    try:
        query = select(RemediationPlan)
        
        if agent_id:
            query = query.where(RemediationPlan.agent_id == agent_id)
        if nsg_id:
            query = query.where(RemediationPlan.nsg_id == nsg_id)
        if status:
            query = query.where(RemediationPlan.status == status)
        
        query = query.order_by(RemediationPlan.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        plans = result.scalars().all()
        return plans
    except Exception as e:
        logger.error(f"Error getting remediation plans: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/remediation-plans/{plan_id}", response_model=RemediationPlanResponse)
async def get_remediation_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get remediation plan by ID"""
    try:
        query = select(RemediationPlan).where(RemediationPlan.id == plan_id)
        result = await db.execute(query)
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Remediation plan not found")
        return plan
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting remediation plan {plan_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        db.close()

@router.put("/remediation-plans/{plan_id}", response_model=RemediationPlanResponse)
async def update_remediation_plan(
    plan_id: int,
    plan_data: RemediationPlanUpdate
):
    """Update remediation plan"""
    db = get_sync_db()
    try:
        plan = db.query(RemediationPlan).filter(RemediationPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Remediation plan not found")
        
        update_data = plan_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(plan, field, value)
        
        plan.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(plan)
        
        return plan
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating remediation plan {plan_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.post("/remediation-plans/{plan_id}/approve")
async def approve_remediation_plan(
    plan_id: int
):
    """Approve remediation plan for execution"""
    db = get_sync_db()
    try:
        plan = db.query(RemediationPlan).filter(RemediationPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Remediation plan not found")
        
        plan.is_approved = True
        plan.approved_by = "system"  # TODO: Get from authentication
        plan.approved_at = datetime.utcnow()
        plan.status = "approved"
        
        db.commit()
        
        return {"message": "Remediation plan approved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving remediation plan {plan_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

# Statistics and Monitoring

@router.get("/stats", response_model=AgentStats)
async def get_agent_statistics():
    """Get agent statistics and metrics"""
    try:
        stats = await agent_service.get_agent_stats()
        return AgentStats(**stats)
    except Exception as e:
        logger.error(f"Error getting agent statistics: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Bulk Operations

@router.post("/bulk-operation", response_model=BulkOperationResponse)
async def bulk_agent_operation(
    operation: BulkAgentOperation
):
    """Perform bulk operations on multiple agents"""
    try:
        results = []
        successful = 0
        failed = 0
        
        for agent_id in operation.agent_ids:
            try:
                if operation.operation == "start":
                    execution_id = await agent_service.start_agent(
                        agent_id=agent_id,
                        input_data=operation.parameters
                    )
                    results.append({
                        "agent_id": agent_id,
                        "status": "success",
                        "execution_id": execution_id
                    })
                    successful += 1
                    
                elif operation.operation == "stop":
                    success = await agent_service.stop_agent(agent_id=agent_id)
                    results.append({
                        "agent_id": agent_id,
                        "status": "success" if success else "failed",
                        "message": "Stopped" if success else "Agent not found"
                    })
                    if success:
                        successful += 1
                    else:
                        failed += 1
                        
                elif operation.operation == "delete":
                    success = await agent_service.delete_agent(agent_id=agent_id)
                    results.append({
                        "agent_id": agent_id,
                        "status": "success" if success else "failed",
                        "message": "Deleted" if success else "Agent not found"
                    })
                    if success:
                        successful += 1
                    else:
                        failed += 1
                        
                else:
                    results.append({
                        "agent_id": agent_id,
                        "status": "failed",
                        "message": f"Unsupported operation: {operation.operation}"
                    })
                    failed += 1
                    
            except Exception as e:
                results.append({
                    "agent_id": agent_id,
                    "status": "failed",
                    "message": str(e)
                })
                failed += 1
        
        return BulkOperationResponse(
            operation=operation.operation,
            total_agents=len(operation.agent_ids),
            successful=successful,
            failed=failed,
            results=results
        )
        
    except Exception as e:
        logger.error(f"Error performing bulk operation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Health Check for Agents

@router.get("/health")
async def agents_health_check():
    """Health check for agent system"""
    try:
        # Get agent statistics
        stats = await agent_service.get_agent_stats()
        
        # Check AI service availability
        available_models = await ai_service.get_available_models()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "total_agents": stats.get("total_agents", 0),
            "available_models": len(available_models),
            "services": {
                "database": "connected",
                "ai_service": "available",
                "agent_service": "running"
            }
        }
    except Exception as e:
        logger.error(f"Agent health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }