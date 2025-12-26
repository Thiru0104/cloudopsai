import os
import json
import asyncio
from typing import Dict, List, Any, Optional, AsyncGenerator
from datetime import datetime
import logging
from openai import AsyncOpenAI
import aiohttp
from app.schemas.agent import AIModel, AIModelInfo

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.azure_openai_client = None
        self.openai_client = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize AI model clients based on available API keys"""
        try:
            # Azure OpenAI
            if os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT"):
                self.azure_openai_client = AsyncOpenAI(
                    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
                    api_version="2024-02-15-preview"
                )
                logger.info("Azure OpenAI client initialized")
            
            # OpenAI
            if os.getenv("OPENAI_API_KEY"):
                self.openai_client = AsyncOpenAI(
                    api_key=os.getenv("OPENAI_API_KEY")
                )
                logger.info("OpenAI client initialized")
            
            # Note: Anthropic support removed - using OpenAI models only
                
        except Exception as e:
            logger.error(f"Error initializing AI clients: {str(e)}")
    
    async def get_available_models(self) -> List[AIModelInfo]:
        """Get list of available AI models"""
        models = []
        
        # Azure OpenAI models
        if self.azure_openai_client:
            models.extend([
                AIModelInfo(
                    name=AIModel.AZURE_OPENAI_GPT4,
                    display_name="Azure OpenAI GPT-4",
                    provider="Azure OpenAI",
                    description="Most capable model for complex reasoning and analysis",
                    max_tokens=8192,
                    supports_functions=True,
                    cost_per_1k_tokens=0.03,
                    capabilities=["text_generation", "code_analysis", "reasoning", "function_calling"]
                ),
                AIModelInfo(
                    name=AIModel.AZURE_OPENAI_GPT35,
                    display_name="Azure OpenAI GPT-3.5 Turbo",
                    provider="Azure OpenAI",
                    description="Fast and efficient model for most tasks",
                    max_tokens=4096,
                    supports_functions=True,
                    cost_per_1k_tokens=0.002,
                    capabilities=["text_generation", "code_analysis", "function_calling"]
                )
            ])
        
        # OpenAI models
        if self.openai_client:
            models.extend([
                AIModelInfo(
                    name=AIModel.GPT_4_TURBO,
                    display_name="GPT-4 Turbo",
                    provider="OpenAI",
                    description="Latest GPT-4 model with improved performance",
                    max_tokens=128000,
                    supports_functions=True,
                    cost_per_1k_tokens=0.01,
                    capabilities=["text_generation", "code_analysis", "reasoning", "function_calling"]
                ),
                AIModelInfo(
                    name=AIModel.GPT_4,
                    display_name="GPT-4",
                    provider="OpenAI",
                    description="Most capable GPT-4 model",
                    max_tokens=8192,
                    supports_functions=True,
                    cost_per_1k_tokens=0.03,
                    capabilities=["text_generation", "code_analysis", "reasoning", "function_calling"]
                ),
                AIModelInfo(
                    name=AIModel.GPT_35_TURBO,
                    display_name="GPT-3.5 Turbo",
                    provider="OpenAI",
                    description="Fast and efficient model",
                    max_tokens=4096,
                    supports_functions=True,
                    cost_per_1k_tokens=0.002,
                    capabilities=["text_generation", "code_analysis", "function_calling"]
                ),
                AIModelInfo(
                    name=AIModel.GPT_4O,
                    display_name="GPT-4o",
                    provider="OpenAI",
                    description="Most advanced GPT-4 model with multimodal capabilities",
                    max_tokens=128000,
                    supports_functions=True,
                    cost_per_1k_tokens=0.005,
                    capabilities=["text_generation", "code_analysis", "reasoning", "function_calling", "multimodal"]
                ),
                AIModelInfo(
                    name=AIModel.GPT_4O_MINI,
                    display_name="GPT-4o Mini",
                    provider="OpenAI",
                    description="Efficient GPT-4o model for faster processing",
                    max_tokens=128000,
                    supports_functions=True,
                    cost_per_1k_tokens=0.00015,
                    capabilities=["text_generation", "code_analysis", "function_calling"]
                )
            ])
        
        return models
    
    async def generate_completion(
        self,
        model: AIModel,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        functions: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Generate completion using specified AI model"""
        try:
            start_time = datetime.now()
            
            # Prepare messages
            if system_prompt:
                # For OpenAI models, add system message
                formatted_messages = [{"role": "system", "content": system_prompt}] + messages
            else:
                formatted_messages = messages
            
            response = None
            tokens_used = 0
            
            # Route to appropriate client
            if model in [AIModel.AZURE_OPENAI_GPT4, AIModel.AZURE_OPENAI_GPT35] and self.azure_openai_client:
                response = await self._call_azure_openai(model, formatted_messages, temperature, max_tokens, functions)
            elif model in [AIModel.GPT_4_TURBO, AIModel.GPT_4, AIModel.GPT_35_TURBO, AIModel.GPT_4O, AIModel.GPT_4O_MINI] and self.openai_client:
                response = await self._call_openai(model, formatted_messages, temperature, max_tokens, functions)
            else:
                raise ValueError(f"Model {model} not available or client not initialized")
            
            end_time = datetime.now()
            execution_time = (end_time - start_time).total_seconds()
            
            return {
                "content": response.get("content", ""),
                "tokens_used": response.get("tokens_used", 0),
                "execution_time": execution_time,
                "model": model,
                "cost_estimate": self._calculate_cost(model, response.get("tokens_used", 0)),
                "function_calls": response.get("function_calls", [])
            }
            
        except Exception as e:
            logger.error(f"Error generating completion with {model}: {str(e)}")
            raise
    
    async def _call_azure_openai(
        self, 
        model: AIModel, 
        messages: List[Dict[str, str]], 
        temperature: float, 
        max_tokens: int,
        functions: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Call Azure OpenAI API"""
        model_name = "gpt-4" if model == AIModel.AZURE_OPENAI_GPT4 else "gpt-35-turbo"
        
        kwargs = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if functions:
            kwargs["functions"] = functions
            kwargs["function_call"] = "auto"
        
        response = await self.azure_openai_client.chat.completions.create(**kwargs)
        
        result = {
            "content": response.choices[0].message.content or "",
            "tokens_used": response.usage.total_tokens if response.usage else 0,
            "function_calls": []
        }
        
        if response.choices[0].message.function_call:
            result["function_calls"].append({
                "name": response.choices[0].message.function_call.name,
                "arguments": response.choices[0].message.function_call.arguments
            })
        
        return result
    
    async def _call_openai(
        self, 
        model: AIModel, 
        messages: List[Dict[str, str]], 
        temperature: float, 
        max_tokens: int,
        functions: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Call OpenAI API"""
        kwargs = {
            "model": model.value,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if functions:
            kwargs["functions"] = functions
            kwargs["function_call"] = "auto"
        
        response = await self.openai_client.chat.completions.create(**kwargs)
        
        result = {
            "content": response.choices[0].message.content or "",
            "tokens_used": response.usage.total_tokens if response.usage else 0,
            "function_calls": []
        }
        
        if response.choices[0].message.function_call:
            result["function_calls"].append({
                "name": response.choices[0].message.function_call.name,
                "arguments": response.choices[0].message.function_call.arguments
            })
        
        return result
    
    # Removed _call_anthropic method - no longer supporting Anthropic models
    
    def _calculate_cost(self, model: AIModel, tokens_used: int) -> float:
        """Calculate estimated cost based on model and tokens used"""
        cost_per_1k = {
            AIModel.AZURE_OPENAI_GPT4: 0.03,
            AIModel.AZURE_OPENAI_GPT35: 0.002,
            AIModel.GPT_4_TURBO: 0.01,
            AIModel.GPT_4: 0.03,
            AIModel.GPT_35_TURBO: 0.002,
            AIModel.GPT_4O: 0.005,
            AIModel.GPT_4O_MINI: 0.00015
        }
        
        return (tokens_used / 1000) * cost_per_1k.get(model, 0.01)
    
    async def analyze_nsg_configuration(
        self,
        nsg_config: Dict[str, Any],
        analysis_type: str = "comprehensive",
        model: AIModel = AIModel.AZURE_OPENAI_GPT4
    ) -> Dict[str, Any]:
        """Analyze NSG configuration using AI"""
        
        system_prompt = """
You are an expert Azure Network Security Group (NSG) analyst. Your task is to analyze NSG configurations and provide detailed security assessments, compliance checks, and remediation recommendations.

Analyze the provided NSG configuration and provide:
1. Security vulnerabilities and risks
2. Compliance issues (if any)
3. Best practice violations
4. Specific remediation steps
5. Risk scoring (0-100, where 100 is highest risk)
6. Compliance scoring (0-100, where 100 is fully compliant)

Provide your analysis in JSON format with the following structure:
{
  "findings": [
    {
      "type": "security|compliance|best_practice",
      "severity": "low|medium|high|critical",
      "title": "Finding title",
      "description": "Detailed description",
      "affected_rules": ["rule names or IDs"],
      "recommendation": "Specific remediation steps"
    }
  ],
  "risk_score": 0-100,
  "compliance_score": 0-100,
  "summary": "Overall analysis summary",
  "recommendations": ["List of key recommendations"]
}
"""
        
        messages = [
            {
                "role": "user",
                "content": f"Please analyze this NSG configuration:\n\n{json.dumps(nsg_config, indent=2)}\n\nAnalysis type: {analysis_type}"
            }
        ]
        
        response = await self.generate_completion(
            model=model,
            messages=messages,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=3000
        )
        
        try:
            # Parse JSON response
            analysis_result = json.loads(response["content"])
            analysis_result["tokens_used"] = response["tokens_used"]
            analysis_result["cost_estimate"] = response["cost_estimate"]
            analysis_result["execution_time"] = response["execution_time"]
            return analysis_result
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "findings": [],
                "risk_score": 50,
                "compliance_score": 50,
                "summary": response["content"],
                "recommendations": [],
                "tokens_used": response["tokens_used"],
                "cost_estimate": response["cost_estimate"],
                "execution_time": response["execution_time"]
            }
    
    async def generate_remediation_plan(
        self,
        findings: List[Dict[str, Any]],
        nsg_config: Dict[str, Any],
        model: AIModel = AIModel.AZURE_OPENAI_GPT4
    ) -> Dict[str, Any]:
        """Generate detailed remediation plan based on findings"""
        
        system_prompt = """
You are an expert Azure security engineer. Generate a detailed remediation plan based on NSG security findings.

For each finding, provide:
1. Step-by-step remediation instructions
2. Azure CLI commands
3. PowerShell commands
4. Validation steps
5. Rollback procedures

Provide your response in JSON format:
{
  "title": "Remediation Plan Title",
  "description": "Plan description",
  "severity": "low|medium|high|critical",
  "steps": [
    {
      "step_number": 1,
      "title": "Step title",
      "description": "Detailed description",
      "command_type": "azure_cli|powershell|manual",
      "command": "Actual command",
      "expected_result": "What to expect",
      "validation": "How to validate"
    }
  ],
  "azure_cli_commands": ["List of CLI commands"],
  "powershell_commands": ["List of PowerShell commands"],
  "validation_steps": ["List of validation steps"],
  "rollback_steps": ["List of rollback steps"]
}
"""
        
        messages = [
            {
                "role": "user",
                "content": f"Generate a remediation plan for these findings:\n\n{json.dumps(findings, indent=2)}\n\nNSG Configuration:\n{json.dumps(nsg_config, indent=2)}"
            }
        ]
        
        response = await self.generate_completion(
            model=model,
            messages=messages,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=4000
        )
        
        try:
            remediation_plan = json.loads(response["content"])
            remediation_plan["tokens_used"] = response["tokens_used"]
            remediation_plan["cost_estimate"] = response["cost_estimate"]
            remediation_plan["execution_time"] = response["execution_time"]
            return remediation_plan
        except json.JSONDecodeError:
            return {
                "title": "Generated Remediation Plan",
                "description": response["content"],
                "severity": "medium",
                "steps": [],
                "azure_cli_commands": [],
                "powershell_commands": [],
                "validation_steps": [],
                "rollback_steps": [],
                "tokens_used": response["tokens_used"],
                "cost_estimate": response["cost_estimate"],
                "execution_time": response["execution_time"]
            }

# Global AI service instance
ai_service = AIService()