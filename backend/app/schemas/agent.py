from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

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

# Base schemas
class AgentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    agent_type: AgentType = AgentType.CUSTOM
    ai_model: AIModel = AIModel.AZURE_OPENAI_GPT4
    ai_model_config: Optional[Dict[str, Any]] = {}
    configuration: Optional[Dict[str, Any]] = {}
    system_prompt: Optional[str] = None
    instructions: Optional[str] = None
    is_active: bool = True

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    agent_type: Optional[AgentType] = None
    ai_model: Optional[AIModel] = None
    ai_model_config: Optional[Dict[str, Any]] = None
    configuration: Optional[Dict[str, Any]] = None
    system_prompt: Optional[str] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None

class AgentResponse(AgentBase):
    id: int
    status: AgentStatus
    last_execution: Optional[datetime] = None
    next_scheduled_run: Optional[datetime] = None
    total_executions: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    average_execution_time: float = 0.0
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Agent Execution schemas
class AgentExecutionBase(BaseModel):
    input_data: Optional[Dict[str, Any]] = None

class AgentExecutionCreate(AgentExecutionBase):
    pass

class AgentExecutionResponse(BaseModel):
    id: int
    agent_id: int
    execution_id: str
    status: AgentStatus
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    execution_time: Optional[float] = None
    tokens_used: int = 0
    cost_estimate: float = 0.0
    progress_percentage: int = 0
    current_step: Optional[str] = None
    total_steps: int = 1

    class Config:
        from_attributes = True

# Remediation Plan schemas
class RemediationStep(BaseModel):
    step_number: int
    title: str
    description: str
    command_type: str  # "azure_cli", "powershell", "manual"
    command: Optional[str] = None
    expected_result: Optional[str] = None
    validation: Optional[str] = None

class RemediationPlanBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    steps: List[RemediationStep] = []
    azure_cli_commands: Optional[List[str]] = []
    powershell_commands: Optional[List[str]] = []
    validation_steps: Optional[List[str]] = []
    rollback_steps: Optional[List[str]] = []

class RemediationPlanCreate(RemediationPlanBase):
    agent_id: int
    nsg_id: Optional[int] = None

class RemediationPlanUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    steps: Optional[List[RemediationStep]] = None
    azure_cli_commands: Optional[List[str]] = None
    powershell_commands: Optional[List[str]] = None
    validation_steps: Optional[List[str]] = None
    rollback_steps: Optional[List[str]] = None
    is_approved: Optional[bool] = None

class RemediationPlanResponse(RemediationPlanBase):
    id: int
    agent_id: int
    nsg_id: Optional[int] = None
    status: str
    is_approved: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    execution_results: Optional[Dict[str, Any]] = None
    executed_at: Optional[datetime] = None
    executed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# AI Model Information
class AIModelInfo(BaseModel):
    name: str
    display_name: str
    provider: str
    description: str
    max_tokens: int
    supports_functions: bool = False
    cost_per_1k_tokens: float = 0.0
    capabilities: List[str] = []

class AIModelsResponse(BaseModel):
    models: List[AIModelInfo]

# Agent Analysis Request
class NSGAnalysisRequest(BaseModel):
    nsg_id: int
    analysis_type: str = Field(default="comprehensive", pattern="^(basic|comprehensive|security|compliance)$")
    include_remediation: bool = True
    custom_rules: Optional[List[Dict[str, Any]]] = []

class NSGAnalysisResponse(BaseModel):
    analysis_id: str
    nsg_id: int
    findings: List[Dict[str, Any]]
    risk_score: int = Field(..., ge=0, le=100)
    compliance_score: int = Field(..., ge=0, le=100)
    recommendations: List[str]
    remediation_plan_id: Optional[int] = None
    analysis_summary: str
    created_at: datetime

# Agent Statistics
class AgentStats(BaseModel):
    total_agents: int
    active_agents: int
    running_agents: int
    total_executions_today: int
    successful_executions_today: int
    failed_executions_today: int
    average_execution_time: float
    most_used_model: str
    total_tokens_used_today: int
    estimated_cost_today: float

# Bulk operations
class BulkAgentOperation(BaseModel):
    agent_ids: List[int]
    operation: str = Field(..., pattern="^(start|stop|pause|resume|delete)$")
    parameters: Optional[Dict[str, Any]] = {}

class BulkOperationResponse(BaseModel):
    operation: str
    total_agents: int
    successful: int
    failed: int
    results: List[Dict[str, Any]]