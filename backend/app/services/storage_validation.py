import logging
import asyncio
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.services.storage_service import StorageService
from app.services.ai_service import AIService
from app.models.storage import StorageAccountReport, ContainerReport

logger = logging.getLogger(__name__)

class StorageValidator:
    def __init__(self):
        self.storage_service = StorageService()
        self.ai_service = AIService()

    async def validate_storage(
        self,
        subscription_id: str,
        resource_group: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate storage accounts and containers based on predefined rules.
        """
        try:
            # 1. Fetch Data
            accounts_report = await self.storage_service.get_storage_report(
                subscription_id=subscription_id,
                resource_group=resource_group
            )
            
            containers_report = await self.storage_service.get_containers_report(
                subscription_id=subscription_id,
                resource_group=resource_group
            )

            # 2. Analyze Data
            empty_accounts = []
            inactive_accounts = []
            large_accounts = []
            
            empty_containers = []
            large_containers = []

            # Accounts Analysis
            for account in accounts_report:
                # Empty: Size is 0 or very small
                if account.total_size_gb < 0.000001:  # < 1KB approx
                    empty_accounts.append(account.storage_account)
                
                # Inactive: Status is Inactive (logic already in StorageService)
                if account.status == 'Inactive':
                    inactive_accounts.append(account.storage_account)
                
                # Large: > 100 MB (0.1 GB)
                if account.total_size_gb > 0.1:
                    large_accounts.append({
                        "name": account.storage_account,
                        "size_gb": account.total_size_gb
                    })

            # Containers Analysis
            for container in containers_report:
                # Empty: Blob count 0
                if container.blob_count == 0:
                    empty_containers.append(container.container_name)
                
                # Large: > 100 MB
                if container.total_size_gb > 0.1:
                    large_containers.append({
                        "account": container.storage_account,
                        "container": container.container_name,
                        "size_gb": container.total_size_gb
                    })

            # Calculate totals
            total_size_gb = sum(acc.total_size_gb for acc in accounts_report)

            validation_result = {
                "summary": {
                    "total_accounts": len(accounts_report),
                    "total_containers": len(containers_report),
                    "total_size_gb": total_size_gb,
                    "empty_accounts_count": len(empty_accounts),
                    "inactive_accounts_count": len(inactive_accounts),
                    "large_accounts_count": len(large_accounts),
                    "empty_containers_count": len(empty_containers),
                    "large_containers_count": len(large_containers)
                },
                "details": {
                    "empty_accounts": empty_accounts,
                    "inactive_accounts": inactive_accounts,
                    "large_accounts": large_accounts,
                    "empty_containers": empty_containers,
                    "large_containers": large_containers
                }
            }

            return validation_result

        except Exception as e:
            logger.error(f"Error in storage validation: {e}")
            raise

    async def generate_llm_recommendations(self, validation_data: Dict) -> Dict:
        """
        Generate AI-powered recommendations based on validation results
        """
        try:
            # Extract details from validation data
            validation_details = validation_data.get("details", {})
            
            empty_accounts = validation_details.get("empty_accounts", [])
            inactive_accounts = validation_details.get("inactive_accounts", [])
            large_accounts = validation_details.get("large_accounts", [])
            large_containers = validation_details.get("large_containers", [])

            # Prepare data for LLM
            # Take top 10 of each category to avoid token limits
            details = {
                "empty_accounts": empty_accounts[:10] if empty_accounts else [],
                "inactive_accounts": inactive_accounts[:10] if inactive_accounts else [],
                "large_accounts": large_accounts[:10] if large_accounts else [],
                "large_containers": large_containers[:10] if large_containers else []
            }
            
            logger.info(f"Generating LLM recommendations for {len(details['empty_accounts'])} empty, {len(details['inactive_accounts'])} inactive, {len(details['large_accounts'])} large accounts")
            logger.debug(f"LLM Input Details: {json.dumps(details, default=str)}")

            prompt = f"""
            You are an expert Azure Storage Optimization Consultant.
            Analyze the following Azure Storage usage report and provide comprehensive optimization recommendations covering:
            1. Cost Optimization (e.g., removing empty resources, tiering inactive data)
            2. Performance Tuning (e.g., handling large containers, optimizing access patterns)
            3. Operational Efficiency (lifecycle management strategies)
            4. Security & Redundancy (general best practices)
            
            Data Summary:
            - Empty Storage Accounts (Candidates for removal): {json.dumps(details['empty_accounts'], default=str)}
            - Inactive Accounts (>90 days no activity): {json.dumps(details['inactive_accounts'], default=str)}
            - Large Storage Accounts (>100GB): {json.dumps(details['large_accounts'], default=str)}
            - Large Containers (>100GB): {json.dumps(details['large_containers'], default=str)}
            
            If specific data is empty, please still provide general best practice recommendations relevant to the category.
            
            Based on this data, provide:
            1. A list of specific actionable recommendations.
            2. A suggested lifecycle management policy in JSON format.
            
            Return the response in the following JSON format ONLY (no markdown, no extra text):
            {{
                "recommendations": [
                    {{
                        "title": "Recommendation Title",
                        "description": "Detailed description including potential savings or benefits.",
                        "action": "Specific Action to take",
                        "target_resources": ["resource1", "resource2"],
                        "impact": "High/Medium/Low",
                        "priority": "High/Medium/Low",
                        "category": "Cost|Performance|Security|Operations"
                    }}
                ],
                "lifecycle_policy": {{
                    "name": "SuggestedPolicyName",
                    "rules": [
                        {{
                            "name": "Rule Name",
                            "action": "Action (e.g., TierToCool, Delete)",
                            "days_after_modification_greater_than": 30
                        }}
                    ]
                }}
            }}
            """

            # Call LLM
            messages = [{"role": "user", "content": prompt}]
            
            # Use Azure OpenAI GPT-4 by default or fallback to others
            from app.schemas.agent import AIModel
            model = AIModel.AZURE_OPENAI_GPT4
            
            logger.info(f"Calling AI Service with model: {model}")
            response = await self.ai_service.generate_completion(
                model=model,
                messages=messages,
                temperature=0.2,
                max_tokens=2000
            )
            
            content = response.get("content", "")
            logger.info(f"LLM Response length: {len(content)}")
            logger.debug(f"LLM Raw Response: {content}")
            
            # Parse JSON
            try:
                # Clean up markdown code blocks if present
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                    
                parsed_response = json.loads(content)
                logger.info("Successfully parsed LLM response")
                return parsed_response
            except Exception as e:
                logger.warning(f"Failed to parse LLM response as JSON. Error: {e}")
                logger.warning(f"Content causing error: {content}")
                return {"raw_recommendations": content}

        except Exception as e:
            logger.error(f"Error generating LLM recommendations: {e}")
            # Fallback for demonstration/error handling
            return {
                "recommendations": [
                    {
                        "title": "AI Service Unavailable - General Best Practice",
                        "description": f"The AI service could not be reached ({str(e)}). Review storage accounts for unused resources manually.",
                        "action": "Check Access Keys and Network Settings",
                        "target_resources": ["All Storage Accounts"],
                        "impact": "High",
                        "priority": "High",
                        "category": "Operations"
                    },
                    {
                        "title": "Enable Soft Delete",
                        "description": "Ensure Soft Delete is enabled for blob storage to protect against accidental deletion.",
                        "action": "Enable Soft Delete",
                        "target_resources": ["All Containers"],
                        "impact": "Medium",
                        "priority": "Medium",
                        "category": "Security"
                    }
                ],
                "lifecycle_policy": {
                    "name": "DefaultFallbackPolicy",
                    "rules": [
                        {
                            "name": "MoveToCool",
                            "action": "TierToCool",
                            "days_after_modification_greater_than": 30
                        }
                    ]
                }
            }

    def _serialize_account(self, account: StorageAccountReport) -> Dict:
        return {
            "name": account.storage_account,
            "size_gb": account.total_size_gb,
            "last_activity": account.last_activity,
            "status": account.status
        }

    def _serialize_container(self, container: ContainerReport) -> Dict:
        return {
            "account": container.storage_account,
            "container": container.container_name,
            "size_gb": container.total_size_gb,
            "blob_count": container.blob_count,
            "last_activity": container.last_activity
        }


