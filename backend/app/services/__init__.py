from .azure_service import AzureService
from .ai_service import AIService
from .agent_service import AgentService

# Create service instances
azure_service = AzureService()
ai_service = AIService()
agent_service = AgentService()

__all__ = [
    "AzureService",
    "AIService", 
    "AgentService",
    "azure_service",
    "ai_service",
    "agent_service"
]