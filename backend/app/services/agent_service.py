import asyncio
import uuid
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, select
import logging

from app.models.agent import Agent, AgentExecution, RemediationPlan, AgentStatus, AgentType
from app.models.nsg import NSG
from app.schemas.agent import (
    AgentCreate, AgentUpdate, AgentExecutionCreate, 
    NSGAnalysisRequest, RemediationPlanCreate
)
from app.services.ai_service import ai_service
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

class AgentService:
    def __init__(self):
        self.running_executions: Dict[str, asyncio.Task] = {}
        self.execution_status: Dict[str, Dict[str, Any]] = {}
    
    async def create_agent(self, agent_data: AgentCreate, created_by: str = None) -> Agent:
        """Create a new agent"""
        async with AsyncSessionLocal() as db:
            try:
                agent = Agent(
                    name=agent_data.name,
                    description=agent_data.description,
                    agent_type=agent_data.agent_type,
                    ai_model=agent_data.ai_model,
                    model_config=agent_data.ai_model_config or {},
                    configuration=agent_data.configuration or {},
                    system_prompt=agent_data.system_prompt,
                    instructions=agent_data.instructions,
                    is_active=agent_data.is_active,
                    created_by=created_by
                )
                
                db.add(agent)
                await db.commit()
                await db.refresh(agent)
                
                logger.info(f"Created agent {agent.name} (ID: {agent.id})")
                return agent
            except Exception as e:
                await db.rollback()
                logger.error(f"Error creating agent: {str(e)}")
                raise
    
    async def get_agent(self, agent_id: int) -> Optional[Agent]:
        """Get agent by ID"""
        async with AsyncSessionLocal() as db:
            query = select(Agent).where(Agent.id == agent_id)
            result = await db.execute(query)
            return result.scalar_one_or_none()
    
    async def get_agents(
        self, 
        skip: int = 0, 
        limit: int = 100,
        agent_type: Optional[AgentType] = None,
        status: Optional[AgentStatus] = None,
        is_active: Optional[bool] = None
    ) -> List[Agent]:
        """Get list of agents with filters"""
        async with AsyncSessionLocal() as db:
            query = select(Agent)
            
            if agent_type:
                query = query.where(Agent.agent_type == agent_type)
            if status:
                query = query.where(Agent.status == status)
            if is_active is not None:
                query = query.where(Agent.is_active == is_active)
            
            query = query.offset(skip).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
    
    async def update_agent(self, agent_id: int, agent_data: AgentUpdate) -> Optional[Agent]:
        """Update agent"""
        db = get_sync_db()
        try:
            agent = await self.get_agent(agent_id)
            if not agent:
                return None
            
            # Re-query in current session
            agent = db.query(Agent).filter(Agent.id == agent_id).first()
            if not agent:
                return None
            
            update_data = agent_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(agent, field, value)
            
            agent.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(agent)
            
            logger.info(f"Updated agent {agent.name} (ID: {agent.id})")
            return agent
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating agent {agent_id}: {str(e)}")
            raise
        finally:
            db.close()
    
    async def delete_agent(self, agent_id: int) -> bool:
        """Delete agent"""
        db = get_sync_db()
        try:
            agent = db.query(Agent).filter(Agent.id == agent_id).first()
            if not agent:
                return False
            
            # Stop any running executions
            await self.stop_agent(agent_id)
            
            # Delete agent
            db.delete(agent)
            db.commit()
            
            logger.info(f"Deleted agent {agent.name} (ID: {agent.id})")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting agent {agent_id}: {str(e)}")
            raise
        finally:
            db.close()
    
    async def start_agent(self, agent_id: int, input_data: Dict[str, Any] = None) -> str:
        """Start agent execution"""
        async with AsyncSessionLocal() as db:
            try:
                # Get agent
                query = select(Agent).where(Agent.id == agent_id)
                result = await db.execute(query)
                agent = result.scalar_one_or_none()
                
                if not agent:
                    raise ValueError(f"Agent {agent_id} not found")
                
                if not agent.is_active:
                    raise ValueError(f"Agent {agent_id} is not active")
                
                # Create execution record
                execution_id = str(uuid.uuid4())
                execution = AgentExecution(
                    agent_id=agent_id,
                    execution_id=execution_id,
                    status=AgentStatus.RUNNING,
                    input_data=input_data or {},
                    started_at=datetime.utcnow()
                )
                
                db.add(execution)
                await db.commit()
                await db.refresh(execution)
                
                # Update agent status
                agent.status = AgentStatus.RUNNING
                agent.last_execution = datetime.utcnow()
                await db.commit()
                
                # Start execution task
                task = asyncio.create_task(
                    self._execute_agent(agent, execution)
                )
                self.running_executions[execution_id] = task
                
                logger.info(f"Started agent {agent.name} (execution: {execution_id})")
                return execution_id
                
            except Exception as e:
                await db.rollback()
                logger.error(f"Error starting agent {agent_id}: {str(e)}")
                raise
    
    async def stop_agent(self, agent_id: int) -> bool:
        """Stop agent execution"""
        db = get_sync_db()
        try:
            agent = db.query(Agent).filter(Agent.id == agent_id).first()
            if not agent:
                return False
            
            # Find running executions for this agent
            running_executions = [
                exec_id for exec_id, task in self.running_executions.items()
                if not task.done()
            ]
            
            # Cancel running tasks
            for exec_id in running_executions:
                if exec_id in self.running_executions:
                    self.running_executions[exec_id].cancel()
                    del self.running_executions[exec_id]
            
            # Update agent status
            agent.status = AgentStatus.STOPPED
            db.commit()
            
            logger.info(f"Stopped agent {agent.name} (ID: {agent_id})")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping agent {agent_id}: {str(e)}")
            return False
        finally:
            db.close()
    
    async def get_agent_execution(self, execution_id: str) -> Optional[AgentExecution]:
        """Get agent execution by ID"""
        db = get_sync_db()
        try:
            return db.query(AgentExecution).filter(
                AgentExecution.execution_id == execution_id
            ).first()
        finally:
            db.close()
    
    async def get_agent_executions(
        self, 
        agent_id: Optional[int] = None,
        status: Optional[AgentStatus] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> List[AgentExecution]:
        """Get agent executions with filters"""
        db = get_sync_db()
        try:
            query = db.query(AgentExecution)
            
            if agent_id:
                query = query.filter(AgentExecution.agent_id == agent_id)
            if status:
                query = query.filter(AgentExecution.status == status)
            
            return query.order_by(AgentExecution.started_at.desc()).offset(skip).limit(limit).all()
        finally:
            db.close()
    
    async def analyze_nsg(self, request: NSGAnalysisRequest) -> Dict[str, Any]:
        """Analyze NSG using AI agent"""
        db = get_sync_db()
        try:
            # Get NSG data
            nsg = db.query(NSG).filter(NSG.id == request.nsg_id).first()
            if not nsg:
                raise ValueError(f"NSG {request.nsg_id} not found")
            
            # Prepare NSG configuration for analysis
            nsg_config = {
                "name": nsg.name,
                "resource_group": nsg.resource_group,
                "region": nsg.region,
                "inbound_rules": nsg.inbound_rules or [],
                "outbound_rules": nsg.outbound_rules or [],
                "tags": nsg.tags or {}
            }
            
            # Perform AI analysis
            analysis_result = await ai_service.analyze_nsg_configuration(
                nsg_config=nsg_config,
                analysis_type=request.analysis_type
            )
            
            # Create remediation plan if requested
            remediation_plan_id = None
            if request.include_remediation and analysis_result.get("findings"):
                remediation_plan = await self._create_remediation_plan(
                    nsg, analysis_result["findings"]
                )
                remediation_plan_id = remediation_plan.id
            
            # Update NSG compliance scores
            nsg.compliance_score = analysis_result.get("compliance_score", 50)
            nsg.risk_level = self._calculate_risk_level(analysis_result.get("risk_score", 50))
            nsg.last_sync = datetime.utcnow()
            db.commit()
            
            return {
                "analysis_id": str(uuid.uuid4()),
                "nsg_id": request.nsg_id,
                "findings": analysis_result.get("findings", []),
                "risk_score": analysis_result.get("risk_score", 50),
                "compliance_score": analysis_result.get("compliance_score", 50),
                "recommendations": analysis_result.get("recommendations", []),
                "remediation_plan_id": remediation_plan_id,
                "analysis_summary": analysis_result.get("summary", ""),
                "created_at": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing NSG {request.nsg_id}: {str(e)}")
            raise
        finally:
            db.close()
    
    async def _execute_agent(self, agent: Agent, execution: AgentExecution):
        """Execute agent logic"""
        db = get_sync_db()
        try:
            # Update execution status
            self.execution_status[execution.execution_id] = {
                "status": AgentStatus.RUNNING,
                "progress": 0,
                "current_step": "Initializing",
                "started_at": datetime.utcnow()
            }
            
            # Execute based on agent type
            if agent.agent_type == AgentType.NSG_ANALYZER:
                result = await self._execute_nsg_analyzer(agent, execution)
            elif agent.agent_type == AgentType.REMEDIATION:
                result = await self._execute_remediation_agent(agent, execution)
            elif agent.agent_type == AgentType.COMPLIANCE_CHECKER:
                result = await self._execute_compliance_checker(agent, execution)
            elif agent.agent_type == AgentType.SECURITY_AUDITOR:
                result = await self._execute_security_auditor(agent, execution)
            else:
                result = await self._execute_custom_agent(agent, execution)
            
            # Update execution with results
            execution.status = AgentStatus.COMPLETED
            execution.output_data = result
            execution.completed_at = datetime.utcnow()
            execution.execution_time = (execution.completed_at - execution.started_at).total_seconds()
            execution.progress_percentage = 100
            
            # Update agent statistics
            agent.status = AgentStatus.IDLE
            agent.total_executions += 1
            agent.successful_executions += 1
            
            # Update average execution time
            if agent.average_execution_time == 0:
                agent.average_execution_time = execution.execution_time
            else:
                agent.average_execution_time = (
                    (agent.average_execution_time * (agent.total_executions - 1) + execution.execution_time) 
                    / agent.total_executions
                )
            
            db.commit()
            
            logger.info(f"Agent {agent.name} execution {execution.execution_id} completed successfully")
            
        except asyncio.CancelledError:
            # Handle cancellation
            execution.status = AgentStatus.STOPPED
            execution.completed_at = datetime.utcnow()
            execution.error_message = "Execution cancelled"
            agent.status = AgentStatus.IDLE
            db.commit()
            logger.info(f"Agent {agent.name} execution {execution.execution_id} cancelled")
            
        except Exception as e:
            # Handle errors
            execution.status = AgentStatus.FAILED
            execution.completed_at = datetime.utcnow()
            execution.error_message = str(e)
            execution.execution_time = (execution.completed_at - execution.started_at).total_seconds()
            
            agent.status = AgentStatus.IDLE
            agent.total_executions += 1
            agent.failed_executions += 1
            
            db.commit()
            
            logger.error(f"Agent {agent.name} execution {execution.execution_id} failed: {str(e)}")
            
        finally:
            # Clean up
            if execution.execution_id in self.running_executions:
                del self.running_executions[execution.execution_id]
            if execution.execution_id in self.execution_status:
                del self.execution_status[execution.execution_id]
            db.close()
    
    async def _execute_nsg_analyzer(self, agent: Agent, execution: AgentExecution) -> Dict[str, Any]:
        """Execute NSG analyzer agent"""
        input_data = execution.input_data or {}
        nsg_id = input_data.get("nsg_id")
        nsg_ids = input_data.get("nsg_ids", [])
        
        # Handle both single NSG and multiple NSGs
        if nsg_id:
            nsg_ids = [nsg_id]
        elif not nsg_ids:
            raise ValueError("NSG ID(s) required for NSG analyzer")
        
        results = []
        total_nsgs = len(nsg_ids)
        
        # Update execution status
        self.execution_status[execution.execution_id].update({
            "current_step": f"Analyzing {total_nsgs} NSG(s)",
            "progress": 10
        })
        
        # Analyze each NSG
        for i, nsg_id in enumerate(nsg_ids):
            try:
                # Update progress
                progress = 10 + (i * 80 // total_nsgs)
                self.execution_status[execution.execution_id].update({
                    "current_step": f"Analyzing NSG {i+1}/{total_nsgs} (ID: {nsg_id})",
                    "progress": progress
                })
                
                # Analyze NSG
                analysis_request = NSGAnalysisRequest(
                    nsg_id=nsg_id,
                    analysis_type=input_data.get("analysis_type", "comprehensive"),
                    include_remediation=input_data.get("include_remediation", True)
                )
                
                nsg_result = await self.analyze_nsg(analysis_request)
                nsg_result["nsg_id"] = nsg_id
                results.append(nsg_result)
                
            except Exception as e:
                logger.error(f"Error analyzing NSG {nsg_id}: {str(e)}")
                results.append({
                    "nsg_id": nsg_id,
                    "error": str(e),
                    "status": "failed"
                })
        
        # Final progress update
        self.execution_status[execution.execution_id].update({
            "current_step": "Compilation results",
            "progress": 95
        })
        
        # Compile final results
        successful_analyses = [r for r in results if "error" not in r]
        failed_analyses = [r for r in results if "error" in r]
        
        return {
            "total_nsgs": total_nsgs,
            "successful_analyses": len(successful_analyses),
            "failed_analyses": len(failed_analyses),
            "results": results,
            "summary": {
                "total_findings": sum(len(r.get("findings", [])) for r in successful_analyses),
                "high_risk_findings": sum(len([f for f in r.get("findings", []) if f.get("risk_level") == "high"]) for r in successful_analyses),
                "remediation_plans_created": sum(1 for r in successful_analyses if r.get("remediation_plan"))
            }
        }
    
    async def _execute_remediation_agent(self, agent: Agent, execution: AgentExecution) -> Dict[str, Any]:
        """Execute remediation agent"""
        db = get_sync_db()
        try:
            # Get input data (NSG IDs if provided)
            input_data = execution.input_data or {}
            nsg_ids = input_data.get('nsg_ids', [])
            
            if not nsg_ids:
                # If no specific NSGs provided, get all NSGs for general remediation
                nsgs = db.query(NSG).filter(NSG.is_active == True).all()
                nsg_ids = [nsg.id for nsg in nsgs]
            
            results = []
            total_nsgs = len(nsg_ids)
            
            for i, nsg_id in enumerate(nsg_ids):
                # Update progress
                progress = int((i / total_nsgs) * 100)
                self.execution_status[execution.execution_id].update({
                    "progress": progress,
                    "current_step": f"Generating remediation for NSG {nsg_id}"
                })
                
                nsg = db.query(NSG).filter(NSG.id == nsg_id).first()
                if not nsg:
                    results.append({
                        "nsg_id": nsg_id,
                        "status": "failed",
                        "error": "NSG not found"
                    })
                    continue
                
                # Generate remediation recommendations
                remediation_result = await self._generate_remediation_recommendations(nsg)
                results.append({
                    "nsg_id": nsg_id,
                    "nsg_name": nsg.name,
                    "status": "completed",
                    "remediation": remediation_result
                })
            
            # Final progress update
            self.execution_status[execution.execution_id].update({
                "progress": 100,
                "current_step": "Remediation generation completed"
            })
            
            return {
                "message": f"Remediation agent completed for {len(results)} NSGs",
                "status": "completed",
                "results": results,
                "summary": {
                    "total_nsgs": total_nsgs,
                    "successful": len([r for r in results if r["status"] == "completed"]),
                    "failed": len([r for r in results if r["status"] == "failed"])
                }
            }
            
        except Exception as e:
            logger.error(f"Error in remediation agent execution: {str(e)}")
            return {
                "message": "Remediation agent failed",
                "status": "failed",
                "error": str(e)
            }
        finally:
            db.close()
    
    async def _generate_remediation_recommendations(self, nsg: NSG) -> Dict[str, Any]:
        """Generate remediation recommendations for an NSG"""
        try:
            # Analyze NSG rules for security issues
            rules_analysis = []
            for rule in nsg.rules:
                rule_data = {
                    "name": rule.name,
                    "priority": rule.priority,
                    "direction": rule.direction,
                    "access": rule.access,
                    "protocol": rule.protocol,
                    "source_port_range": rule.source_port_range,
                    "destination_port_range": rule.destination_port_range,
                    "source_address_prefix": rule.source_address_prefix,
                    "destination_address_prefix": rule.destination_address_prefix,
                    "source_address_prefixes": getattr(rule, 'source_address_prefixes', None) or [],
                    "destination_address_prefixes": getattr(rule, 'destination_address_prefixes', None) or []
                }
                rules_analysis.append(rule_data)
            
            # Generate AI-powered remediation recommendations
            prompt = f"""
            Analyze the following NSG '{nsg.name}' and its security rules, then provide specific remediation recommendations:
            
            NSG Details:
            - Name: {nsg.name}
            - Resource Group: {nsg.resource_group}
            - Location: {nsg.location}
            - Rules Count: {len(rules_analysis)}
            
            Security Rules:
            {json.dumps(rules_analysis, indent=2)}
            
            Please provide:
            1. Security vulnerabilities identified
            2. Specific remediation steps
            3. Priority level for each recommendation
            4. Potential impact of changes
            
            Format the response as JSON with clear recommendations.
            """
            
            ai_response = await ai_service.generate_response(
                prompt=prompt,
                model="gpt-4",
                max_tokens=2000
            )
            
            return {
                "nsg_name": nsg.name,
                "recommendations": ai_response,
                "rules_analyzed": len(rules_analysis),
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating remediation for NSG {nsg.name}: {str(e)}")
            return {
                "nsg_name": nsg.name,
                "error": str(e),
                "generated_at": datetime.utcnow().isoformat()
            }
    
    async def _execute_compliance_checker(self, agent: Agent, execution: AgentExecution) -> Dict[str, Any]:
        """Execute compliance checker agent"""
        # Implementation for compliance checker
        return {"message": "Compliance checker executed", "status": "completed"}
    
    async def _execute_security_auditor(self, agent: Agent, execution: AgentExecution) -> Dict[str, Any]:
        """Execute security auditor agent"""
        # Implementation for security auditor
        return {"message": "Security auditor executed", "status": "completed"}
    
    async def _execute_custom_agent(self, agent: Agent, execution: AgentExecution) -> Dict[str, Any]:
        """Execute custom agent"""
        # Implementation for custom agent
        return {"message": "Custom agent executed", "status": "completed"}
    
    async def _create_remediation_plan(self, nsg: NSG, findings: List[Dict[str, Any]]) -> RemediationPlan:
        """Create remediation plan based on findings"""
        db = get_sync_db()
        try:
            # Generate remediation plan using AI
            nsg_config = {
                "name": nsg.name,
                "resource_group": nsg.resource_group,
                "region": nsg.region,
                "inbound_rules": nsg.inbound_rules or [],
                "outbound_rules": nsg.outbound_rules or []
            }
            
            plan_data = await ai_service.generate_remediation_plan(findings, nsg_config)
            
            # Create remediation plan record
            remediation_plan = RemediationPlan(
                agent_id=None,  # System generated
                nsg_id=nsg.id,
                title=plan_data.get("title", "AI-Generated Remediation Plan"),
                description=plan_data.get("description", ""),
                severity=plan_data.get("severity", "medium"),
                steps=plan_data.get("steps", []),
                azure_cli_commands=plan_data.get("azure_cli_commands", []),
                powershell_commands=plan_data.get("powershell_commands", []),
                validation_steps=plan_data.get("validation_steps", []),
                rollback_steps=plan_data.get("rollback_steps", [])
            )
            
            db.add(remediation_plan)
            db.commit()
            db.refresh(remediation_plan)
            
            return remediation_plan
            
        except Exception as e:
            logger.error(f"Error creating remediation plan: {str(e)}")
            raise
        finally:
            db.close()
    
    def _calculate_risk_level(self, risk_score: int) -> str:
        """Calculate risk level based on score"""
        if risk_score >= 80:
            return "critical"
        elif risk_score >= 60:
            return "high"
        elif risk_score >= 40:
            return "medium"
        else:
            return "low"
    
    async def get_agent_stats(self) -> Dict[str, Any]:
        """Get agent statistics"""
        db = get_sync_db()
        try:
            total_agents = db.query(Agent).count()
            active_agents = db.query(Agent).filter(Agent.is_active == True).count()
            running_agents = db.query(Agent).filter(Agent.status == AgentStatus.RUNNING).count()
            
            # Today's executions
            today = datetime.utcnow().date()
            today_executions = db.query(AgentExecution).filter(
                AgentExecution.started_at >= today
            ).all()
            
            successful_today = len([e for e in today_executions if e.status == AgentStatus.COMPLETED])
            failed_today = len([e for e in today_executions if e.status == AgentStatus.FAILED])
            
            # Average execution time
            avg_time = db.query(Agent).filter(Agent.average_execution_time > 0).all()
            average_execution_time = sum(a.average_execution_time for a in avg_time) / len(avg_time) if avg_time else 0
            
            # Most used model
            agents = db.query(Agent).all()
            model_usage = {}
            for agent in agents:
                model = agent.ai_model
                model_usage[model] = model_usage.get(model, 0) + agent.total_executions
            
            most_used_model = max(model_usage.items(), key=lambda x: x[1])[0] if model_usage else "N/A"
            
            return {
                "total_agents": total_agents,
                "active_agents": active_agents,
                "running_agents": running_agents,
                "total_executions_today": len(today_executions),
                "successful_executions_today": successful_today,
                "failed_executions_today": failed_today,
                "average_execution_time": round(average_execution_time, 2),
                "most_used_model": most_used_model,
                "total_tokens_used_today": sum(e.tokens_used for e in today_executions),
                "estimated_cost_today": round(sum(e.cost_estimate for e in today_executions), 4)
            }
            
        except Exception as e:
            logger.error(f"Error getting agent stats: {str(e)}")
            return {}
        finally:
            db.close()

# Global agent service instance
agent_service = AgentService()