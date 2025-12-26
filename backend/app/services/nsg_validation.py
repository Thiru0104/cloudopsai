import asyncio
import re
import ipaddress
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass
from azure.mgmt.network import NetworkManagementClient
from azure.identity import DefaultAzureCredential
import os
from datetime import datetime
from collections import defaultdict
from app.services.ai_service import AIService
from app.schemas.agent import AIModel

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

@dataclass
class ValidationViolation:
    type: str
    severity: str
    message: str
    affected_rules: List[str]
    current_count: int
    max_allowed: int

@dataclass
class LLMRecommendation:
    id: str
    type: str
    title: str
    description: str
    impact: str
    implementation: str
    estimated_savings: Dict[str, int]
    priority: str

class NSGValidator:
    def __init__(self):
        self.credential = DefaultAzureCredential()
        self.max_ip_addresses = 4000
        self.security_risk_patterns = {
            'wildcard': ['*', '0.0.0.0/0', '::/0'],
            'large_cidrs': ['/8', '/9', '/10', '/11', '/12'],
            'common_ports': ['22', '3389', '80', '443', '21', '23']
        }
        self.ai_service = AIService()
        
    def count_ip_addresses(self, address_prefix: str) -> int:
        """Count IP addresses in a comma-separated CIDR list (excludes ASGs)"""
        if not address_prefix or address_prefix == '*':
            return 0  # Don't count wildcard as IP
            
        # Service tags that should not be counted as IP addresses
        service_tags = {'VirtualNetwork', 'Internet', 'Any', 'AzureLoadBalancer', 'Storage', 'Sql', 'AzureActiveDirectory'}
        
        # Split by comma and count each entry
        entries = [entry.strip() for entry in address_prefix.split(',')]
        total_count = 0
        
        for entry in entries:
            if not entry:
                continue
                
            # Skip service tags
            if entry in service_tags:
                continue
                
            # Skip ASGs - they are counted separately
            if entry.startswith('/subscriptions/') and 'applicationSecurityGroups' in entry:
                continue
                
            # Count CIDR blocks and individual IPs
            if '/' in entry or self._is_valid_ip(entry):
                total_count += 1
                
        return total_count
    
    def _is_valid_ip(self, ip_str: str) -> bool:
        """Check if string is a valid IP address"""
        try:
            import ipaddress
            ipaddress.ip_address(ip_str)
            return True
        except ValueError:
            return False
    
    def _collect_unique_ips(self, address_prefix: str, ip_set: set) -> None:
        """Collect unique IP addresses from a comma-separated list"""
        if not address_prefix or address_prefix == '*':
            return
            
        # Service tags that should not be counted as IP addresses
        service_tags = {'VirtualNetwork', 'Internet', 'Any', 'AzureLoadBalancer', 'Storage', 'Sql', 'AzureActiveDirectory'}
        
        # Split by comma and collect each entry
        entries = [entry.strip() for entry in address_prefix.split(',')]
        
        for entry in entries:
            if not entry or entry in service_tags:
                continue
                
            # Skip ASGs - they are counted separately
            if entry.startswith('/subscriptions/') and 'applicationSecurityGroups' in entry:
                continue
                
            # Add CIDR blocks and individual IPs
            if '/' in entry or self._is_valid_ip(entry):
                ip_set.add(entry)
    
    def _count_ips_in_addresses(self, address_list: list) -> int:
        """Count total IP addresses in a list of address prefixes"""
        total_count = 0
        for address_prefix in address_list:
            if address_prefix:
                total_count += self.count_ip_addresses(address_prefix)
        return total_count
    
    def _count_asgs_in_addresses(self, address_list: list) -> int:
        """Count total ASGs in a list of address prefixes"""
        asg_count = 0
        for address_prefix in address_list:
            if not address_prefix:
                continue
            # Split by comma and count ASG entries
            entries = [entry.strip() for entry in address_prefix.split(',')]
            for entry in entries:
                if entry.startswith('/subscriptions/') and 'applicationSecurityGroups' in entry:
                    asg_count += 1
        return asg_count
    

    
    def analyze_nsg_rules_from_demo(self, demo_rules: List[NSGRule]) -> Dict[str, Any]:
        """Analyze demo NSG rules without Azure API calls"""
        try:
            rules = demo_rules
            violations = []
            
            # Use sets to collect unique IPs and ASGs for inbound and outbound separately
            inbound_source_ips = set()
            inbound_dest_ips = set()
            inbound_source_asgs = set()
            inbound_dest_asgs = set()
            
            outbound_source_ips = set()
            outbound_dest_ips = set()
            outbound_source_asgs = set()
            outbound_dest_asgs = set()
            
            inbound_rules = 0
            outbound_rules = 0
            
            # Analyze each rule
            for rule in rules:
                # Count direction and collect IPs/ASGs separately for inbound and outbound
                if rule.direction == 'Inbound':
                    inbound_rules += 1
                    
                    # Collect inbound source IPs
                    if rule.source_address_prefix:
                        self._collect_unique_ips(rule.source_address_prefix, inbound_source_ips)
                    
                    # Collect inbound destination IPs
                    if rule.destination_address_prefix:
                        self._collect_unique_ips(rule.destination_address_prefix, inbound_dest_ips)
                    
                    # Collect inbound ASGs
                    for asg in (rule.source_application_security_groups or []):
                        inbound_source_asgs.add(asg)
                    
                    for asg in (rule.destination_application_security_groups or []):
                        inbound_dest_asgs.add(asg)
                        
                else:  # Outbound
                    outbound_rules += 1
                    
                    # Collect outbound source IPs
                    if rule.source_address_prefix:
                        self._collect_unique_ips(rule.source_address_prefix, outbound_source_ips)
                    
                    # Collect outbound destination IPs
                    if rule.destination_address_prefix:
                        self._collect_unique_ips(rule.destination_address_prefix, outbound_dest_ips)
                    
                    # Collect outbound ASGs
                    for asg in (rule.source_application_security_groups or []):
                        outbound_source_asgs.add(asg)
                    
                    for asg in (rule.destination_application_security_groups or []):
                        outbound_dest_asgs.add(asg)
            
            # Check Azure limits - for demo, we'll skip per-rule validation since we don't have individual rule objects
            # Just check overall counts against limits
            total_inbound_source = len(inbound_source_ips) + len(inbound_source_asgs)
            total_inbound_dest = len(inbound_dest_ips) + len(inbound_dest_asgs)
            total_outbound_source = len(outbound_source_ips) + len(outbound_source_asgs)
            total_outbound_dest = len(outbound_dest_ips) + len(outbound_dest_asgs)
            
            # Check if any category exceeds limits
            if total_inbound_source > self.max_ip_addresses:
                violations.append(ValidationViolation(
                    type='IP_LIMIT_EXCEEDED',
                    severity='Critical',
                    message=f'Inbound source addresses exceed limit ({total_inbound_source} > {self.max_ip_addresses})',
                    affected_rules=['Multiple rules'],
                    current_count=total_inbound_source,
                    max_allowed=self.max_ip_addresses
                ))
            
            if total_inbound_dest > self.max_ip_addresses:
                violations.append(ValidationViolation(
                    type='IP_LIMIT_EXCEEDED',
                    severity='Critical',
                    message=f'Inbound destination addresses exceed limit ({total_inbound_dest} > {self.max_ip_addresses})',
                    affected_rules=['Multiple rules'],
                    current_count=total_inbound_dest,
                    max_allowed=self.max_ip_addresses
                ))
            
            if total_outbound_source > self.max_ip_addresses:
                violations.append(ValidationViolation(
                    type='IP_LIMIT_EXCEEDED',
                    severity='Critical',
                    message=f'Outbound source addresses exceed limit ({total_outbound_source} > {self.max_ip_addresses})',
                    affected_rules=['Multiple rules'],
                    current_count=total_outbound_source,
                    max_allowed=self.max_ip_addresses
                ))
            
            if total_outbound_dest > self.max_ip_addresses:
                violations.append(ValidationViolation(
                    type='IP_LIMIT_EXCEEDED',
                    severity='Critical',
                    message=f'Outbound destination addresses exceed limit ({total_outbound_dest} > {self.max_ip_addresses})',
                    affected_rules=['Multiple rules'],
                    current_count=total_outbound_dest,
                    max_allowed=self.max_ip_addresses
                ))
            
            # Generate detailed report
            detailed_report = {
                'ipAsgAnalysis': self._generate_ip_asg_analysis(
                    inbound_source_ips, inbound_dest_ips, inbound_source_asgs, inbound_dest_asgs,
                    outbound_source_ips, outbound_dest_ips, outbound_source_asgs, outbound_dest_asgs
                ),
                'countExplanations': self._generate_count_explanations(
                    inbound_source_ips, inbound_dest_ips, inbound_source_asgs, inbound_dest_asgs,
                    outbound_source_ips, outbound_dest_ips, outbound_source_asgs, outbound_dest_asgs,
                    inbound_rules, outbound_rules
                ),
                'ruleAnalysis': self._generate_rule_analysis(rules)
            }
            
            return {
                'nsgName': 'demo-nsg',
                'resourceGroup': 'demo-rg',
                'totalRules': len(rules),
                'inboundRules': inbound_rules,
                'outboundRules': outbound_rules,
                
                # Inbound counts
                'inboundSourceIpCount': len(inbound_source_ips),
                'inboundDestinationIpCount': len(inbound_dest_ips),
                'inboundSourceAsgCount': len(inbound_source_asgs),
                'inboundDestinationAsgCount': len(inbound_dest_asgs),
                
                # Outbound counts
                'outboundSourceIpCount': len(outbound_source_ips),
                'outboundDestinationIpCount': len(outbound_dest_ips),
                'outboundSourceAsgCount': len(outbound_source_asgs),
                'outboundDestinationAsgCount': len(outbound_dest_asgs),
                
                # Legacy fields for backward compatibility
                'sourceIpCount': len(inbound_source_ips) + len(outbound_source_ips),
                'destinationIpCount': len(inbound_dest_ips) + len(outbound_dest_ips),
                'asgCount': len(inbound_source_asgs) + len(inbound_dest_asgs) + len(outbound_source_asgs) + len(outbound_dest_asgs),
                
                'isWithinLimits': len(violations) == 0,
                'violations': [{
                    'type': v.violation_type,
                    'message': v.message,
                    'affectedRules': v.affected_rules,
                    'currentCount': v.current_count,
                    'maxAllowed': v.max_allowed
                } for v in violations],
                'recommendations': [],  # Will be populated by LLM analysis
                'aiAnalysis': self._perform_ai_analysis(rules),
                'detailedReport': detailed_report
            }
            
        except Exception as e:
            raise Exception(f"Failed to analyze demo NSG: {str(e)}")
    
    def analyze_nsg_rules(self, subscription_id: str, resource_group: str, nsg_name: str) -> Dict[str, Any]:
        """Analyze NSG rules for Azure limitations"""
        try:
            network_client = NetworkManagementClient(self.credential, subscription_id)
            nsg = network_client.network_security_groups.get(resource_group, nsg_name)
            
            rules = []
            violations = []
            
            # Use sets to collect unique IPs and ASGs for inbound and outbound separately
            inbound_source_ips = set()
            inbound_dest_ips = set()
            inbound_source_asgs = set()
            inbound_dest_asgs = set()
            
            outbound_source_ips = set()
            outbound_dest_ips = set()
            outbound_source_asgs = set()
            outbound_dest_asgs = set()
            
            inbound_rules = 0
            outbound_rules = 0
            
            # Analyze each rule
            for rule in nsg.security_rules:
                nsg_rule = NSGRule(
                    id=rule.name,
                    name=rule.name,
                    priority=rule.priority,
                    direction=rule.direction,
                    access=rule.access,
                    protocol=rule.protocol,
                    source_address_prefix=rule.source_address_prefix or '',
                    source_port_range=rule.source_port_range or '',
                    destination_address_prefix=rule.destination_address_prefix or '',
                    destination_port_range=rule.destination_port_range or '',
                    source_application_security_groups=[
                        asg.id for asg in (rule.source_application_security_groups or [])
                    ],
                    destination_application_security_groups=[
                        asg.id for asg in (rule.destination_application_security_groups or [])
                    ]
                )
                rules.append(nsg_rule)
                
                # Count direction and collect IPs/ASGs separately for inbound and outbound
                if rule.direction == 'Inbound':
                    inbound_rules += 1
                    
                    # Collect inbound source IPs
                    if rule.source_address_prefix:
                        self._collect_unique_ips(rule.source_address_prefix, inbound_source_ips)
                    
                    if hasattr(rule, 'source_address_prefixes') and rule.source_address_prefixes:
                        for prefix in rule.source_address_prefixes:
                            self._collect_unique_ips(prefix, inbound_source_ips)
                    
                    # Collect inbound destination IPs
                    if rule.destination_address_prefix:
                        self._collect_unique_ips(rule.destination_address_prefix, inbound_dest_ips)
                    
                    if hasattr(rule, 'destination_address_prefixes') and rule.destination_address_prefixes:
                        for prefix in rule.destination_address_prefixes:
                            self._collect_unique_ips(prefix, inbound_dest_ips)
                    
                    # Collect inbound ASGs
                    for asg in (rule.source_application_security_groups or []):
                        inbound_source_asgs.add(asg.id)
                    
                    for asg in (rule.destination_application_security_groups or []):
                        inbound_dest_asgs.add(asg.id)
                        
                else:  # Outbound
                    outbound_rules += 1
                    
                    # Collect outbound source IPs
                    if rule.source_address_prefix:
                        self._collect_unique_ips(rule.source_address_prefix, outbound_source_ips)
                    
                    if hasattr(rule, 'source_address_prefixes') and rule.source_address_prefixes:
                        for prefix in rule.source_address_prefixes:
                            self._collect_unique_ips(prefix, outbound_source_ips)
                    
                    # Collect outbound destination IPs
                    if rule.destination_address_prefix:
                        self._collect_unique_ips(rule.destination_address_prefix, outbound_dest_ips)
                    
                    if hasattr(rule, 'destination_address_prefixes') and rule.destination_address_prefixes:
                        for prefix in rule.destination_address_prefixes:
                            self._collect_unique_ips(prefix, outbound_dest_ips)
                    
                    # Collect outbound ASGs
                    for asg in (rule.source_application_security_groups or []):
                        outbound_source_asgs.add(asg.id)
                    
                    for asg in (rule.destination_application_security_groups or []):
                        outbound_dest_asgs.add(asg.id)
                
                # Count for per-rule validation
                source_ip_count = self.count_ip_addresses(rule.source_address_prefix or '')
                if hasattr(rule, 'source_address_prefixes') and rule.source_address_prefixes:
                    source_ip_count += sum(self.count_ip_addresses(prefix) for prefix in rule.source_address_prefixes)
                
                dest_ip_count = self.count_ip_addresses(rule.destination_address_prefix or '')
                if hasattr(rule, 'destination_address_prefixes') and rule.destination_address_prefixes:
                    dest_ip_count += sum(self.count_ip_addresses(prefix) for prefix in rule.destination_address_prefixes)
                
                source_asg_count = len(rule.source_application_security_groups or [])
                dest_asg_count = len(rule.destination_application_security_groups or [])
                
                total_source_count = source_ip_count + source_asg_count
                total_dest_count = dest_ip_count + dest_asg_count
                
                # Check for violations (including ASGs in the count)
                if total_source_count > self.max_ip_addresses:
                    violations.append(ValidationViolation(
                        type='IP_LIMIT_EXCEEDED',
                        severity='Critical',
                        message=f'Rule "{rule.name}" exceeds maximum IP addresses in source ({total_source_count} > {self.max_ip_addresses}) - IPs: {source_ip_count}, ASGs: {source_asg_count}',
                        affected_rules=[rule.name],
                        current_count=total_source_count,
                        max_allowed=self.max_ip_addresses
                    ))
                    
                if total_dest_count > self.max_ip_addresses:
                    violations.append(ValidationViolation(
                        type='IP_LIMIT_EXCEEDED',
                        severity='Critical',
                        message=f'Rule "{rule.name}" exceeds maximum IP addresses in destination ({total_dest_count} > {self.max_ip_addresses}) - IPs: {dest_ip_count}, ASGs: {dest_asg_count}',
                        affected_rules=[rule.name],
                        current_count=total_dest_count,
                        max_allowed=self.max_ip_addresses
                    ))
            
            # Check overall compliance
            is_within_limits = len(violations) == 0
            
            # Calculate totals for inbound and outbound separately
            inbound_source_ip_count = len(inbound_source_ips)
            inbound_dest_ip_count = len(inbound_dest_ips)
            inbound_source_asg_count = len(inbound_source_asgs)
            inbound_dest_asg_count = len(inbound_dest_asgs)
            
            outbound_source_ip_count = len(outbound_source_ips)
            outbound_dest_ip_count = len(outbound_dest_ips)
            outbound_source_asg_count = len(outbound_source_asgs)
            outbound_dest_asg_count = len(outbound_dest_asgs)
            
            # Combined counts for inbound (source IPs + ASGs, destination IPs + ASGs)
            inbound_combined_source_count = inbound_source_ip_count + inbound_source_asg_count
            inbound_combined_dest_count = inbound_dest_ip_count + inbound_dest_asg_count
            
            # Combined counts for outbound (source IPs + ASGs, destination IPs + ASGs)
            outbound_combined_source_count = outbound_source_ip_count + outbound_source_asg_count
            outbound_combined_dest_count = outbound_dest_ip_count + outbound_dest_asg_count
            
            # Total ASG count
            total_asgs = inbound_source_asg_count + inbound_dest_asg_count + outbound_source_asg_count + outbound_dest_asg_count
            
            # Generate detailed report structure
            detailed_report = self._generate_detailed_report(
                nsg_name, resource_group, rules, violations,
                inbound_source_ips, inbound_dest_ips, inbound_source_asgs, inbound_dest_asgs,
                outbound_source_ips, outbound_dest_ips, outbound_source_asgs, outbound_dest_asgs,
                inbound_rules, outbound_rules
            )
            
            return {
                'nsgName': nsg_name,
                'resourceGroup': resource_group,
                'totalRules': len(rules),
                'inboundRules': inbound_rules,
                'outboundRules': outbound_rules,
                
                # Inbound counts
                'inboundSourceIpCount': inbound_combined_source_count,
                'inboundDestinationIpCount': inbound_combined_dest_count,
                'inboundSourceAsgCount': inbound_source_asg_count,
                'inboundDestinationAsgCount': inbound_dest_asg_count,
                
                # Outbound counts
                'outboundSourceIpCount': outbound_combined_source_count,
                'outboundDestinationIpCount': outbound_combined_dest_count,
                'outboundSourceAsgCount': outbound_source_asg_count,
                'outboundDestinationAsgCount': outbound_dest_asg_count,
                
                # Legacy fields for backward compatibility
                'sourceIpCount': inbound_combined_source_count + outbound_combined_source_count,
                'destinationIpCount': inbound_combined_dest_count + outbound_combined_dest_count,
                'asgCount': total_asgs,
                
                'isWithinLimits': is_within_limits,
                'violations': [{
                    'type': v.type,
                    'severity': v.severity,
                    'message': v.message,
                    'affectedRules': v.affected_rules,
                    'currentCount': v.current_count,
                    'maxAllowed': v.max_allowed
                } for v in violations],
                'recommendations': [],  # Will be populated by LLM analysis
                'aiAnalysis': self._perform_ai_analysis(rules),
                'detailedReport': detailed_report
            }
            
        except Exception as e:
            raise Exception(f"Failed to analyze NSG: {str(e)}")
    
    def _generate_detailed_report(self, nsg_name: str, resource_group: str, rules: List[NSGRule], 
                                violations: List[ValidationViolation], inbound_source_ips: set, 
                                inbound_dest_ips: set, inbound_source_asgs: set, inbound_dest_asgs: set,
                                outbound_source_ips: set, outbound_dest_ips: set, outbound_source_asgs: set, 
                                outbound_dest_asgs: set, inbound_rules: int, outbound_rules: int) -> Dict[str, Any]:
        """Generate comprehensive detailed report with executive summary and technical analysis"""
        
        # Calculate risk score
        risk_score = self._calculate_risk_score(rules, violations)
        
        # Generate executive summary
        executive_summary = self._generate_executive_summary(
            nsg_name, resource_group, len(rules), violations, risk_score
        )
        
        # Generate detailed IP and ASG analysis
        ip_asg_analysis = self._generate_ip_asg_analysis(
            inbound_source_ips, inbound_dest_ips, inbound_source_asgs, inbound_dest_asgs,
            outbound_source_ips, outbound_dest_ips, outbound_source_asgs, outbound_dest_asgs
        )
        
        # Generate count calculation explanations
        count_explanations = self._generate_count_explanations(
            inbound_source_ips, inbound_dest_ips, inbound_source_asgs, inbound_dest_asgs,
            outbound_source_ips, outbound_dest_ips, outbound_source_asgs, outbound_dest_asgs,
            inbound_rules, outbound_rules
        )
        
        # Generate rule-by-rule analysis
        rule_analysis = self._generate_rule_analysis(rules)
        
        # Generate recommendations
        recommendations = self._generate_detailed_recommendations(rules, violations, ip_asg_analysis)
        
        return {
            'executiveSummary': executive_summary,
            'technicalDetails': {
                'nsgName': nsg_name,
                'resourceGroup': resource_group,
                'analysisTimestamp': datetime.utcnow().isoformat() + 'Z',
                'riskScore': risk_score,
                'complianceStatus': 'COMPLIANT' if len(violations) == 0 else 'NON_COMPLIANT',
                'totalViolations': len(violations),
                'criticalViolations': len([v for v in violations if v.severity == 'Critical'])
            },
            'ipAsgAnalysis': ip_asg_analysis,
            'countExplanations': count_explanations,
            'ruleAnalysis': rule_analysis,
            'recommendations': recommendations,
            'metadata': {
                'reportVersion': '2.0',
                'generatedBy': 'NSG Validation Tool',
                'analysisEngine': 'Enhanced AI Analysis',
                'reportId': f"{nsg_name}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
            }
        }
    
    def _calculate_risk_score(self, rules: List[NSGRule], violations: List[ValidationViolation]) -> int:
        """Calculate overall risk score (0-100, lower is better)"""
        base_score = 0
        
        # Add points for violations
        for violation in violations:
            if violation.severity == 'Critical':
                base_score += 30
            elif violation.severity == 'High':
                base_score += 20
            elif violation.severity == 'Medium':
                base_score += 10
            else:
                base_score += 5
        
        # Add points for security risks
        for rule in rules:
            if rule.source_address_prefix == '*' or rule.source_address_prefix == '0.0.0.0/0':
                base_score += 15
            if rule.destination_address_prefix == '*' or rule.destination_address_prefix == '0.0.0.0/0':
                base_score += 10
            if rule.access == 'Allow' and rule.destination_port_range in ['22', '3389', '80', '443']:
                base_score += 5
        
        return min(100, base_score)
    
    def _generate_executive_summary(self, nsg_name: str, resource_group: str, total_rules: int, 
                                  violations: List[ValidationViolation], risk_score: int) -> Dict[str, Any]:
        """Generate executive summary for the report"""
        
        # Determine overall status
        if risk_score <= 20:
            status = 'LOW_RISK'
            status_description = 'NSG configuration is well-optimized with minimal security risks.'
        elif risk_score <= 50:
            status = 'MEDIUM_RISK'
            status_description = 'NSG configuration has some areas for improvement but is generally acceptable.'
        elif risk_score <= 80:
            status = 'HIGH_RISK'
            status_description = 'NSG configuration requires attention to address security and compliance issues.'
        else:
            status = 'CRITICAL_RISK'
            status_description = 'NSG configuration has critical issues that require immediate attention.'
        
        critical_violations = [v for v in violations if v.severity == 'Critical']
        high_violations = [v for v in violations if v.severity == 'High']
        
        key_findings = []
        if critical_violations:
            key_findings.append(f"{len(critical_violations)} critical violation(s) found requiring immediate action")
        if high_violations:
            key_findings.append(f"{len(high_violations)} high-priority issue(s) identified")
        if risk_score > 50:
            key_findings.append("Security configuration needs optimization")
        if not violations:
            key_findings.append("All rules comply with Azure NSG limits")
        
        return {
            'nsgName': nsg_name,
            'resourceGroup': resource_group,
            'overallStatus': status,
            'statusDescription': status_description,
            'riskScore': risk_score,
            'totalRules': total_rules,
            'totalViolations': len(violations),
            'criticalIssues': len(critical_violations),
            'keyFindings': key_findings,
            'recommendedActions': self._get_recommended_actions(violations, risk_score),
            'complianceLevel': 'COMPLIANT' if len(violations) == 0 else 'NON_COMPLIANT'
        }
    
    def _get_recommended_actions(self, violations: List[ValidationViolation], risk_score: int) -> List[str]:
        """Get recommended actions based on violations and risk score"""
        actions = []
        
        critical_violations = [v for v in violations if v.severity == 'Critical']
        if critical_violations:
            actions.append("Immediately address critical IP limit violations")
            actions.append("Review and consolidate IP address ranges")
        
        if risk_score > 70:
            actions.append("Implement security best practices for rule configuration")
            actions.append("Review wildcard usage and replace with specific IP ranges")
        
        if risk_score > 50:
            actions.append("Consider using Application Security Groups for better organization")
            actions.append("Optimize rule priorities and remove redundant rules")
        
        if not actions:
            actions.append("Continue monitoring and maintain current configuration")
            actions.append("Regular review of rules for optimization opportunities")
        
        return actions
    
    def _generate_ip_asg_analysis(self, inbound_source_ips: set, inbound_dest_ips: set, 
                                inbound_source_asgs: set, inbound_dest_asgs: set,
                                outbound_source_ips: set, outbound_dest_ips: set, 
                                outbound_source_asgs: set, outbound_dest_asgs: set) -> Dict[str, Any]:
        """Generate detailed IP and ASG analysis"""
        
        return {
            'inboundAnalysis': {
                'sourceIps': {
                    'count': len(inbound_source_ips),
                    'addresses': sorted(list(inbound_source_ips)),
                    'types': self._categorize_ip_addresses(inbound_source_ips)
                },
                'destinationIps': {
                    'count': len(inbound_dest_ips),
                    'addresses': sorted(list(inbound_dest_ips)),
                    'types': self._categorize_ip_addresses(inbound_dest_ips)
                },
                'sourceAsgs': {
                    'count': len(inbound_source_asgs),
                    'asgs': sorted(list(inbound_source_asgs))
                },
                'destinationAsgs': {
                    'count': len(inbound_dest_asgs),
                    'asgs': sorted(list(inbound_dest_asgs))
                }
            },
            'outboundAnalysis': {
                'sourceIps': {
                    'count': len(outbound_source_ips),
                    'addresses': sorted(list(outbound_source_ips)),
                    'types': self._categorize_ip_addresses(outbound_source_ips)
                },
                'destinationIps': {
                    'count': len(outbound_dest_ips),
                    'addresses': sorted(list(outbound_dest_ips)),
                    'types': self._categorize_ip_addresses(outbound_dest_ips)
                },
                'sourceAsgs': {
                    'count': len(outbound_source_asgs),
                    'asgs': sorted(list(outbound_source_asgs))
                },
                'destinationAsgs': {
                    'count': len(outbound_dest_asgs),
                    'asgs': sorted(list(outbound_dest_asgs))
                }
            },
            'summary': {
                'totalUniqueIps': len(inbound_source_ips | inbound_dest_ips | outbound_source_ips | outbound_dest_ips),
                'totalUniqueAsgs': len(inbound_source_asgs | inbound_dest_asgs | outbound_source_asgs | outbound_dest_asgs),
                'inboundTotal': len(inbound_source_ips) + len(inbound_dest_ips) + len(inbound_source_asgs) + len(inbound_dest_asgs),
                'outboundTotal': len(outbound_source_ips) + len(outbound_dest_ips) + len(outbound_source_asgs) + len(outbound_dest_asgs)
            }
        }
    
    def _categorize_ip_addresses(self, ip_set: set) -> Dict[str, int]:
        """Categorize IP addresses by type"""
        categories = {
            'individual_ips': 0,
            'cidr_blocks': 0,
            'private_ranges': 0,
            'public_ranges': 0
        }
        
        for ip in ip_set:
            if '/' in ip:
                categories['cidr_blocks'] += 1
                # Check if it's a private range
                try:
                    network = ipaddress.ip_network(ip, strict=False)
                    if network.is_private:
                        categories['private_ranges'] += 1
                    else:
                        categories['public_ranges'] += 1
                except:
                    pass
            else:
                categories['individual_ips'] += 1
        
        return categories
    
    def _generate_count_explanations(self, inbound_source_ips: set, inbound_dest_ips: set, 
                                   inbound_source_asgs: set, inbound_dest_asgs: set,
                                   outbound_source_ips: set, outbound_dest_ips: set, 
                                   outbound_source_asgs: set, outbound_dest_asgs: set,
                                   inbound_rules: int, outbound_rules: int) -> Dict[str, Any]:
        """Generate detailed explanations of how counts are calculated"""
        
        return {
            'methodology': {
                'description': 'IP addresses and ASGs are counted uniquely across all NSG rules',
                'countingLogic': 'Each unique IP address or ASG is counted once, regardless of how many rules reference it',
                'deduplication': 'Duplicate entries within the same category are automatically removed'
            },
            'detailedBreakdown': {
                'inboundRules': {
                    'totalRules': inbound_rules,
                    'sourceIpCount': len(inbound_source_ips),
                    'destinationIpCount': len(inbound_dest_ips),
                    'sourceAsgCount': len(inbound_source_asgs),
                    'destinationAsgCount': len(inbound_dest_asgs),
                    'explanation': f'Analyzed {inbound_rules} inbound rules and found {len(inbound_source_ips)} unique source IPs, {len(inbound_dest_ips)} unique destination IPs, {len(inbound_source_asgs)} unique source ASGs, and {len(inbound_dest_asgs)} unique destination ASGs'
                },
                'outboundRules': {
                    'totalRules': outbound_rules,
                    'sourceIpCount': len(outbound_source_ips),
                    'destinationIpCount': len(outbound_dest_ips),
                    'sourceAsgCount': len(outbound_source_asgs),
                    'destinationAsgCount': len(outbound_dest_asgs),
                    'explanation': f'Analyzed {outbound_rules} outbound rules and found {len(outbound_source_ips)} unique source IPs, {len(outbound_dest_ips)} unique destination IPs, {len(outbound_source_asgs)} unique source ASGs, and {len(outbound_dest_asgs)} unique destination ASGs'
                }
            },
            'azureLimits': {
                'maxSourceIpsPerRule': 4000,
                'maxDestinationIpsPerRule': 4000,
                'maxSourceAsgsPerRule': 100,
                'maxDestinationAsgsPerRule': 100,
                'description': 'Azure NSG rules have specific limits on the number of IP addresses and ASGs that can be referenced'
            },
            'calculationSteps': [
                '1. Parse each NSG rule to extract source and destination addresses',
                '2. Separate IP addresses from Application Security Groups (ASGs)',
                '3. Categorize addresses by rule direction (inbound/outbound)',
                '4. Remove duplicates within each category using set operations',
                '5. Count unique entries in each category',
                '6. Validate counts against Azure NSG limits'
            ]
        }
    
    def _generate_rule_analysis(self, rules: List[NSGRule]) -> Dict[str, Any]:
        """Generate rule-by-rule analysis"""
        
        rule_details = []
        for rule in rules:
            ip_count = self._count_ips_in_addresses([rule.source_address_prefix, rule.destination_address_prefix])
            asg_count = self._count_asgs_in_addresses([rule.source_address_prefix, rule.destination_address_prefix])
            
            rule_details.append({
                'name': rule.name,
                'id': rule.id,
                'direction': rule.direction,
                'priority': rule.priority,
                'access': rule.access,
                'protocol': rule.protocol,
                'sourceAddressPrefix': rule.source_address_prefix,
                'destinationAddressPrefix': rule.destination_address_prefix,
                'sourcePortRange': rule.source_port_range,
                'destinationPortRange': rule.destination_port_range,
                'ipCount': ip_count,
                'asgCount': asg_count,
                'riskLevel': self._assess_rule_risk_level(rule),
                'description': rule.description if hasattr(rule, 'description') else 'No description available'
            })
        
        return {
            'totalRules': len(rules),
            'ruleDetails': rule_details,
            'summary': {
                'inboundRules': len([r for r in rules if r.direction.lower() == 'inbound']),
                'outboundRules': len([r for r in rules if r.direction.lower() == 'outbound']),
                'allowRules': len([r for r in rules if r.access.lower() == 'allow']),
                'denyRules': len([r for r in rules if r.access.lower() == 'deny'])
            }
        }
    
    def _assess_rule_risk_level(self, rule: NSGRule) -> str:
        """Assess the risk level of a single rule"""
        risk_score = 0
        
        # Check for wildcard addresses
        if rule.source_address_prefix in ['*', '0.0.0.0/0'] or rule.destination_address_prefix in ['*', '0.0.0.0/0']:
            risk_score += 3
        
        # Check for common vulnerable ports
        vulnerable_ports = ['22', '3389', '80', '443', '21', '23', '25', '53', '135', '139', '445']
        if rule.destination_port_range in vulnerable_ports:
            risk_score += 2
        
        # Check for allow rules
        if rule.access.lower() == 'allow':
            risk_score += 1
        
        if risk_score >= 5:
            return 'Critical'
        elif risk_score >= 3:
            return 'High'
        elif risk_score >= 1:
            return 'Medium'
        else:
            return 'Low'
    
    def _generate_detailed_recommendations(self, rules: List[NSGRule], violations: List[ValidationViolation], 
                                         ip_asg_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate detailed recommendations based on analysis"""
        
        recommendations = []
        
        # Recommendations based on violations
        critical_violations = [v for v in violations if v.severity == 'Critical']
        if critical_violations:
            recommendations.append({
                'category': 'Critical Issues',
                'priority': 'Immediate',
                'title': 'Address Critical IP Limit Violations',
                'description': f'Found {len(critical_violations)} critical violations that exceed Azure NSG limits',
                'actions': [
                    'Review rules with excessive IP addresses',
                    'Consolidate IP ranges using CIDR notation',
                    'Consider using Application Security Groups',
                    'Split complex rules into multiple simpler rules'
                ],
                'impact': 'High - Rules may not function as expected',
                'effort': 'Medium'
            })
        
        # Security recommendations
        wildcard_rules = [r for r in rules if r.source_address_prefix in ['*', '0.0.0.0/0'] or 
                         r.destination_address_prefix in ['*', '0.0.0.0/0']]
        if wildcard_rules:
            recommendations.append({
                'category': 'Security',
                'priority': 'High',
                'title': 'Restrict Wildcard Address Usage',
                'description': f'Found {len(wildcard_rules)} rules using wildcard addresses (*)',
                'actions': [
                    'Replace wildcard addresses with specific IP ranges',
                    'Use service tags where appropriate',
                    'Implement principle of least privilege',
                    'Document business justification for broad access'
                ],
                'impact': 'High - Reduces security exposure',
                'effort': 'Medium'
            })
        
        # Optimization recommendations
        total_ips = ip_asg_analysis['summary']['totalUniqueIps']
        if total_ips > 1000:
            recommendations.append({
                'category': 'Optimization',
                'priority': 'Medium',
                'title': 'Optimize IP Address Management',
                'description': f'NSG references {total_ips} unique IP addresses, which may impact performance',
                'actions': [
                    'Consolidate similar IP ranges',
                    'Use CIDR notation for contiguous ranges',
                    'Consider using service tags',
                    'Review and remove unused IP addresses'
                ],
                'impact': 'Medium - Improves performance and maintainability',
                'effort': 'Low'
            })
        
        return recommendations
      
    def _perform_ai_analysis(self, rules: List[NSGRule]) -> Dict[str, Any]:
        """Perform comprehensive AI analysis on NSG rules"""
        try:
            # Convert rules to nsg_data format for optimization analysis
            nsg_data = {
                'securityRules': [{
                    'name': rule.name,
                    'properties': {
                        'priority': rule.priority,
                        'direction': rule.direction,
                        'access': rule.access,
                        'protocol': rule.protocol,
                        'sourceAddressPrefix': rule.source_address_prefix,
                        'sourcePortRange': rule.source_port_range,
                        'destinationAddressPrefix': rule.destination_address_prefix,
                        'destinationPortRange': rule.destination_port_range,
                        'sourceApplicationSecurityGroups': rule.source_application_security_groups,
                        'destinationApplicationSecurityGroups': rule.destination_application_security_groups
                    }
                } for rule in rules]
            }
            
            return {
                'ipInventory': self._extract_ip_inventory(rules),
                'duplicateIps': self._detect_duplicate_ips(rules),
                'cidrOverlaps': self._analyze_cidr_overlaps(rules),
                'redundantRules': self._identify_redundant_rules(rules),
                'securityRisks': self._assess_security_risks(rules),
                'consolidationOpportunities': self._find_consolidation_opportunities(rules),
                'serviceTagAnalysis': self._analyze_service_tags(rules),
                'ruleOptimization': self._analyze_rule_optimization(rules),
                'optimizationOpportunities': self._analyze_rule_optimization_opportunities(nsg_data),
                'visualAnalytics': self._generate_visual_analytics(rules)
            }
        except Exception as e:
            return {
                'error': f'AI analysis failed: {str(e)}',
                'ipInventory': {'sourceIps': [], 'destinationIps': [], 'summary': {}},
                'duplicateIps': [],
                'cidrOverlaps': [],
                'redundantRules': [],
                'securityRisks': [],
                'consolidationOpportunities': [],
                'serviceTagAnalysis': {'serviceTags': [], 'recommendations': []},
                'ruleOptimization': {'removableRules': [], 'optimizationSuggestions': []},
                'optimizationOpportunities': [],
                'visualAnalytics': {}
            }
    
    def _detect_duplicate_ips(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Detect IP addresses used across multiple rules"""
        ip_usage = defaultdict(list)
        duplicates = []
        
        for rule in rules:
            # Check source addresses
            source_ips = self._extract_ips_from_rule(rule, 'source')
            for ip in source_ips:
                ip_usage[ip].append({
                    'ruleName': rule.name,
                    'ruleId': rule.id,
                    'direction': rule.direction,
                    'location': 'source',
                    'priority': rule.priority
                })
            
            # Check destination addresses
            dest_ips = self._extract_ips_from_rule(rule, 'destination')
            for ip in dest_ips:
                ip_usage[ip].append({
                    'ruleName': rule.name,
                    'ruleId': rule.id,
                    'direction': rule.direction,
                    'location': 'destination',
                    'priority': rule.priority
                })
        
        # Find duplicates
        for ip, usage_list in ip_usage.items():
            if len(usage_list) > 1:
                duplicates.append({
                    'ipAddress': ip,
                    'usageCount': len(usage_list),
                    'rules': usage_list,
                    'severity': 'Medium' if len(usage_list) <= 3 else 'High',
                    'recommendation': f'Consider consolidating rules using {ip} to reduce complexity'
                })
        
        return sorted(duplicates, key=lambda x: x['usageCount'], reverse=True)
    
    def _analyze_cidr_overlaps(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Detect overlapping network ranges and suggest consolidation"""
        overlaps = []
        networks = []
        
        # Collect all CIDR blocks
        for rule in rules:
            cidrs = self._extract_cidrs_from_rule(rule)
            for cidr_info in cidrs:
                networks.append({
                    'network': cidr_info['network'],
                    'cidr': cidr_info['cidr'],
                    'rule': rule,
                    'location': cidr_info['location']
                })
        
        # Check for overlaps
        for i, net1 in enumerate(networks):
            for net2 in networks[i+1:]:
                if self._networks_overlap(net1['network'], net2['network']):
                    overlap_type = self._get_overlap_type(net1['network'], net2['network'])
                    overlaps.append({
                        'network1': {
                            'cidr': net1['cidr'],
                            'ruleName': net1['rule'].name,
                            'ruleId': net1['rule'].id,
                            'location': net1['location']
                        },
                        'network2': {
                            'cidr': net2['cidr'],
                            'ruleName': net2['rule'].name,
                            'ruleId': net2['rule'].id,
                            'location': net2['location']
                        },
                        'overlapType': overlap_type,
                        'severity': 'High' if overlap_type == 'identical' else 'Medium',
                        'recommendation': self._get_overlap_recommendation(overlap_type, net1['cidr'], net2['cidr'])
                    })
        
        return overlaps
    
    def _identify_redundant_rules(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Find rules with identical or overlapping configurations"""
        redundant = []
        
        for i, rule1 in enumerate(rules):
            for rule2 in rules[i+1:]:
                similarity = self._calculate_rule_similarity(rule1, rule2)
                if similarity['score'] >= 0.8:  # 80% similarity threshold
                    redundant.append({
                        'rule1': {
                            'name': rule1.name,
                            'id': rule1.id,
                            'priority': rule1.priority,
                            'direction': rule1.direction
                        },
                        'rule2': {
                            'name': rule2.name,
                            'id': rule2.id,
                            'priority': rule2.priority,
                            'direction': rule2.direction
                        },
                        'similarityScore': similarity['score'],
                        'similarityReasons': similarity['reasons'],
                        'severity': 'High' if similarity['score'] >= 0.95 else 'Medium',
                        'recommendation': self._get_redundancy_recommendation(rule1, rule2, similarity)
                    })
        
        return sorted(redundant, key=lambda x: x['similarityScore'], reverse=True)
    
    def _assess_security_risks(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Flag overly broad address ranges and security risks"""
        risks = []
        
        for rule in rules:
            rule_risks = []
            
            # Check for wildcard addresses
            if self._has_wildcard_addresses(rule):
                rule_risks.append({
                    'type': 'wildcard_address',
                    'severity': 'Critical',
                    'description': 'Rule allows traffic from/to any address (*)',
                    'recommendation': 'Restrict to specific IP ranges or subnets'
                })
            
            # Check for large CIDR blocks
            large_cidrs = self._find_large_cidrs(rule)
            for cidr_info in large_cidrs:
                rule_risks.append({
                    'type': 'large_cidr',
                    'severity': 'High',
                    'description': f'Large CIDR block {cidr_info["cidr"]} allows access to many IPs',
                    'recommendation': f'Consider using smaller, more specific CIDR blocks',
                    'affectedRange': cidr_info['cidr'],
                    'estimatedIpCount': cidr_info['ip_count']
                })
            
            # Check for common vulnerable ports
            vulnerable_ports = self._check_vulnerable_ports(rule)
            for port_info in vulnerable_ports:
                rule_risks.append({
                    'type': 'vulnerable_port',
                    'severity': port_info['severity'],
                    'description': f'Rule exposes {port_info["service"]} on port {port_info["port"]}',
                    'recommendation': port_info['recommendation'],
                    'port': port_info['port'],
                    'service': port_info['service']
                })
            
            # Check for allow-all rules
            if rule.access.lower() == 'allow' and self._is_overly_permissive(rule):
                rule_risks.append({
                    'type': 'overly_permissive',
                    'severity': 'High',
                    'description': 'Rule is overly permissive with broad access',
                    'recommendation': 'Apply principle of least privilege'
                })
            
            if rule_risks:
                risks.append({
                    'ruleName': rule.name,
                    'ruleId': rule.id,
                    'direction': rule.direction,
                    'priority': rule.priority,
                    'risks': rule_risks,
                    'overallSeverity': max(risk['severity'] for risk in rule_risks),
                    'riskCount': len(rule_risks)
                })
        
        return sorted(risks, key=lambda x: (x['overallSeverity'], x['riskCount']), reverse=True)
    
    def _find_consolidation_opportunities(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Suggest ways to reduce rule complexity and improve management"""
        opportunities = []
        
        # Group rules by similar characteristics
        rule_groups = self._group_similar_rules(rules)
        
        for group_key, group_rules in rule_groups.items():
            if len(group_rules) >= 3:  # Only suggest consolidation for 3+ similar rules
                opportunities.append({
                    'type': 'similar_rules_consolidation',
                    'description': f'Consolidate {len(group_rules)} rules with similar {group_key}',
                    'rules': [{
                        'name': rule.name,
                        'id': rule.id,
                        'priority': rule.priority
                    } for rule in group_rules],
                    'potentialSavings': {
                        'ruleReduction': len(group_rules) - 1,
                        'managementComplexity': 'Medium'
                    },
                    'recommendation': f'Create a single rule covering the common {group_key} pattern',
                    'priority': 'High' if len(group_rules) >= 5 else 'Medium'
                })
        
        # Check for port range consolidation
        port_consolidation = self._find_port_consolidation_opportunities(rules)
        opportunities.extend(port_consolidation)
        
        # Check for IP range consolidation
        ip_consolidation = self._find_ip_consolidation_opportunities(rules)
        opportunities.extend(ip_consolidation)
        
        return sorted(opportunities, key=lambda x: x.get('potentialSavings', {}).get('ruleReduction', 0), reverse=True)
    
    def _generate_visual_analytics(self, rules: List[NSGRule]) -> Dict[str, Any]:
        """Generate visual analytics data for the frontend"""
        analytics = {
            'ruleDistribution': {
                'inbound': len([r for r in rules if r.direction.lower() == 'inbound']),
                'outbound': len([r for r in rules if r.direction.lower() == 'outbound'])
            },
            'accessTypes': {
                'allow': len([r for r in rules if r.access.lower() == 'allow']),
                'deny': len([r for r in rules if r.access.lower() == 'deny'])
            },
            'protocolDistribution': {},
            'priorityRanges': {
                'high': len([r for r in rules if r.priority < 1000]),
                'medium': len([r for r in rules if 1000 <= r.priority < 3000]),
                'low': len([r for r in rules if r.priority >= 3000])
            },
            'riskLevels': {
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': len(rules)
            }
        }
        
        # Count protocols
        for rule in rules:
            protocol = rule.protocol.upper() if rule.protocol else 'Unknown'
            analytics['protocolDistribution'][protocol] = analytics['protocolDistribution'].get(protocol, 0) + 1
        
        # Update risk levels based on security assessment
        security_risks = self._assess_security_risks(rules)
        for risk in security_risks:
            severity = risk['overallSeverity'].lower()
            if severity in analytics['riskLevels']:
                analytics['riskLevels'][severity] += 1
                analytics['riskLevels']['low'] -= 1
        
        return analytics
    
    # Helper methods for AI analysis
    def _extract_ips_from_rule(self, rule: NSGRule, location: str) -> Set[str]:
        """Extract IP addresses from a rule's source or destination"""
        ips = set()
        
        if location == 'source':
            prefix = rule.source_address_prefix
            prefixes = getattr(rule, 'source_address_prefixes', None)
        else:
            prefix = rule.destination_address_prefix
            prefixes = getattr(rule, 'destination_address_prefixes', None)
        
        if prefix and prefix not in ['*', 'VirtualNetwork', 'Internet', 'AzureLoadBalancer']:
            ips.add(prefix)
        
        if prefixes:
            for p in prefixes:
                if p not in ['*', 'VirtualNetwork', 'Internet', 'AzureLoadBalancer']:
                    ips.add(p)
        
        return ips
    
    def _extract_cidrs_from_rule(self, rule: NSGRule) -> List[Dict[str, Any]]:
        """Extract CIDR blocks from a rule"""
        cidrs = []
        
        # Check source addresses
        source_ips = self._extract_ips_from_rule(rule, 'source')
        for ip in source_ips:
            if '/' in ip:
                try:
                    network = ipaddress.ip_network(ip, strict=False)
                    cidrs.append({
                        'network': network,
                        'cidr': ip,
                        'location': 'source'
                    })
                except ValueError:
                    pass
        
        # Check destination addresses
        dest_ips = self._extract_ips_from_rule(rule, 'destination')
        for ip in dest_ips:
            if '/' in ip:
                try:
                    network = ipaddress.ip_network(ip, strict=False)
                    cidrs.append({
                        'network': network,
                        'cidr': ip,
                        'location': 'destination'
                    })
                except ValueError:
                    pass
        
        return cidrs
    
    def _networks_overlap(self, net1: ipaddress.IPv4Network, net2: ipaddress.IPv4Network) -> bool:
        """Check if two networks overlap"""
        return net1.overlaps(net2)
    
    def _get_overlap_type(self, net1: ipaddress.IPv4Network, net2: ipaddress.IPv4Network) -> str:
        """Determine the type of overlap between networks"""
        if net1 == net2:
            return 'identical'
        elif net1.subnet_of(net2) or net2.subnet_of(net1):
            return 'subset'
        else:
            return 'partial'
    
    def _get_overlap_recommendation(self, overlap_type: str, cidr1: str, cidr2: str) -> str:
        """Get recommendation for CIDR overlap"""
        if overlap_type == 'identical':
            return f'Rules use identical CIDR {cidr1} - consider consolidating'
        elif overlap_type == 'subset':
            return f'CIDR {cidr1} and {cidr2} have subset relationship - review for consolidation'
        else:
            return f'CIDR {cidr1} and {cidr2} partially overlap - consider using non-overlapping ranges'
    
    def _calculate_rule_similarity(self, rule1: NSGRule, rule2: NSGRule) -> Dict[str, Any]:
        """Calculate similarity between two rules"""
        score = 0.0
        reasons = []
        
        # Check direction
        if rule1.direction == rule2.direction:
            score += 0.2
            reasons.append('Same direction')
        
        # Check access
        if rule1.access == rule2.access:
            score += 0.2
            reasons.append('Same access type')
        
        # Check protocol
        if rule1.protocol == rule2.protocol:
            score += 0.2
            reasons.append('Same protocol')
        
        # Check source addresses
        if rule1.source_address_prefix == rule2.source_address_prefix:
            score += 0.2
            reasons.append('Same source address')
        
        # Check destination addresses
        if rule1.destination_address_prefix == rule2.destination_address_prefix:
            score += 0.2
            reasons.append('Same destination address')
        
        return {'score': score, 'reasons': reasons}
    
    def _get_redundancy_recommendation(self, rule1: NSGRule, rule2: NSGRule, similarity: Dict[str, Any]) -> str:
        """Get recommendation for redundant rules"""
        if similarity['score'] >= 0.95:
            return f'Rules "{rule1.name}" and "{rule2.name}" are nearly identical - consider removing one'
        else:
            return f'Rules "{rule1.name}" and "{rule2.name}" are similar - review for potential consolidation'
    
    def _has_wildcard_addresses(self, rule: NSGRule) -> bool:
        """Check if rule has wildcard addresses"""
        wildcards = self.security_risk_patterns['wildcard']
        return (rule.source_address_prefix in wildcards or 
                rule.destination_address_prefix in wildcards)
    
    def _find_large_cidrs(self, rule: NSGRule) -> List[Dict[str, Any]]:
        """Find large CIDR blocks in a rule"""
        large_cidrs = []
        large_patterns = self.security_risk_patterns['large_cidrs']
        
        for prefix in [rule.source_address_prefix, rule.destination_address_prefix]:
            if prefix and any(pattern in prefix for pattern in large_patterns):
                try:
                    network = ipaddress.ip_network(prefix, strict=False)
                    large_cidrs.append({
                        'cidr': prefix,
                        'ip_count': network.num_addresses
                    })
                except ValueError:
                    pass
        
        return large_cidrs
    
    def _check_vulnerable_ports(self, rule: NSGRule) -> List[Dict[str, Any]]:
        """Check for vulnerable ports in a rule"""
        vulnerable = []
        port_risks = {
            '22': {'service': 'SSH', 'severity': 'High', 'recommendation': 'Restrict SSH access to specific IPs'},
            '3389': {'service': 'RDP', 'severity': 'Critical', 'recommendation': 'Restrict RDP access to specific IPs'},
            '21': {'service': 'FTP', 'severity': 'High', 'recommendation': 'Consider using SFTP instead'},
            '23': {'service': 'Telnet', 'severity': 'Critical', 'recommendation': 'Use SSH instead of Telnet'},
            '80': {'service': 'HTTP', 'severity': 'Medium', 'recommendation': 'Consider using HTTPS (443) instead'},
            '443': {'service': 'HTTPS', 'severity': 'Low', 'recommendation': 'Ensure proper SSL/TLS configuration'}
        }
        
        dest_port = rule.destination_port_range
        if dest_port in port_risks:
            risk_info = port_risks[dest_port].copy()
            risk_info['port'] = dest_port
            vulnerable.append(risk_info)
        
        return vulnerable
    
    def _is_overly_permissive(self, rule: NSGRule) -> bool:
        """Check if a rule is overly permissive"""
        return (rule.source_address_prefix in ['*', '0.0.0.0/0'] and
                rule.destination_port_range in ['*', '0-65535'])
    
    def _group_similar_rules(self, rules: List[NSGRule]) -> Dict[str, List[NSGRule]]:
        """Group rules by similar characteristics"""
        groups = defaultdict(list)
        
        for rule in rules:
            # Group by protocol and direction
            key = f"{rule.protocol}_{rule.direction}"
            groups[key].append(rule)
        
        return {k: v for k, v in groups.items() if len(v) > 1}
    
    def _find_port_consolidation_opportunities(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Find opportunities to consolidate port ranges"""
        opportunities = []
        port_groups = defaultdict(list)
        
        # Group rules by similar characteristics except ports
        for rule in rules:
            key = f"{rule.direction}_{rule.access}_{rule.protocol}_{rule.source_address_prefix}_{rule.destination_address_prefix}"
            port_groups[key].append(rule)
        
        for group_rules in port_groups.values():
            if len(group_rules) >= 3:
                ports = [rule.destination_port_range for rule in group_rules if rule.destination_port_range]
                if len(set(ports)) > 1:  # Different ports
                    opportunities.append({
                        'type': 'port_consolidation',
                        'description': f'Consolidate {len(group_rules)} rules with different ports',
                        'rules': [{'name': rule.name, 'id': rule.id, 'port': rule.destination_port_range} for rule in group_rules],
                        'potentialSavings': {'ruleReduction': len(group_rules) - 1},
                        'recommendation': 'Consider using port ranges or multiple ports in a single rule',
                        'priority': 'Medium'
                    })
        
        return opportunities
    
    def _find_ip_consolidation_opportunities(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Find opportunities to consolidate IP ranges"""
        opportunities = []
        ip_groups = defaultdict(list)
        
        # Group rules by similar characteristics except IPs
        for rule in rules:
            key = f"{rule.direction}_{rule.access}_{rule.protocol}_{rule.destination_port_range}"
            ip_groups[key].append(rule)
        
        for group_rules in ip_groups.values():
            if len(group_rules) >= 3:
                source_ips = set(rule.source_address_prefix for rule in group_rules if rule.source_address_prefix)
                if len(source_ips) > 1:  # Different source IPs
                    opportunities.append({
                        'type': 'ip_consolidation',
                        'description': f'Consolidate {len(group_rules)} rules with different IP ranges',
                        'rules': [{'name': rule.name, 'id': rule.id, 'sourceIp': rule.source_address_prefix} for rule in group_rules],
                        'potentialSavings': {'ruleReduction': len(group_rules) - 1},
                        'recommendation': 'Consider using broader CIDR blocks or IP ranges',
                        'priority': 'Medium'
                    })
        
        return opportunities
    
    async def generate_llm_recommendations(self, nsg_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate AI-powered recommendations using OpenAI with comprehensive analysis"""
        try:
            # Extract AI analysis data
            ai_analysis = nsg_analysis.get('aiAnalysis', {})
            
            # Prepare comprehensive context for LLM
            context = {
                'total_rules': nsg_analysis.get('totalRules', 0),
                'inbound_rules': nsg_analysis.get('inboundRules', 0),
                'outbound_rules': nsg_analysis.get('outboundRules', 0),
                'violations': nsg_analysis.get('violations', []),
                'source_ip_count': nsg_analysis.get('sourceIpCount', 0),
                'destination_ip_count': nsg_analysis.get('destinationIpCount', 0),
                'asg_count': nsg_analysis.get('asgCount', 0),
                'is_within_limits': nsg_analysis.get('isWithinLimits', True),
                'duplicate_ips': len(ai_analysis.get('duplicateIps', [])),
                'cidr_overlaps': len(ai_analysis.get('cidrOverlaps', [])),
                'redundant_rules': len(ai_analysis.get('redundantRules', [])),
                'security_risks': len(ai_analysis.get('securityRisks', [])),
                'consolidation_opportunities': len(ai_analysis.get('consolidationOpportunities', []))
            }
            
            # Build detailed analysis summary
            analysis_summary = []
            
            if ai_analysis.get('duplicateIps'):
                top_duplicate = ai_analysis['duplicateIps'][0]
                analysis_summary.append(f"- {context['duplicate_ips']} duplicate IP addresses found (top: {top_duplicate['ipAddress']} used {top_duplicate['usageCount']} times)")
            
            if ai_analysis.get('cidrOverlaps'):
                analysis_summary.append(f"- {context['cidr_overlaps']} CIDR overlaps detected")
            
            if ai_analysis.get('redundantRules'):
                top_redundant = ai_analysis['redundantRules'][0]
                analysis_summary.append(f"- {context['redundant_rules']} redundant rules found (similarity up to {top_redundant['similarityScore']:.0%})")
            
            if ai_analysis.get('securityRisks'):
                critical_risks = [r for r in ai_analysis['securityRisks'] if r['overallSeverity'] == 'Critical']
                high_risks = [r for r in ai_analysis['securityRisks'] if r['overallSeverity'] == 'High']
                analysis_summary.append(f"- {len(critical_risks)} critical and {len(high_risks)} high security risks identified")
            
            if ai_analysis.get('consolidationOpportunities'):
                total_savings = sum(opp.get('potentialSavings', {}).get('ruleReduction', 0) for opp in ai_analysis['consolidationOpportunities'])
                analysis_summary.append(f"- {context['consolidation_opportunities']} consolidation opportunities (potential {total_savings} rule reduction)")
            
            prompt = f"""
Analyze the following Azure NSG configuration and provide specific, actionable recommendations:

## NSG Overview:
- Total Rules: {context['total_rules']}
- Inbound Rules: {context['inbound_rules']}
- Outbound Rules: {context['outbound_rules']}
- Source IP Count: {context['source_ip_count']}
- Destination IP Count: {context['destination_ip_count']}
- ASG Count: {context['asg_count']}
- Within Limits: {context['is_within_limits']}
- Violations: {len(context['violations'])}

## AI Analysis Results:
{chr(10).join(analysis_summary) if analysis_summary else '- No significant issues detected'}

## Violation Details:
{chr(10).join([f"- {v.get('message', 'Unknown violation')}" for v in context['violations']]) if context['violations'] else '- No violations found'}

## Security Risk Summary:
{self._format_security_risks_for_llm(ai_analysis.get('securityRisks', []))}

Provide 4-6 specific, prioritized recommendations to optimize this NSG configuration. Focus on:
1. Critical security vulnerabilities
2. Rule consolidation and optimization
3. Compliance with Azure best practices
4. Performance and management improvements
5. Cost optimization opportunities

For each recommendation, provide:
- Clear, actionable title
- Detailed description with specific steps
- Expected impact and benefits
- Implementation complexity (Low/Medium/High)
- Priority level (Critical/High/Medium/Low)
- Estimated time to implement
"""
            
            # Use the modern AI service instead of deprecated OpenAI API
            messages = [
                {"role": "system", "content": "You are a senior Azure security architect with expertise in Network Security Group optimization, security best practices, and cloud infrastructure management. Provide specific, actionable recommendations based on the analysis data."},
                {"role": "user", "content": prompt}
            ]
            
            # Try to use available AI models in order of preference
            response = None
            try:
                if self.ai_service.azure_openai_client:
                    response = await self.ai_service.generate_completion(
                        model=AIModel.AZURE_OPENAI_GPT4,
                        messages=messages,
                        max_tokens=2000,
                        temperature=0.2
                    )
                elif self.ai_service.openai_client:
                    response = await self.ai_service.generate_completion(
                        model=AIModel.GPT_4,
                        messages=messages,
                        max_tokens=2000,
                        temperature=0.2
                    )
                else:
                    raise Exception("No AI service available")
                    
                recommendations_text = response.get("content", "")
            except Exception as ai_error:
                # If AI service fails, use fallback
                raise Exception(f"AI service error: {str(ai_error)}")
            
            # Create structured recommendations (simplified parsing)
            recommendations = self._parse_llm_recommendations(recommendations_text, ai_analysis)
            
            return recommendations
            
        except Exception as e:
            # Enhanced fallback with AI analysis data
            return self._get_enhanced_fallback_recommendations(nsg_analysis)
    
    def _format_security_risks_for_llm(self, security_risks: List[Dict[str, Any]]) -> str:
        """Format security risks for LLM context"""
        if not security_risks:
            return "- No security risks detected"
        
        risk_summary = []
        for risk in security_risks[:5]:  # Top 5 risks
            risk_types = [r['type'] for r in risk['risks']]
            risk_summary.append(f"- Rule '{risk['ruleName']}': {', '.join(risk_types)} ({risk['overallSeverity']} severity)")
        
        return chr(10).join(risk_summary)
    
    def _parse_llm_recommendations(self, recommendations_text: str, ai_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse LLM recommendations into structured format"""
        # Simplified parsing - in production, you'd want more sophisticated parsing
        recommendations = []
        
        # Split by common patterns and create structured recommendations
        sections = recommendations_text.split('\n\n')
        
        for i, section in enumerate(sections[:6]):  # Max 6 recommendations
            if len(section.strip()) > 50:  # Filter out short sections
                recommendations.append({
                    'id': f'llm_enhanced_{i+1}',
                    'type': 'llm_enhanced',
                    'title': f'AI-Enhanced Recommendation {i+1}',
                    'description': section.strip(),
                    'impact': self._determine_impact_from_analysis(ai_analysis),
                    'implementation': 'Follow the detailed guidance provided in the description',
                    'priority': self._determine_priority_from_content(section),
                    'estimated_savings': self._estimate_savings_from_analysis(ai_analysis),
                    'category': self._categorize_recommendation(section)
                })
        
        return recommendations
    
    def _determine_impact_from_analysis(self, ai_analysis: Dict[str, Any]) -> str:
        """Determine impact based on AI analysis results"""
        total_issues = (len(ai_analysis.get('duplicateIps', [])) + 
                       len(ai_analysis.get('cidrOverlaps', [])) + 
                       len(ai_analysis.get('redundantRules', [])) + 
                       len(ai_analysis.get('securityRisks', [])))
        
        if total_issues >= 10:
            return 'High impact - significant security and efficiency improvements'
        elif total_issues >= 5:
            return 'Medium impact - notable improvements in security and management'
        else:
            return 'Low to medium impact - incremental improvements'
    
    def _determine_priority_from_content(self, content: str) -> str:
        """Determine priority based on content keywords"""
        content_lower = content.lower()
        
        if any(word in content_lower for word in ['critical', 'security', 'vulnerability', 'risk']):
            return 'High'
        elif any(word in content_lower for word in ['consolidate', 'optimize', 'reduce']):
            return 'Medium'
        else:
            return 'Low'
    
    def _estimate_savings_from_analysis(self, ai_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Estimate savings based on AI analysis"""
        consolidation_opps = ai_analysis.get('consolidationOpportunities', [])
        total_rule_reduction = sum(opp.get('potentialSavings', {}).get('ruleReduction', 0) for opp in consolidation_opps)
        
        return {
            'rules_reduced': total_rule_reduction,
            'complexity_reduction': 'High' if total_rule_reduction >= 10 else 'Medium' if total_rule_reduction >= 5 else 'Low',
            'management_effort': 'Reduced' if total_rule_reduction > 0 else 'Maintained'
        }
    
    def _categorize_recommendation(self, content: str) -> str:
        """Categorize recommendation based on content"""
        content_lower = content.lower()
        
        if any(word in content_lower for word in ['security', 'risk', 'vulnerability']):
            return 'Security'
        elif any(word in content_lower for word in ['consolidate', 'merge', 'combine']):
            return 'Optimization'
        elif any(word in content_lower for word in ['compliance', 'best practice']):
            return 'Compliance'
        else:
            return 'General'
    
    def _get_enhanced_fallback_recommendations(self, nsg_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Enhanced fallback recommendations using AI analysis data"""
        recommendations = []
        ai_analysis = nsg_analysis.get('aiAnalysis', {})
        
        # Security risk recommendations
        security_risks = ai_analysis.get('securityRisks', [])
        if security_risks:
            critical_risks = [r for r in security_risks if r['overallSeverity'] == 'Critical']
            if critical_risks:
                recommendations.append({
                    'id': 'fallback_security_critical',
                    'type': 'security_critical',
                    'title': 'Address Critical Security Risks',
                    'description': f'Found {len(critical_risks)} critical security risks including wildcard addresses and overly permissive rules. Immediate action required.',
                    'impact': 'Critical - prevents potential security breaches',
                    'implementation': 'Review and restrict overly broad rules, replace wildcards with specific IP ranges',
                    'priority': 'Critical',
                    'estimated_savings': {'security_improvement': 'High'}
                })
        
        # Consolidation recommendations
        consolidation_opps = ai_analysis.get('consolidationOpportunities', [])
        if consolidation_opps:
            total_savings = sum(opp.get('potentialSavings', {}).get('ruleReduction', 0) for opp in consolidation_opps)
            recommendations.append({
                'id': 'fallback_consolidation',
                'type': 'rule_optimization',
                'title': 'Consolidate Similar Rules',
                'description': f'Found {len(consolidation_opps)} consolidation opportunities that could reduce rules by {total_savings}.',
                'impact': f'Reduced complexity and improved management efficiency',
                'implementation': 'Group similar rules and create consolidated rules with broader but secure scope',
                'priority': 'Medium',
                'estimated_savings': {'rules_reduced': total_savings}
            })
        
        # Duplicate IP recommendations
        duplicate_ips = ai_analysis.get('duplicateIps', [])
        if duplicate_ips:
            recommendations.append({
                'id': 'fallback_duplicates',
                'type': 'ip_optimization',
                'title': 'Eliminate Duplicate IP Usage',
                'description': f'Found {len(duplicate_ips)} IP addresses used across multiple rules, creating management complexity.',
                'impact': 'Improved rule clarity and reduced maintenance overhead',
                'implementation': 'Consolidate rules using the same IP addresses into single, comprehensive rules',
                'priority': 'Medium',
                'estimated_savings': {'complexity_reduction': 'Medium'}
            })
        
        # Add basic recommendations if no AI analysis available
        if not recommendations:
            recommendations = self._get_fallback_recommendations(nsg_analysis)
        
        return recommendations
    
    def _get_fallback_recommendations(self, nsg_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Provide fallback recommendations when LLM is not available"""
        recommendations = []
        
        if not nsg_analysis['isWithinLimits']:
            recommendations.append({
                "id": "consolidate_ip_ranges",
                "type": "CONSOLIDATION",
                "title": "Consolidate IP Address Ranges",
                "description": "Merge overlapping or adjacent IP ranges to reduce the total number of IP addresses in rules.",
                "impact": "Reduces rule complexity and ensures compliance with Azure limits.",
                "implementation": "1. Identify overlapping CIDR blocks\n2. Merge adjacent ranges\n3. Use broader CIDR notation where appropriate\n4. Update NSG rules with consolidated ranges",
                "estimatedSavings": {
                    "ipAddresses": max(0, nsg_analysis['sourceIpCount'] - self.max_ip_addresses),
                    "rules": max(1, nsg_analysis['totalRules'] // 4)
                },
                "priority": "High"
            })
        
        if nsg_analysis['asgCount'] > 0:
            recommendations.append({
                "id": "optimize_asg_usage",
                "type": "OPTIMIZATION",
                "title": "Optimize Application Security Group Usage",
                "description": "Review ASG assignments and consolidate where possible to reduce rule complexity.",
                "impact": "Simplifies rule management and improves security posture.",
                "implementation": "1. Review current ASG assignments\n2. Identify redundant or overlapping ASGs\n3. Consolidate similar security requirements\n4. Update rules to use optimized ASGs",
                "estimatedSavings": {
                    "ipAddresses": nsg_analysis['asgCount'] // 2,
                    "rules": 1
                },
                "priority": "Medium"
            })
        
        recommendations.append({
            "id": "implement_least_privilege",
            "type": "SECURITY_IMPROVEMENT",
            "title": "Implement Least Privilege Access",
            "description": "Review and tighten security rules to follow the principle of least privilege.",
            "impact": "Improves security posture and reduces attack surface.",
            "implementation": "1. Audit current rule permissions\n2. Identify overly permissive rules\n3. Implement more specific port and protocol restrictions\n4. Regular review and cleanup of unused rules",
            "estimatedSavings": {
                "ipAddresses": 0,
                "rules": max(1, nsg_analysis['totalRules'] // 10)
            },
            "priority": "High"
        })
        
        return recommendations
    
    def _extract_ip_inventory(self, rules: List[NSGRule]) -> Dict[str, Any]:
        """Extract comprehensive IP inventory from NSG rules"""
        source_ips = set()
        destination_ips = set()
        ip_details = []
        
        for rule in rules:
            # Extract source IPs
            rule_source_ips = self._extract_ips_from_rule(rule, 'source')
            for ip in rule_source_ips:
                source_ips.add(ip)
                ip_details.append({
                    'ipAddress': ip,
                    'type': 'source',
                    'ruleName': rule.name,
                    'ruleId': rule.id,
                    'direction': rule.direction,
                    'priority': rule.priority,
                    'access': rule.access,
                    'protocol': rule.protocol,
                    'ports': self._get_port_info(rule)
                })
            
            # Extract destination IPs
            rule_dest_ips = self._extract_ips_from_rule(rule, 'destination')
            for ip in rule_dest_ips:
                destination_ips.add(ip)
                ip_details.append({
                    'ipAddress': ip,
                    'type': 'destination',
                    'ruleName': rule.name,
                    'ruleId': rule.id,
                    'direction': rule.direction,
                    'priority': rule.priority,
                    'access': rule.access,
                    'protocol': rule.protocol,
                    'ports': self._get_port_info(rule)
                })
        
        return {
            'sourceIps': sorted(list(source_ips)),
            'destinationIps': sorted(list(destination_ips)),
            'ipDetails': ip_details,
            'summary': {
                'totalUniqueSourceIps': len(source_ips),
                'totalUniqueDestinationIps': len(destination_ips),
                'totalUniqueIps': len(source_ips.union(destination_ips)),
                'totalIpReferences': len(ip_details)
            }
        }
    
    def _analyze_service_tags(self, rules: List[NSGRule]) -> Dict[str, Any]:
        """Analyze service tags usage and provide consolidation recommendations"""
        service_tags = []
        tag_usage = defaultdict(list)
        ip_to_service_tag_opportunities = []
        
        for rule in rules:
            # Check for service tags in source and destination
            source_tags = self._extract_service_tags(rule, 'source')
            dest_tags = self._extract_service_tags(rule, 'destination')
            
            for tag in list(source_tags) + list(dest_tags):
                tag_usage[tag].append({
                    'ruleName': rule.name,
                    'ruleId': rule.id,
                    'direction': rule.direction,
                    'location': 'source' if tag in source_tags else 'destination',
                    'priority': rule.priority,
                    'protocol': rule.protocol,
                    'ports': rule.destination_port_range
                })
        
        # Create service tag analysis
        for tag, usage_list in tag_usage.items():
            service_tags.append({
                'serviceTag': tag,
                'usageCount': len(usage_list),
                'rules': usage_list,
                'description': self._get_service_tag_description(tag),
                'consolidationPotential': 'High' if len(usage_list) > 3 else 'Medium' if len(usage_list) > 1 else 'Low',
                'securityImpact': self._assess_service_tag_security_impact(tag),
                'alternativeServiceTags': self._suggest_alternative_service_tags(tag)
            })
        
        # Find IP addresses that could be replaced with service tags
        ip_to_service_tag_opportunities = self._find_ip_to_service_tag_opportunities(rules)
        
        # Generate recommendations
        recommendations = []
        
        # Find frequently used service tags
        frequent_tags = [tag for tag in service_tags if tag['usageCount'] > 2]
        if frequent_tags:
            total_rules_affected = sum(tag['usageCount'] for tag in frequent_tags)
            recommendations.append({
                'type': 'service_tag_consolidation',
                'title': 'Consolidate Service Tag Rules',
                'description': f'Found {len(frequent_tags)} service tags used multiple times across {total_rules_affected} rules. Consider consolidating rules with similar service tags and protocols.',
                'affectedTags': [tag['serviceTag'] for tag in frequent_tags],
                'currentServiceTags': [tag['serviceTag'] for tag in frequent_tags],
                'recommendedServiceTags': self._get_consolidated_service_tag_recommendations(frequent_tags),
                'priority': 'Medium',
                'impact': 'Reduced rule complexity and improved management',
                'estimatedSavings': f'Could reduce {total_rules_affected - len(frequent_tags)} rules through consolidation'
            })
        
        # Check for overlapping service tags
        overlapping_tags = self._find_overlapping_service_tags(service_tags)
        if overlapping_tags:
            recommendations.append({
                'type': 'overlapping_service_tags',
                'title': 'Review Overlapping Service Tags',
                'description': f'Found {len(overlapping_tags)} pairs of overlapping service tags that may cause rule conflicts.',
                'overlappingTags': overlapping_tags,
                'priority': 'Medium',
                'impact': 'Potential rule conflicts and security gaps',
                'recommendation': 'Review and consolidate overlapping service tags to avoid conflicts'
            })
        
        # IP to Service Tag conversion opportunities
        if ip_to_service_tag_opportunities:
            recommendations.append({
                'type': 'ip_to_service_tag_conversion',
                'title': 'Convert IP Addresses to Service Tags',
                'description': f'Found {len(ip_to_service_tag_opportunities)} opportunities to replace specific IP addresses with Azure service tags.',
                'opportunities': ip_to_service_tag_opportunities,
                'priority': 'High',
                'impact': 'Improved security, reduced maintenance, and automatic updates with Azure service changes',
                'estimatedSavings': f'Simplified management of {len(ip_to_service_tag_opportunities)} rules'
            })
        
        # Check for missing recommended service tags
        missing_service_tags = self._find_missing_recommended_service_tags(rules)
        if missing_service_tags:
            recommendations.append({
                'type': 'missing_service_tags',
                'title': 'Consider Additional Service Tags',
                'description': f'Based on your current rules, consider using {len(missing_service_tags)} additional service tags for better security and management.',
                'recommendedServiceTags': missing_service_tags,
                'priority': 'Low',
                'impact': 'Enhanced security posture and simplified rule management'
            })
        
        return {
            'serviceTags': sorted(service_tags, key=lambda x: x['usageCount'], reverse=True),
            'recommendations': recommendations,
            'ipToServiceTagOpportunities': ip_to_service_tag_opportunities,
            'summary': {
                'totalServiceTags': len(service_tags),
                'totalUsages': sum(tag['usageCount'] for tag in service_tags),
                'highConsolidationPotential': len([tag for tag in service_tags if tag['consolidationPotential'] == 'High']),
                'conversionOpportunities': len(ip_to_service_tag_opportunities),
                'securityImprovements': len([tag for tag in service_tags if tag.get('securityImpact') == 'High'])
            }
        }
    
    def _analyze_rule_optimization(self, rules: List[NSGRule]) -> Dict[str, Any]:
        """Analyze rules for optimization and removal opportunities"""
        removable_rules = []
        optimization_suggestions = []
        
        # Find potentially removable rules
        for rule in rules:
            removal_reasons = []
            
            # Check for deny rules that are redundant (default deny exists)
            if rule.access.lower() == 'deny' and rule.priority > 4000:
                removal_reasons.append({
                    'reason': 'redundant_deny',
                    'description': 'Explicit deny rule may be redundant due to default deny behavior',
                    'confidence': 'Medium'
                })
            
            # Check for overly specific rules that could be generalized
            if self._is_overly_specific_rule(rule):
                removal_reasons.append({
                    'reason': 'overly_specific',
                    'description': 'Rule is very specific and could potentially be generalized',
                    'confidence': 'Low'
                })
            
            # Check for unused or inactive rules (based on naming patterns)
            if self._appears_unused(rule):
                removal_reasons.append({
                    'reason': 'potentially_unused',
                    'description': 'Rule appears to be unused based on naming or configuration',
                    'confidence': 'Low'
                })
            
            if removal_reasons:
                removable_rules.append({
                    'ruleName': rule.name,
                    'ruleId': rule.id,
                    'priority': rule.priority,
                    'direction': rule.direction,
                    'access': rule.access,
                    'removalReasons': removal_reasons,
                    'riskLevel': self._assess_removal_risk(rule, removal_reasons),
                    'recommendation': self._get_removal_recommendation(rule, removal_reasons)
                })
        
        # Generate optimization suggestions
        optimization_suggestions.extend(self._generate_port_optimization_suggestions(rules))
        optimization_suggestions.extend(self._generate_protocol_optimization_suggestions(rules))
        optimization_suggestions.extend(self._generate_priority_optimization_suggestions(rules))
        
        # Calculate consolidation opportunities from existing analysis
        consolidation_opportunities = self._find_consolidation_opportunities(rules)
        
        # Calculate specific counts for frontend display
        rules_to_remove = len([r for r in removable_rules if r['riskLevel'] in ['Low', 'Medium']])
        rules_to_modify = len([s for s in optimization_suggestions if s['type'] in ['port_consolidation', 'protocol_consolidation']])
        rules_to_consolidate = sum(len(opp.get('rules', [])) - 1 for opp in consolidation_opportunities if opp.get('potentialSavings', {}).get('ruleReduction', 0) > 0)
        
        return {
            'removableRules': sorted(removable_rules, key=lambda x: x['riskLevel']),
            'optimizationSuggestions': optimization_suggestions,
            'consolidationOpportunities': consolidation_opportunities,
            'rulesToRemove': rules_to_remove,
            'rulesToModify': rules_to_modify,
            'rulesToConsolidate': rules_to_consolidate,
            'complexityReduction': f'{((rules_to_remove + rules_to_consolidate) / max(len(rules), 1) * 100):.0f}%' if len(rules) > 0 else '0%',
            'summary': {
                'totalRemovableRules': len(removable_rules),
                'lowRiskRemovals': len([r for r in removable_rules if r['riskLevel'] == 'Low']),
                'optimizationOpportunities': len(optimization_suggestions)
            }
        }
    
    def _get_port_info(self, rule: NSGRule) -> Dict[str, Any]:
        """Extract port information from rule"""
        return {
            'destinationPorts': rule.destination_port_range if hasattr(rule, 'destination_port_range') else 'Any',
            'sourcePorts': rule.source_port_range if hasattr(rule, 'source_port_range') else 'Any'
        }
    
    def _extract_service_tags(self, rule: NSGRule, location: str) -> List[str]:
        """Extract service tags from rule source or destination"""
        service_tags = []
        
        if location == 'source':
            addresses = rule.source_address_prefix if hasattr(rule, 'source_address_prefix') else []
        else:
            addresses = rule.destination_address_prefix if hasattr(rule, 'destination_address_prefix') else []
        
        if isinstance(addresses, str):
            addresses = [addresses]
        
        for addr in addresses:
            if isinstance(addr, str) and not self._is_ip_address(addr) and not addr == '*':
                # Likely a service tag
                service_tags.append(addr)
        
        return service_tags
    
    def _get_service_tag_description(self, tag: str) -> str:
        """Get description for common service tags"""
        descriptions = {
            'Internet': 'All public internet addresses - use with caution for inbound rules',
            'VirtualNetwork': 'All virtual network address space including connected networks',
            'AzureLoadBalancer': 'Azure load balancer infrastructure - required for health probes',
            'Storage': 'Azure Storage service addresses - includes all storage endpoints',
            'Sql': 'Azure SQL service addresses - includes SQL Database and SQL Managed Instance',
            'AzureActiveDirectory': 'Azure Active Directory service addresses - for authentication',
            'AzureKeyVault': 'Azure Key Vault service addresses - for secure key management',
            'AzureMonitor': 'Azure Monitor service addresses - for logging and monitoring',
            'AzureBackup': 'Azure Backup service addresses - for backup operations',
            'EventHub': 'Azure Event Hub service addresses - for event streaming',
            'ServiceBus': 'Azure Service Bus addresses - for messaging services',
            'AzureCosmosDB': 'Azure Cosmos DB service addresses - for NoSQL database access',
            'AzureContainerRegistry': 'Azure Container Registry addresses - for container images',
            'ApiManagement': 'Azure API Management service addresses',
            'AppService': 'Azure App Service addresses - for web applications',
            'AppServiceManagement': 'Azure App Service management addresses'
        }
        return descriptions.get(tag, f'Service tag: {tag} - Azure service endpoint addresses')
    
    def _find_overlapping_service_tags(self, service_tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find potentially overlapping service tags"""
        overlapping = []
        known_overlaps = {
            ('Internet', 'VirtualNetwork'): {
                'description': 'VirtualNetwork is a subset of Internet - may cause redundant rules',
                'recommendation': 'Use VirtualNetwork for internal traffic, Internet only when external access is needed',
                'severity': 'Medium'
            },
            ('Storage', 'Internet'): {
                'description': 'Storage endpoints are accessible via Internet - potential redundancy',
                'recommendation': 'Use Storage tag for specific storage access, Internet for broader access',
                'severity': 'Low'
            },
            ('Sql', 'Internet'): {
                'description': 'SQL endpoints may be accessible via Internet - security consideration',
                'recommendation': 'Prefer Sql tag over Internet for database access to improve security',
                'severity': 'High'
            },
            ('AzureActiveDirectory', 'Internet'): {
                'description': 'AAD endpoints are accessible via Internet - consider specificity',
                'recommendation': 'Use AzureActiveDirectory for authentication, Internet only if broader access needed',
                'severity': 'Medium'
            }
        }
        
        tag_names = [tag['serviceTag'] for tag in service_tags]
        for (tag1, tag2), overlap_info in known_overlaps.items():
            if tag1 in tag_names and tag2 in tag_names:
                overlapping.append({
                    'tag1': tag1,
                    'tag2': tag2,
                    'description': overlap_info['description'],
                    'recommendation': overlap_info['recommendation'],
                    'severity': overlap_info['severity']
                })
        
        return overlapping
    
    def _assess_service_tag_security_impact(self, tag: str) -> str:
        """Assess the security impact of using a service tag"""
        high_impact_tags = ['Internet', 'Sql', 'AzureActiveDirectory']
        medium_impact_tags = ['Storage', 'VirtualNetwork', 'AzureKeyVault']
        
        if tag in high_impact_tags:
            return 'High'
        elif tag in medium_impact_tags:
            return 'Medium'
        else:
            return 'Low'
    
    def _suggest_alternative_service_tags(self, tag: str) -> List[str]:
        """Suggest alternative service tags for better security or specificity"""
        alternatives = {
            'Internet': ['VirtualNetwork', 'Storage', 'Sql'],
            'VirtualNetwork': ['Storage', 'Sql', 'AzureActiveDirectory'],
            'Storage': ['AzureBackup', 'AzureMonitor'],
            'Sql': ['AzureCosmosDB']
        }
        return alternatives.get(tag, [])
    
    def _find_ip_to_service_tag_opportunities(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Find IP addresses that could be replaced with service tags"""
        opportunities = []
        
        # Known Azure service IP patterns (simplified - in practice, use Azure API)
        service_ip_patterns = {
            'Storage': ['20.60.', '20.150.', '52.239.'],
            'Sql': ['13.104.', '40.126.', '191.233.'],
            'AzureActiveDirectory': ['20.190.', '40.126.']
        }
        
        for rule in rules:
            source_ips = self._extract_ips_from_rule(rule, 'source')
            dest_ips = self._extract_ips_from_rule(rule, 'destination')
            
            for ip in list(source_ips) + list(dest_ips):
                for service_tag, patterns in service_ip_patterns.items():
                    if any(ip.startswith(pattern) for pattern in patterns):
                        opportunities.append({
                            'ruleName': rule.name,
                            'ruleId': rule.id,
                            'currentIp': ip,
                            'recommendedServiceTag': service_tag,
                            'location': 'source' if ip in source_ips else 'destination',
                            'confidence': 'High',
                            'benefit': f'Replace specific IP with {service_tag} service tag for automatic updates'
                        })
        
        return opportunities
    
    def _get_consolidated_service_tag_recommendations(self, frequent_tags: List[Dict[str, Any]]) -> List[str]:
        """Get recommendations for consolidating service tags"""
        recommendations = []
        tag_names = [tag['serviceTag'] for tag in frequent_tags]
        
        # Suggest broader tags when multiple specific tags are used
        if 'Storage' in tag_names and 'AzureBackup' in tag_names:
            recommendations.append('Storage')
        if 'Sql' in tag_names and 'AzureCosmosDB' in tag_names:
            recommendations.append('Consider database-specific tags')
        if len([tag for tag in tag_names if tag in ['AzureMonitor', 'AzureBackup', 'EventHub']]) > 1:
            recommendations.append('AzureCloud')
        
        return recommendations if recommendations else ['Consider consolidating similar service categories']
    
    def _find_missing_recommended_service_tags(self, rules: List[NSGRule]) -> List[str]:
        """Find recommended service tags that could improve security"""
        missing_tags = []
        current_tags = set()
        
        # Collect current service tags
        for rule in rules:
            current_tags.update(self._extract_service_tags(rule, 'source'))
            current_tags.update(self._extract_service_tags(rule, 'destination'))
        
        # Check for common missing tags based on current usage
        if 'Internet' in current_tags and 'AzureLoadBalancer' not in current_tags:
            missing_tags.append('AzureLoadBalancer')
        
        if any(tag in current_tags for tag in ['Storage', 'Sql']) and 'AzureMonitor' not in current_tags:
            missing_tags.append('AzureMonitor')
        
        if 'VirtualNetwork' in current_tags and 'AzureActiveDirectory' not in current_tags:
            missing_tags.append('AzureActiveDirectory')
        
        return missing_tags
    
    def _is_overly_specific_rule(self, rule: NSGRule) -> bool:
        """Check if rule is overly specific"""
        # Check for single IP addresses with very specific port ranges
        source_ips = self._extract_ips_from_rule(rule, 'source')
        dest_ips = self._extract_ips_from_rule(rule, 'destination')
        
        single_ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
        
        has_single_source = any(re.match(single_ip_pattern, ip) for ip in source_ips)
        has_single_dest = any(re.match(single_ip_pattern, ip) for ip in dest_ips)
        
        return has_single_source and has_single_dest
    
    def _appears_unused(self, rule: NSGRule) -> bool:
        """Check if rule appears to be unused based on naming patterns"""
        unused_patterns = ['test', 'temp', 'old', 'unused', 'deprecated', 'backup']
        rule_name_lower = rule.name.lower()
        
        return any(pattern in rule_name_lower for pattern in unused_patterns)
    
    def _assess_removal_risk(self, rule: NSGRule, removal_reasons: List[Dict[str, Any]]) -> str:
        """Assess risk level of removing a rule"""
        if rule.access.lower() == 'allow':
            return 'High'  # Removing allow rules is risky
        
        confidence_levels = [reason['confidence'] for reason in removal_reasons]
        if 'High' in confidence_levels:
            return 'Low'
        elif 'Medium' in confidence_levels:
            return 'Medium'
        else:
            return 'High'
    
    def _get_removal_recommendation(self, rule: NSGRule, removal_reasons: List[Dict[str, Any]]) -> str:
        """Get recommendation for rule removal"""
        if rule.access.lower() == 'allow':
            return 'Carefully review before removal - may impact connectivity'
        else:
            return 'Safe to remove after verification - explicit deny may be redundant'
    
    def _generate_port_optimization_suggestions(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Generate port-based optimization suggestions"""
        suggestions = []
        
        # Find rules with overlapping port ranges
        port_rules = defaultdict(list)
        for rule in rules:
            if hasattr(rule, 'destination_port_range'):
                port_rules[rule.destination_port_range].append(rule)
        
        for port_range, rule_list in port_rules.items():
            if len(rule_list) > 2 and port_range != '*':
                suggestions.append({
                    'type': 'port_consolidation',
                    'title': f'Consolidate rules using port {port_range}',
                    'description': f'Found {len(rule_list)} rules using the same port range',
                    'affectedRules': [{'name': r.name, 'id': r.id} for r in rule_list],
                    'priority': 'Medium',
                    'impact': 'Reduced rule count and improved management'
                })
        
        return suggestions
    
    def _generate_protocol_optimization_suggestions(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Generate protocol-based optimization suggestions"""
        suggestions = []
        
        # Find rules that could use 'Any' protocol
        protocol_groups = defaultdict(list)
        for rule in rules:
            key = (rule.source_address_prefix, rule.destination_address_prefix, rule.destination_port_range)
            protocol_groups[key].append(rule)
        
        for key, rule_list in protocol_groups.items():
            if len(rule_list) > 1:
                protocols = set(rule.protocol for rule in rule_list)
                if len(protocols) > 1:
                    suggestions.append({
                        'type': 'protocol_consolidation',
                        'title': 'Consolidate rules with multiple protocols',
                        'description': f'Rules with same source/destination could use single rule with multiple protocols',
                        'affectedRules': [{'name': r.name, 'id': r.id, 'protocol': r.protocol} for r in rule_list],
                        'priority': 'Low',
                        'impact': 'Simplified rule management'
                    })
        
        return suggestions
    
    def _generate_priority_optimization_suggestions(self, rules: List[NSGRule]) -> List[Dict[str, Any]]:
        """Generate priority-based optimization suggestions"""
        suggestions = []
        
        # Check for priority gaps
        priorities = sorted([rule.priority for rule in rules])
        gaps = []
        
        for i in range(len(priorities) - 1):
            gap = priorities[i + 1] - priorities[i]
            if gap > 100:  # Significant gap
                gaps.append((priorities[i], priorities[i + 1], gap))
        
        if gaps:
            suggestions.append({
                'type': 'priority_optimization',
                'title': 'Optimize rule priorities',
                'description': f'Found {len(gaps)} significant gaps in rule priorities',
                'gaps': [{'start': start, 'end': end, 'size': size} for start, end, size in gaps],
                'priority': 'Low',
                'impact': 'Better rule organization and easier management'
            })
        
        return suggestions
    
    def _analyze_rule_optimization_opportunities(self, nsg_data):
        """Analyze NSG rules for optimization opportunities including removal and consolidation"""
        optimization_opportunities = []
        rules = nsg_data.get('securityRules', [])
        
        # Find redundant rules
        redundant_rules = self._find_redundant_rules(rules)
        if redundant_rules:
            optimization_opportunities.append({
                'type': 'redundant_rule_removal',
                'title': 'Remove Redundant Security Rules',
                'description': f'Found {len(redundant_rules)} redundant rules that can be safely removed without affecting security posture.',
                'priority': 'High',
                'impact': f'Simplify rule management and improve performance by removing {len(redundant_rules)} unnecessary rules',
                'estimatedSavings': f'Reduce rule complexity by {len(redundant_rules)} rules',
                'redundantRules': redundant_rules
            })
        
        # Find overly permissive rules
        permissive_rules = self._find_overly_permissive_rules(rules)
        if permissive_rules:
            optimization_opportunities.append({
                'type': 'permissive_rule_tightening',
                'title': 'Tighten Overly Permissive Rules',
                'description': f'Found {len(permissive_rules)} rules with overly broad access that should be restricted.',
                'priority': 'High',
                'impact': 'Improve security posture by reducing attack surface',
                'estimatedSavings': 'Enhanced security through principle of least privilege',
                'permissiveRules': permissive_rules
            })
        
        # Find unused rules
        unused_rules = self._find_potentially_unused_rules(rules)
        if unused_rules:
            optimization_opportunities.append({
                'type': 'unused_rule_removal',
                'title': 'Review Potentially Unused Rules',
                'description': f'Found {len(unused_rules)} rules that may no longer be needed based on naming patterns and configurations.',
                'priority': 'Medium',
                'impact': 'Reduce maintenance overhead and improve rule clarity',
                'estimatedSavings': f'Potential removal of {len(unused_rules)} unused rules',
                'unusedRules': unused_rules
            })
        
        # Find consolidation opportunities
        consolidation_opportunities = self._find_rule_consolidation_opportunities(rules)
        if consolidation_opportunities:
            optimization_opportunities.append({
                'type': 'rule_consolidation',
                'title': 'Consolidate Similar Rules',
                'description': f'Found {len(consolidation_opportunities)} opportunities to consolidate similar rules.',
                'priority': 'Medium',
                'impact': 'Simplify rule management and reduce complexity',
                'estimatedSavings': f'Reduce rule count through consolidation',
                'consolidationOpportunities': consolidation_opportunities
            })
        
        return optimization_opportunities
    
    def _find_redundant_rules(self, rules):
        """Find rules that are completely redundant (duplicate functionality)"""
        redundant_rules = []
        
        for i, rule1 in enumerate(rules):
            for j, rule2 in enumerate(rules[i+1:], i+1):
                if self._are_rules_redundant(rule1, rule2):
                    redundant_rules.append({
                        'ruleName': rule2.get('name', f'Rule-{j}'),
                        'redundantWith': rule1.get('name', f'Rule-{i}'),
                        'reason': 'Identical access pattern with lower priority',
                        'priority': rule2.get('properties', {}).get('priority', 'Unknown'),
                        'action': rule2.get('properties', {}).get('access', 'Unknown'),
                        'recommendation': f'Remove this rule as it duplicates {rule1.get("name", "another rule")}'
                    })
        
        return redundant_rules
    
    def _are_rules_redundant(self, rule1, rule2):
        """Check if two rules are redundant"""
        props1 = rule1.get('properties', {})
        props2 = rule2.get('properties', {})
        
        # Check if they have the same access pattern but different priorities
        same_direction = props1.get('direction') == props2.get('direction')
        same_access = props1.get('access') == props2.get('access')
        same_protocol = props1.get('protocol') == props2.get('protocol')
        same_source = (props1.get('sourceAddressPrefix') == props2.get('sourceAddressPrefix') or 
                      props1.get('sourceAddressPrefixes') == props2.get('sourceAddressPrefixes'))
        same_dest = (props1.get('destinationAddressPrefix') == props2.get('destinationAddressPrefix') or 
                    props1.get('destinationAddressPrefixes') == props2.get('destinationAddressPrefixes'))
        same_ports = (props1.get('destinationPortRange') == props2.get('destinationPortRange') or 
                     props1.get('destinationPortRanges') == props2.get('destinationPortRanges'))
        
        return same_direction and same_access and same_protocol and same_source and same_dest and same_ports
    
    def _find_overly_permissive_rules(self, rules):
        """Find rules that are overly permissive"""
        permissive_rules = []
        
        for rule in rules:
            props = rule.get('properties', {})
            issues = []
            
            # Check for overly broad source access
            if props.get('sourceAddressPrefix') == '*' or '0.0.0.0/0' in str(props.get('sourceAddressPrefixes', [])):
                issues.append('Allows access from any source (*)') 
            
            # Check for overly broad port access
            if props.get('destinationPortRange') == '*' or props.get('destinationPortRange') == '0-65535':
                issues.append('Allows access to all ports (*)')
            
            # Check for overly broad protocol access
            if props.get('protocol') == '*':
                issues.append('Allows all protocols (*)')
            
            # Check for dangerous combinations
            if (props.get('access') == 'Allow' and 
                props.get('direction') == 'Inbound' and 
                len(issues) >= 2):
                permissive_rules.append({
                    'ruleName': rule.get('name', 'Unknown'),
                    'priority': props.get('priority', 'Unknown'),
                    'issues': issues,
                    'riskLevel': 'High' if len(issues) >= 3 else 'Medium',
                    'recommendation': 'Restrict source, destination, or port ranges to minimum required access',
                    'currentConfig': {
                        'source': props.get('sourceAddressPrefix', props.get('sourceAddressPrefixes', [])),
                        'destination': props.get('destinationAddressPrefix', props.get('destinationAddressPrefixes', [])),
                        'ports': props.get('destinationPortRange', props.get('destinationPortRanges', [])),
                        'protocol': props.get('protocol', 'Unknown')
                    }
                })
        
        return permissive_rules
    
    def _find_potentially_unused_rules(self, rules):
        """Find rules that might be unused based on naming patterns and configurations"""
        unused_rules = []
        
        # Patterns that might indicate unused rules
        unused_patterns = ['test', 'temp', 'old', 'backup', 'deprecated', 'unused', 'delete']
        
        for rule in rules:
            rule_name = rule.get('name', '').lower()
            props = rule.get('properties', {})
            
            reasons = []
            
            # Check naming patterns
            for pattern in unused_patterns:
                if pattern in rule_name:
                    reasons.append(f'Rule name contains "{pattern}" suggesting it may be unused')
            
            # Check for rules with very high priorities (might be forgotten)
            priority = props.get('priority', 0)
            if priority > 4000:
                reasons.append('Very high priority number suggests it may be a temporary rule')
            
            # Check for deny rules with broad scope (might be overrides)
            if (props.get('access') == 'Deny' and 
                props.get('sourceAddressPrefix') == '*'):
                reasons.append('Broad deny rule that might be overriding other rules')
            
            if reasons:
                unused_rules.append({
                    'ruleName': rule.get('name', 'Unknown'),
                    'priority': priority,
                    'reasons': reasons,
                    'recommendation': 'Review if this rule is still needed and remove if unused',
                    'action': props.get('access', 'Unknown'),
                    'direction': props.get('direction', 'Unknown')
                })
        
        return unused_rules
    
    def _find_rule_consolidation_opportunities(self, rules):
        """Find opportunities to consolidate similar rules"""
        consolidation_opportunities = []
        
        # Group rules by similar patterns
        rule_groups = {}
        
        for rule in rules:
            props = rule.get('properties', {})
            
            # Create a key based on similar characteristics
            key = (
                props.get('direction', ''),
                props.get('access', ''),
                props.get('protocol', ''),
                props.get('sourceAddressPrefix', ''),
                props.get('destinationAddressPrefix', '')
            )
            
            if key not in rule_groups:
                rule_groups[key] = []
            rule_groups[key].append(rule)
        
        # Find groups with multiple rules that could be consolidated
        for key, group_rules in rule_groups.items():
            if len(group_rules) > 1:
                # Check if they only differ by port ranges
                ports = []
                for rule in group_rules:
                    props = rule.get('properties', {})
                    port_range = props.get('destinationPortRange', '')
                    if port_range:
                        ports.append(port_range)
                
                if len(ports) == len(group_rules) and len(set(ports)) == len(ports):
                    consolidation_opportunities.append({
                        'groupDescription': f'{key[1]} {key[0]} traffic for {key[2]} protocol',
                        'ruleCount': len(group_rules),
                        'rules': [{
                            'name': rule.get('name', 'Unknown'),
                            'priority': rule.get('properties', {}).get('priority', 'Unknown'),
                            'ports': rule.get('properties', {}).get('destinationPortRange', 'Unknown')
                        } for rule in group_rules],
                        'recommendation': f'Consolidate {len(group_rules)} similar rules into a single rule with multiple port ranges',
                        'benefit': f'Reduce rule count from {len(group_rules)} to 1 rule'
                    })
        
        return consolidation_opportunities[:5]  # Return top 5 opportunities
    
    def _is_ip_address(self, addr: str) -> bool:
        """Check if a string is a valid IP address or CIDR block"""
        try:
            import ipaddress
            # Try to parse as IP address or network
            ipaddress.ip_address(addr)
            return True
        except ValueError:
            try:
                # Try to parse as network (CIDR)
                ipaddress.ip_network(addr, strict=False)
                return True
            except ValueError:
                return False

# Global validator instance
nsg_validator = NSGValidator()