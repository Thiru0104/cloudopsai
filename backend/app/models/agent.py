from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
import json

from app.core.database import Base

class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"

class AgentType(str, Enum):
    NSG_ANALYZER = "nsg_analyzer"
    REMEDIATION = "remediation"
    COMPLIANCE_CHECKER = "compliance_checker"
    SECURITY_AUDITOR = "security_auditor"
    CUSTOM = "custom"

class AIModel(str, Enum):
    GPT_4_TURBO = "gpt-4-turbo"
    GPT_4 = "gpt-4"
    GPT_35_TURBO = "gpt-3.5-turbo"
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    AZURE_OPENAI_GPT4 = "azure-openai-gpt4"
    AZURE_OPENAI_GPT35 = "azure-openai-gpt35"

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    agent_type = Column(String(50), nullable=False, default=AgentType.CUSTOM)
    
    # AI Model Configuration
    ai_model = Column(String(100), nullable=False, default=AIModel.AZURE_OPENAI_GPT4)
    model_config = Column(JSON, default=dict)  # temperature, max_tokens, etc.
    
    # Agent Configuration
    configuration = Column(JSON, default=dict)
    system_prompt = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    
    # Status and Execution
    status = Column(String(50), default=AgentStatus.IDLE)
    is_active = Column(Boolean, default=True)
    last_execution = Column(DateTime, nullable=True)
    next_scheduled_run = Column(DateTime, nullable=True)
    
    # Performance Metrics
    total_executions = Column(Integer, default=0)
    successful_executions = Column(Integer, default=0)
    failed_executions = Column(Integer, default=0)
    average_execution_time = Column(Float, default=0.0)
    
    # Audit Trail
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    executions = relationship("AgentExecution", back_populates="agent")
    remediation_plans = relationship("RemediationPlan", back_populates="agent")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "agent_type": self.agent_type,
            "ai_model": self.ai_model,
            "ai_model_config": self.model_config or {},
            "configuration": self.configuration or {},
            "system_prompt": self.system_prompt,
            "instructions": self.instructions,
            "status": self.status,
            "is_active": self.is_active,
            "last_execution": self.last_execution.isoformat() if self.last_execution else None,
            "next_scheduled_run": self.next_scheduled_run.isoformat() if self.next_scheduled_run else None,
            "total_executions": self.total_executions,
            "successful_executions": self.successful_executions,
            "failed_executions": self.failed_executions,
            "average_execution_time": self.average_execution_time,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class AgentExecution(Base):
    __tablename__ = "agent_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    
    # Execution Details
    execution_id = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(50), default=AgentStatus.RUNNING)
    
    # Input and Output
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timing
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    execution_time = Column(Float, nullable=True)  # in seconds
    
    # AI Model Usage
    tokens_used = Column(Integer, default=0)
    cost_estimate = Column(Float, default=0.0)
    
    # Progress Tracking
    progress_percentage = Column(Integer, default=0)
    current_step = Column(String(255), nullable=True)
    total_steps = Column(Integer, default=1)
    
    # Relationships
    agent = relationship("Agent", back_populates="executions")
    
    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "execution_id": self.execution_id,
            "status": self.status,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "execution_time": self.execution_time,
            "tokens_used": self.tokens_used,
            "cost_estimate": self.cost_estimate,
            "progress_percentage": self.progress_percentage,
            "current_step": self.current_step,
            "total_steps": self.total_steps
        }

class RemediationPlan(Base):
    __tablename__ = "remediation_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    nsg_id = Column(Integer, ForeignKey("nsgs.id"), nullable=True)
    
    # Plan Details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(50), default="medium")  # low, medium, high, critical
    
    # Remediation Steps
    steps = Column(JSON, nullable=False)  # List of remediation steps
    azure_cli_commands = Column(JSON, nullable=True)  # Generated CLI commands
    powershell_commands = Column(JSON, nullable=True)  # Generated PowerShell commands
    
    # Validation and Rollback
    validation_steps = Column(JSON, nullable=True)
    rollback_steps = Column(JSON, nullable=True)
    
    # Status and Execution
    status = Column(String(50), default="pending")  # pending, approved, executing, completed, failed
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # Execution Results
    execution_results = Column(JSON, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    executed_by = Column(String(255), nullable=True)
    
    # Audit Trail
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("Agent", back_populates="remediation_plans")
    
    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "nsg_id": self.nsg_id,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "steps": self.steps or [],
            "azure_cli_commands": self.azure_cli_commands or [],
            "powershell_commands": self.powershell_commands or [],
            "validation_steps": self.validation_steps or [],
            "rollback_steps": self.rollback_steps or [],
            "status": self.status,
            "is_approved": self.is_approved,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "execution_results": self.execution_results,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "executed_by": self.executed_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }