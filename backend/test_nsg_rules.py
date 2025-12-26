#!/usr/bin/env python3

from working_backend import get_azure_clients
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_nsg_rules():
    """Test NSG rules extraction"""
    try:
        clients = get_azure_clients()
        if not clients or not clients[2]:
            print("Failed to get Azure clients")
            return
        
        network_client = clients[2]
        nsgs = list(network_client.network_security_groups.list_all())
        print(f"Found {len(nsgs)} NSGs")
        
        # Focus on AE-nsg
        ae_nsg = next((nsg for nsg in nsgs if nsg.name == 'AE-nsg'), None)
        if not ae_nsg:
            print("AE-nsg not found")
            return
        
        print(f"\nAnalyzing AE-nsg:")
        print(f"Name: {ae_nsg.name}")
        print(f"Resource Group: {ae_nsg.id.split('/')[4] if '/' in ae_nsg.id else 'unknown'}")
        print(f"Location: {ae_nsg.location}")
        
        # Check custom security rules
        custom_rules = ae_nsg.security_rules or []
        print(f"\nCustom Security Rules: {len(custom_rules)}")
        for i, rule in enumerate(custom_rules):
            print(f"  {i+1}. {rule.name} - {rule.direction} - {rule.access} - Priority: {rule.priority}")
        
        # Check default security rules
        default_rules = ae_nsg.default_security_rules or []
        print(f"\nDefault Security Rules: {len(default_rules)}")
        for i, rule in enumerate(default_rules[:5]):  # Show first 5
            print(f"  {i+1}. {rule.name} - {rule.direction} - {rule.access} - Priority: {rule.priority}")
            print(f"      Source: {rule.source_address_prefix} -> Dest: {rule.destination_address_prefix}")
            print(f"      Ports: {rule.source_port_range} -> {rule.destination_port_range}")
            print(f"      Protocol: {rule.protocol}")
        
        if len(default_rules) > 5:
            print(f"  ... and {len(default_rules) - 5} more default rules")
        
        print(f"\nTotal rules (custom + default): {len(custom_rules) + len(default_rules)}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_nsg_rules()