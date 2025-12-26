#!/usr/bin/env python3
"""
Test script to verify Azure NSG restoration functionality
"""

import sys
import os
import asyncio
import logging
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.azure_client import AzureClient
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_azure_restore():
    """Test Azure NSG creation and rule addition"""
    try:
        # Initialize Azure client
        logger.info("Initializing Azure client...")
        azure_client = AzureClient()
        logger.info("Azure client initialized successfully")
        
        # Test data - using existing resource group
        test_rg = "Resourcegroup001"
        test_nsg = "test-restored-nsg"
        test_location = "East US"
        
        logger.info(f"Using existing resource group '{test_rg}'")
        
        # Test NSG creation
        logger.info(f"Creating NSG '{test_nsg}' in resource group '{test_rg}'...")
        nsg_result = await azure_client.create_nsg(test_rg, test_nsg, test_location)
        logger.info(f"NSG creation result: {nsg_result}")
        
        # Test rule creation
        test_rule = {
            "name": "AllowHTTP",
            "protocol": "TCP",
            "source_port_range": "*",
            "destination_port_range": "80",
            "source_address_prefix": "*",
            "destination_address_prefix": "*",
            "access": "Allow",
            "priority": 100,
            "direction": "Inbound",
            "description": "Allow HTTP traffic"
        }
        
        logger.info(f"Adding rule '{test_rule['name']}' to NSG '{test_nsg}'...")
        rule_result = await azure_client.create_nsg_rule(test_rg, test_nsg, test_rule)
        logger.info(f"Rule creation result: {rule_result}")
        
        logger.info("Azure restore test completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Azure restore test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function"""
    logger.info("Starting Azure NSG restore test...")
    logger.info(f"Azure Subscription ID: {settings.AZURE_SUBSCRIPTION_ID}")
    logger.info(f"Azure Tenant ID: {settings.AZURE_TENANT_ID}")
    logger.info(f"Azure Client ID: {settings.AZURE_CLIENT_ID}")
    
    # Run the async test
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        success = loop.run_until_complete(test_azure_restore())
        if success:
            logger.info("✅ Test passed: Azure restore functionality is working")
            sys.exit(0)
        else:
            logger.error("❌ Test failed: Azure restore functionality has issues")
            sys.exit(1)
    finally:
        loop.close()

if __name__ == "__main__":
    main()