from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
import os
from dotenv import load_dotenv
from azure.identity import ClientSecretCredential
from azure.mgmt.subscription import SubscriptionClient
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.network import NetworkManagementClient
import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Azure clients
def get_azure_credential():
    """Get Azure credential from environment variables with timeout"""
    tenant_id = os.getenv('AZURE_TENANT_ID')
    client_id = os.getenv('AZURE_CLIENT_ID')
    client_secret = os.getenv('AZURE_CLIENT_SECRET')
    
    logger.info(f"Checking Azure credentials: tenant_id={'***' if tenant_id else 'None'}, client_id={'***' if client_id else 'None'}, client_secret={'***' if client_secret else 'None'}")
    
    if not all([tenant_id, client_id, client_secret]):
        logger.error("Missing Azure credentials in environment variables")
        return None
    
    try:
        logger.info("Creating Azure credential...")
        credential = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret
        )
        logger.info("Azure credential created successfully")
        return credential
    except Exception as e:
        logger.error(f"Failed to create Azure credential: {e}")
        return None

def get_real_subscriptions():
    """Get subscriptions - using mock data for now to avoid Azure authentication issues"""
    logger.info("Using mock subscription data to avoid Azure authentication delays")
    return get_mock_subscriptions()

def get_mock_subscriptions():
    """Fallback mock subscriptions"""
    return [
        {
            "subscription_id": "0a519345-d9f4-400c-a3b4-e8379de6638e",
            "display_name": "Azure Subscription (Mock)",
            "state": "Enabled",
            "tenant_id": "64b85bc1-b5cf-4169-9b23-8addcc72c198"
        }
    ]

def get_real_resource_groups(subscription_id):
    """Get resource groups - using mock data for now"""
    logger.info(f"Using mock resource group data for subscription {subscription_id}")
    return get_mock_resource_groups(subscription_id)

def get_mock_resource_groups(subscription_id):
    """Fallback mock resource groups"""
    return [
        {
            "name": "rg-cloudopsai-prod",
            "id": f"/subscriptions/{subscription_id}/resourceGroups/rg-cloudopsai-prod",
            "location": "eastus",
            "subscription_id": subscription_id,
            "provisioning_state": "Succeeded",
            "tags": {"Environment": "Production", "Project": "CloudOpsAI"}
        },
        {
            "name": "rg-cloudopsai-dev",
            "id": f"/subscriptions/{subscription_id}/resourceGroups/rg-cloudopsai-dev",
            "location": "eastus",
            "subscription_id": subscription_id,
            "provisioning_state": "Succeeded",
            "tags": {"Environment": "Development", "Project": "CloudOpsAI"}
        }
    ]

def get_real_locations(subscription_id):
    """Get locations - using mock data for now"""
    logger.info(f"Using mock location data for subscription {subscription_id}")
    return get_mock_locations(subscription_id)

def get_mock_locations(subscription_id):
    """Fallback mock locations"""
    return [
        {
            "name": "eastus",
            "display_name": "East US",
            "latitude": "37.3719",
            "longitude": "-79.8164",
            "subscription_id": subscription_id
        },
        {
            "name": "westus2",
            "display_name": "West US 2",
            "latitude": "47.233",
            "longitude": "-119.852",
            "subscription_id": subscription_id
        }
    ]

def get_real_nsgs(subscription_id, resource_group=None):
    """Get NSGs - using mock data for now"""
    logger.info(f"Using mock NSG data for subscription {subscription_id}, resource_group {resource_group}")
    return get_mock_nsgs(subscription_id, resource_group)

def get_mock_nsgs(subscription_id, resource_group=None):
    """Fallback mock NSGs"""
    return [
        {
            "id": f"/subscriptions/{subscription_id}/resourceGroups/rg-cloudopsai-prod/providers/Microsoft.Network/networkSecurityGroups/nsg-web-prod",
            "name": "nsg-web-prod",
            "location": "eastus",
            "resource_group": "rg-cloudopsai-prod",
            "subscription_id": subscription_id,
            "provisioning_state": "Succeeded",
            "etag": "W/\"12345678-1234-1234-1234-123456789012\"",
            "tags": {"Environment": "Production", "Tier": "Web"},
            "rules_count": 8,
            "compliance_score": 85.0,
            "risk_level": "Medium",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:30:00Z"
        },
        {
            "id": f"/subscriptions/{subscription_id}/resourceGroups/rg-cloudopsai-dev/providers/Microsoft.Network/networkSecurityGroups/nsg-web-dev",
            "name": "nsg-web-dev",
            "location": "eastus",
            "resource_group": "rg-cloudopsai-dev",
            "subscription_id": subscription_id,
            "provisioning_state": "Succeeded",
            "etag": "W/\"87654321-4321-4321-4321-210987654321\"",
            "tags": {"Environment": "Development", "Tier": "Web"},
            "rules_count": 6,
            "compliance_score": 78.0,
            "risk_level": "Low",
            "created_at": "2024-01-10T14:20:00Z",
            "updated_at": "2024-01-12T09:15:00Z"
        }
    ]

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query_params = urllib.parse.parse_qs(parsed_path.query)
        
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        # Route handling
        if path == '/api/v1/nsgs':
            subscription_id = query_params.get('subscription_id', [''])[0]
            resource_group = query_params.get('resource_group', [''])[0] or None
            nsgs = get_real_nsgs(subscription_id, resource_group)
            response = {"nsgs": nsgs}
            
        elif path == '/api/v1/subscriptions':
            logger.info("Received request for /api/v1/subscriptions")
            subscriptions = get_real_subscriptions()
            response = {"subscriptions": subscriptions}
            
        elif path == '/api/v1/health':
            logger.info("Received health check request")
            response = {"status": "healthy", "message": "Server is running"}
            
        elif path == '/api/v1/resource-groups':
            subscription_id = query_params.get('subscription_id', [''])[0]
            resource_groups = get_real_resource_groups(subscription_id)
            response = {"resource_groups": resource_groups}
            
        elif path == '/api/v1/locations':
            subscription_id = query_params.get('subscription_id', [''])[0]
            locations = get_real_locations(subscription_id)
            response = {"locations": locations}
            
        elif path == '/api/v1/nsgs/backups':
            response = {
                "backups": [
                    {
                        "id": "backup-1",
                        "name": "NSG Backup 2024-01-15",
                        "created_at": "2024-01-15T10:30:00Z",
                        "size": "2.5 MB",
                        "status": "Completed"
                    }
                ]
            }
            
        elif path == '/api/v1/nsgs/golden-rules':
            response = {
                "golden_rules": [
                    {
                        "id": "rule-1",
                        "name": "Standard Security Rules",
                        "description": "Default security configuration for production NSGs",
                        "rules_count": 12,
                        "compliance_score": 95.0,
                        "created_at": "2024-01-10T08:00:00Z"
                    }
                ]
            }
            
        elif path == '/api/v1/agents':
            response = {
                "agents": [
                    {
                        "id": "agent-1",
                        "name": "Security Analyzer",
                        "type": "Analysis",
                        "model": "Azure OpenAI GPT-4",
                        "status": "Running",
                        "performance": 92.5,
                        "last_run": "2024-01-15T14:30:00Z"
                    }
                ]
            }
        else:
            response = {"error": "Not found"}
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8000), SimpleHandler)
    print("Simple test backend server running on http://localhost:8000")
    print("Available endpoints:")
    print("  GET /api/v1/nsgs")
    print("  GET /api/v1/subscriptions")
    print("  GET /api/v1/resource-groups?subscription_id=<id>")
    print("  GET /api/v1/locations?subscription_id=<id>")
    server.serve_forever()