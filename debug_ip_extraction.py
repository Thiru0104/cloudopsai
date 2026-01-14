import ipaddress
from dataclasses import dataclass
from typing import List

@dataclass
class MockASG:
    id: str

@dataclass
class MockRule:
    name: str
    direction: str
    source_address_prefix: str = None
    source_address_prefixes: List[str] = None
    destination_address_prefix: str = None
    destination_address_prefixes: List[str] = None
    source_application_security_groups: List[MockASG] = None
    destination_application_security_groups: List[MockASG] = None

@dataclass
class NSGRule:
    id: str
    name: str
    priority: int
    direction: str
    access: str
    protocol: str
    source_address_prefix: str
    source_port_range: str
    destination_address_prefix: str
    destination_port_range: str
    source_application_security_groups: List[str]
    destination_application_security_groups: List[str]

def _convert_to_nsg_rules(azure_rules) -> List[NSGRule]:
    converted_rules = []
    for rule in azure_rules:
        # Handle prefixes
        src_prefix = rule.source_address_prefix or ""
        if hasattr(rule, 'source_address_prefixes') and rule.source_address_prefixes:
            src_prefix = ",".join(rule.source_address_prefixes)
            
        dest_prefix = rule.destination_address_prefix or ""
        if hasattr(rule, 'destination_address_prefixes') and rule.destination_address_prefixes:
            dest_prefix = ",".join(rule.destination_address_prefixes)
            
        # Handle ASGs
        src_asgs = []
        if rule.source_application_security_groups:
            src_asgs = [asg.id for asg in rule.source_application_security_groups]
            
        dest_asgs = []
        if rule.destination_application_security_groups:
            dest_asgs = [asg.id for asg in rule.destination_application_security_groups]
            
        converted_rules.append(NSGRule(
            id=f"rule-{rule.name}",
            name=rule.name,
            priority=100,
            direction=rule.direction,
            access="Allow",
            protocol="Tcp",
            source_address_prefix=src_prefix,
            source_port_range="*",
            destination_address_prefix=dest_prefix,
            destination_port_range="80",
            source_application_security_groups=src_asgs,
            destination_application_security_groups=dest_asgs
        ))
    return converted_rules

def test_extraction():
    # Mock Data
    rules = [
        MockRule(name="Rule1", direction="Inbound", source_address_prefix="10.0.0.1"),
        MockRule(name="Rule2", direction="Inbound", source_address_prefix="Internet"), # Service Tag
        MockRule(name="Rule3", direction="Inbound", source_address_prefixes=["192.168.1.0/24", "10.0.0.5"]),
        MockRule(name="Rule4", direction="Inbound", source_address_prefix="*", destination_address_prefix="10.0.0.2"),
        MockRule(name="Rule5", direction="Inbound", 
                 source_application_security_groups=[MockASG(id="/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/applicationSecurityGroups/asg-web")]),
        MockRule(name="Rule6", direction="Outbound", destination_address_prefix="VirtualNetwork")
    ]

    converted_rules = _convert_to_nsg_rules(rules)
    
    source_ips_asgs = set()
    dest_ips_asgs = set()
    
    # Helper to check if valid IP/CIDR
    def is_valid_ip_cidr(val):
        try:
            ipaddress.ip_address(val)
            return True
        except ValueError:
            try:
                ipaddress.ip_network(val, strict=False)
                return True
            except ValueError:
                return False

    # Helper to process prefix
    def process_prefix(prefix, target_set):
        if not prefix or prefix == '*': return
        service_tags = {'VirtualNetwork', 'Internet', 'Any', 'AzureLoadBalancer', 'Storage', 'Sql', 'AzureActiveDirectory'}
        entries = [e.strip() for e in prefix.split(',')]
        for entry in entries:
            if not entry or entry in service_tags: continue
            # Match NSGValidator logic: if it has '/' or is valid IP, keep it.
            if '/' in entry or is_valid_ip_cidr(entry):
                target_set.add(entry)
            else:
                print(f"Skipped invalid/tag: {entry}")

    for rule in converted_rules:
        # Source
        if rule.source_address_prefix:
            process_prefix(rule.source_address_prefix, source_ips_asgs)
        if rule.source_application_security_groups:
            for asg in rule.source_application_security_groups:
                # asg is ID string in converted_rules
                target_name = asg.split('/')[-1]
                source_ips_asgs.add(f"ASG:{target_name}")
                
        # Dest
        if rule.destination_address_prefix:
            process_prefix(rule.destination_address_prefix, dest_ips_asgs)
        if rule.destination_application_security_groups:
            for asg in rule.destination_application_security_groups:
                target_name = asg.split('/')[-1]
                dest_ips_asgs.add(f"ASG:{target_name}")

    print("Source IPs + ASGs:", sorted(list(source_ips_asgs)))
    print("Dest IPs + ASGs:", sorted(list(dest_ips_asgs)))

if __name__ == "__main__":
    test_extraction()
