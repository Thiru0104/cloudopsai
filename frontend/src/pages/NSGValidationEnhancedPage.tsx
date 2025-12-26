import React, { useState, useEffect } from 'react';
import { exportToPDF } from '../utils/exportUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Search, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Brain, 
  Network, 
  Settings,
  TrendingUp,
  FileText,
  Lightbulb,
  Info,
  ChevronDown,
  Copy,
  GitMerge,
  Eye,
  BarChart3,
  Target,
  Zap,
  Download,
  Tag,
  ArrowDown,
  ArrowUp
} from 'lucide-react';


interface NSGRule {
  id: string;
  name: string;
  priority: number;
  direction: 'Inbound' | 'Outbound';
  access: 'Allow' | 'Deny';
  protocol: string;
  sourceAddressPrefix: string;
  sourcePortRange: string;
  destinationAddressPrefix: string;
  destinationPortRange: string;
  sourceApplicationSecurityGroups?: string[];
  destinationApplicationSecurityGroups?: string[];
}

interface NSGValidationResult {
  nsgName: string;
  resourceGroup: string;
  subscription: string;
  location: string;
  totalRules: number;
  inboundRules: number;
  outboundRules: number;
  
  // Inbound counts
  inboundSourceIpCount: number;
  inboundDestinationIpCount: number;
  inboundSourceAsgCount: number;
  inboundDestinationAsgCount: number;
  
  // Outbound counts
  outboundSourceIpCount: number;
  outboundDestinationIpCount: number;
  outboundSourceAsgCount: number;
  outboundDestinationAsgCount: number;
  
  // Legacy fields for backward compatibility
  sourceIpCount: number;
  destinationIpCount: number;
  asgCount: number;
  
  isWithinLimits: boolean;
  violations: ValidationViolation[];
  llmRecommendations: LLMRecommendation[];
  aiAnalysis?: AIAnalysis;
}

interface ValidationViolation {
  type: 'IP_LIMIT_EXCEEDED' | 'ASG_LIMIT_EXCEEDED' | 'RULE_COMPLEXITY';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  message: string;
  affectedRules: string[];
  currentCount: number;
  maxAllowed: number;
}

interface LLMRecommendation {
  id: string;
  type: 'CONSOLIDATION' | 'OPTIMIZATION' | 'SECURITY_IMPROVEMENT' | 'ASG_OPTIMIZATION' | 'CIDR_OVERLAP_RESOLUTION';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedSavings: {
    ipAddresses?: number;
    rules?: number;
    rules_reduced?: number;
    complexity_reduction?: string;
    security_improvement?: string;
    risk_reduction?: string;
    management_improvement?: string;
    security_segmentation?: string;
  };
  priority: 'High' | 'Medium' | 'Low';
  affected_resources?: {
    ip_addresses?: string[];
    rules?: string[];
    ports?: string[];
    asgs?: string[];
    recommended_asgs?: string[];
    recommended_cidrs?: string[];
    overlap_type?: string;
  };
}

interface Subscription {
  subscription_id: string;
  display_name: string;
  state: string;
  tenant_id: string;
}

interface ResourceGroup {
  name: string;
  location: string;
}

interface Location {
  name: string;
  display_name: string;
  latitude?: string;
  longitude?: string;
  subscription_id?: string;
}

interface NSG {
  id?: string;
  name: string;
  resourceGroup: string;
  location: string;
}

interface IPInventory {
  sourceIps: string[];
  destinationIps: string[];
  ipDetails: {
    ipAddress: string;
    type: 'source' | 'destination';
    ruleName: string;
    ruleId: string;
    direction: string;
    priority: number;
    access: string;
    protocol: string;
    ports: {
      destinationPorts: string;
      sourcePorts: string;
    };
  }[];
  summary: {
    totalUniqueSourceIps: number;
    totalUniqueDestinationIps: number;
    totalUniqueIps: number;
    totalIpReferences: number;
  };
}

interface ServiceTagAnalysis {
  serviceTags: {
    serviceTag: string;
    usageCount: number;
    rules: {
      ruleName: string;
      ruleId: string;
      direction: string;
      location: string;
      priority: number;
    }[];
    description: string;
    consolidationPotential: 'High' | 'Medium' | 'Low';
  }[];
  recommendations: {
    type: string;
    title: string;
    description: string;
    affectedTags?: string[];
    overlappingTags?: {
      tag1: string;
      tag2: string;
      description: string;
    }[];
    priority: string;
    impact: string;
  }[];
  summary: {
    totalServiceTags: number;
    totalUsages: number;
    highConsolidationPotential: number;
  };
}

interface RuleOptimization {
  removableRules: {
    ruleName: string;
    ruleId: string;
    priority: number;
    direction: string;
    access: string;
    removalReasons: {
      reason: string;
      description: string;
      confidence: string;
    }[];
    riskLevel: string;
    recommendation: string;
  }[];
  optimizationSuggestions: {
    type: string;
    title: string;
    description: string;
    affectedRules?: {
      name: string;
      id: string;
      protocol?: string;
    }[];
    gaps?: {
      start: number;
      end: number;
      size: number;
    }[];
    priority: string;
    impact: string;
  }[];
  summary: {
    totalRemovableRules: number;
    lowRiskRemovals: number;
    optimizationOpportunities: number;
  };
}

interface AIAnalysis {
  ipInventory: IPInventory;
  duplicateIps: DuplicateIP[];
  cidrOverlaps: CIDROverlap[];
  redundantRules: RedundantRule[];
  securityRisks: SecurityRisk[];
  consolidationOpportunities: ConsolidationOpportunity[];
  serviceTagAnalysis: ServiceTagAnalysis;
  ruleOptimization: RuleOptimization;
  visualAnalytics: VisualAnalytics;
}

interface DuplicateIP {
  ipAddress: string;
  usageCount: number;
  rules: {
    ruleName: string;
    ruleId: string;
    direction: string;
    location: string;
    priority: number;
  }[];
  severity: string;
  recommendation: string;
}

interface CIDROverlap {
  network1: {
    cidr: string;
    ruleName: string;
    ruleId: string;
    location: string;
  };
  network2: {
    cidr: string;
    ruleName: string;
    ruleId: string;
    location: string;
  };
  overlapType: string;
  severity: string;
  recommendation: string;
}

interface RedundantRule {
  rule1: {
    name: string;
    id: string;
    priority: number;
    direction: string;
  };
  rule2: {
    name: string;
    id: string;
    priority: number;
    direction: string;
  };
  similarityScore: number;
  similarityReasons: string[];
  severity: string;
  recommendation: string;
}

interface SecurityRisk {
  ruleName: string;
  ruleId: string;
  direction: string;
  priority: number;
  risks: {
    type: string;
    severity: string;
    description: string;
    recommendation: string;
    port?: string;
    service?: string;
    affectedRange?: string;
    estimatedIpCount?: number;
  }[];
  overallSeverity: string;
  riskCount: number;
}

interface ConsolidationOpportunity {
  type: string;
  description: string;
  rules: {
    name: string;
    id: string;
    priority?: number;
    port?: string;
  }[];
  potentialSavings: {
    ruleReduction?: number;
    managementComplexity?: string;
  };
  recommendation: string;
  priority: string;
}

interface VisualAnalytics {
  ruleDistribution: {
    inbound: number;
    outbound: number;
  };
  accessTypes: {
    allow: number;
    deny: number;
  };
  protocolDistribution: {
    TCP: number;
    UDP: number;
    ICMP: number;
  };
  priorityRanges: {
    high: number;
    medium: number;
    low: number;
  };
  riskLevels: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const NSGValidationEnhancedPage: React.FC = () => {
  // Form state
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [selectedResourceGroup, setSelectedResourceGroup] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedNSG, setSelectedNSG] = useState<string>('');
  
  // Data state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [nsgs, setNSGs] = useState<NSG[]>([]);
  
  // Results and UI state
  const [validationResults, setValidationResults] = useState<NSGValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAIAnalysis, setShowAIAnalysis] = useState<{[key: string]: boolean}>({});
  
  // Loading states for dropdowns
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingResourceGroups, setLoadingResourceGroups] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingNSGs, setLoadingNSGs] = useState(false);

  // Load subscriptions on component mount
  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Load resource groups when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      loadResourceGroups(selectedSubscription);
      setSelectedResourceGroup('');
      setSelectedLocation('');
      setSelectedNSG('');
    }
  }, [selectedSubscription]);

  // Load locations when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      loadLocations(selectedSubscription);
    }
  }, [selectedSubscription]);

  // Load NSGs when subscription, resource group, or location changes
  useEffect(() => {
    if (selectedSubscription) {
      loadNSGs(selectedSubscription, selectedResourceGroup, selectedLocation);
      setSelectedNSG('');
    }
  }, [selectedSubscription, selectedResourceGroup, selectedLocation]);

  const loadSubscriptions = async () => {
    try {
      setLoadingSubscriptions(true);
      const response = await fetch('/api/v1/subscriptions');
      if (!response.ok) throw new Error('Failed to load subscriptions');
      const data = await response.json();
      
      // Transform backend response to match frontend interface
      if (data && Array.isArray(data.subscriptions)) {
        const transformedSubscriptions = data.subscriptions.map((sub: any) => ({
          subscription_id: sub.id || '',
          display_name: sub.name || 'Unknown',
          state: sub.state || 'Unknown',
          tenant_id: sub.tenantId || ''
        }));
        
        setSubscriptions(transformedSubscriptions);
        
        // Auto-select first subscription if none is selected
        if (transformedSubscriptions.length > 0 && !selectedSubscription) {
          setSelectedSubscription(transformedSubscriptions[0].subscription_id);
        }
      } else {
        console.warn('Invalid subscriptions response:', data);
        setSubscriptions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
      setSubscriptions([]);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const loadResourceGroups = async (subscriptionId: string) => {
    try {
      setLoadingResourceGroups(true);
      const response = await fetch(`/api/v1/resource-groups?subscription_id=${subscriptionId}`);
      if (!response.ok) throw new Error('Failed to load resource groups');
      const data = await response.json();
      setResourceGroups(data.resource_groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resource groups');
    } finally {
      setLoadingResourceGroups(false);
    }
  };

  const loadLocations = async (subscriptionId: string) => {
    try {
      setLoadingLocations(true);
      const response = await fetch(`/api/v1/locations?subscription_id=${subscriptionId}`);
      if (!response.ok) throw new Error('Failed to load locations');
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations');
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadNSGs = async (subscriptionId: string, resourceGroup: string, location?: string) => {
    try {
      setLoadingNSGs(true);
      let url = `/api/v1/nsgs?subscription_id=${subscriptionId}`;
      if (resourceGroup) {
        url += `&resource_group=${resourceGroup}`;
      }
      if (location) {
        url += `&region=${location}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load NSGs');
      const data = await response.json();
      setNSGs(data.nsgs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load NSGs');
    } finally {
      setLoadingNSGs(false);
    }
  };

  const validateNSG = async () => {
    if (!selectedSubscription || !selectedResourceGroup || !selectedNSG) {
      setError('Please select subscription, resource group, and NSG');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/v1/nsg-validation/${encodeURIComponent(selectedNSG)}?subscription_id=${encodeURIComponent(selectedSubscription)}&resource_group=${encodeURIComponent(selectedResourceGroup)}`
      );
      if (!response.ok) throw new Error('Failed to validate NSG');
      
      const result = await response.json();
      
      // Debug logging to see what we're receiving
      console.log('Full API Response:', result);
      console.log('AI Analysis:', result.aiAnalysis);
      console.log('Visual Analytics:', result.aiAnalysis?.visualAnalytics);
      console.log('Rule Distribution:', result.aiAnalysis?.visualAnalytics?.ruleDistribution);
      
      result.subscription = selectedSubscription;
      result.location = selectedLocation;
      
      setValidationResults(prev => {
        const filtered = prev.filter(r => r.nsgName !== selectedNSG);
        return [...filtered, result];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async (nsgName: string) => {
    try {
      setAnalyzing(true);
      
      // Validate required parameters
      if (!selectedSubscription || !selectedResourceGroup || !nsgName) {
        throw new Error('Missing required parameters: subscription, resource group, or NSG name');
      }
      
      const response = await fetch(
        `/api/v1/nsg-recommendations/${encodeURIComponent(nsgName)}?subscription_id=${encodeURIComponent(selectedSubscription)}&resource_group=${encodeURIComponent(selectedResourceGroup)}`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to generate recommendations');
      
      const recommendations = await response.json();
      
      setValidationResults(prev => 
        prev.map(result => 
          result.nsgName === nsgName 
            ? { ...result, recommendations: recommendations.recommendations }
            : result
        )
      );
      
      // Show AI analysis details after successful generation
      setShowAIAnalysis(prev => ({ ...prev, [nsgName]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations');
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-50 border-red-200 text-red-800';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const filteredResults = validationResults.filter(result =>
    (result.nsgName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (result.resourceGroup?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (result.subscription?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (result.location?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const canValidate = selectedSubscription && selectedResourceGroup && selectedNSG;

  // Clear/Reset function
  const clearSelections = () => {
    setSelectedSubscription('');
    setSelectedResourceGroup('');
    setSelectedLocation('');
    setSelectedNSG('');
    setValidationResults([]);
    setError(null);
    setSearchTerm('');
  };

  // PDF Export function
  const handlePDFExport = (result: NSGValidationResult) => {
    if (!result.aiAnalysis) {
      setError('AI Analysis data is required for PDF export. Please run AI Analysis first.');
      return;
    }

    try {
      // Extract NSG rules from IP inventory details
      const extractedRules: any[] = [];
      if (result.aiAnalysis.ipInventory?.ipDetails) {
        const ruleMap = new Map();
        result.aiAnalysis.ipInventory.ipDetails.forEach(detail => {
          if (!ruleMap.has(detail.ruleId)) {
            ruleMap.set(detail.ruleId, {
              name: detail.ruleName,
              priority: detail.priority,
              direction: detail.direction,
              access: detail.access,
              protocol: detail.protocol,
              sourcePortRange: detail.ports?.sourcePorts || '*',
              destinationPortRange: detail.ports?.destinationPorts || '*',
              sourceAddressPrefix: detail.type === 'source' ? detail.ipAddress : '*',
              destinationAddressPrefix: detail.type === 'destination' ? detail.ipAddress : '*'
            });
          }
        });
        extractedRules.push(...Array.from(ruleMap.values()));
      }

      // Transform validation result to NSG data format
      const nsgData = {
        name: result.nsgName,
        resourceGroup: result.resourceGroup,
        subscriptionId: result.subscription,
        location: result.location,
        rules: extractedRules,
        totalRules: result.totalRules,
        inboundRules: result.inboundRules,
        outboundRules: result.outboundRules
      };

      // Extract all unique IPs including service tags
      const allSourceIps = new Set<string>();
      const allDestinationIps = new Set<string>();
      
      // Add IPs from inventory
      if (result.aiAnalysis.ipInventory?.sourceIps) {
        result.aiAnalysis.ipInventory.sourceIps.forEach(ip => allSourceIps.add(ip));
      }
      if (result.aiAnalysis.ipInventory?.destinationIps) {
        result.aiAnalysis.ipInventory.destinationIps.forEach(ip => allDestinationIps.add(ip));
      }
      
      // Add service tags from service tag analysis
      if (result.aiAnalysis.serviceTagAnalysis?.serviceTags) {
        result.aiAnalysis.serviceTagAnalysis.serviceTags.forEach(tag => {
          allDestinationIps.add(tag.serviceTag);
        });
      }

      // Extract security risks with proper mapping
      const securityRisks = result.aiAnalysis.securityRisks?.flatMap(riskItem => 
        riskItem.risks?.map(risk => ({
          risk: risk.type || 'Security Risk',
          severity: risk.severity || 'Medium',
          description: risk.description || `Risk identified in rule: ${riskItem.ruleName}`,
          recommendation: risk.recommendation || 'Review and update rule configuration'
        })) || []
      ) || [];

      // Extract port analysis from security risks
      const portAnalysis = result.aiAnalysis.securityRisks?.flatMap(riskItem => 
        riskItem.risks?.filter(risk => risk.port).map(risk => ({
          port: risk.port || 'Unknown',
          protocol: result.aiAnalysis.ipInventory?.ipDetails?.find(detail => 
            detail.ruleName === riskItem.ruleName
          )?.protocol || 'TCP',
          risk: risk.type || 'Security Risk',
          recommendation: risk.recommendation || 'Review port configuration'
        })) || []
      ) || [];

      // Transform AI analysis to expected format
      const aiAnalysis = {
        ipInventoryExists: result.aiAnalysis.ipInventory ? true : false,
        sourceIpsCount: allSourceIps.size,
        destinationIpsCount: allDestinationIps.size,
        sourceIps: Array.from(allSourceIps),
        destinationIps: Array.from(allDestinationIps),
        securityRisks: securityRisks,
        portAnalysis: portAnalysis,
        recommendations: result.llmRecommendations?.map(rec => ({
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          remediation: rec.implementation || rec.description
        })) || []
      };

      // Generate enhanced PDF report with comprehensive AI analysis
      const exportData = {
        nsgName: result.nsgName,
        resourceGroup: result.resourceGroup,
        subscription: result.subscription,
        totalRules: result.totalRules,
        violations: result.violations || [],
        recommendations: result.llmRecommendations || [],
        aiAnalysis: result.aiAnalysis
      };
      
      exportToPDF(exportData);
    } catch (error) {
      console.error('PDF Export Error:', error);
      setError('Failed to generate PDF report. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <h1 className="text-4xl font-bold gradient-text">
            NSG Validation & Optimization
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Select your Azure resources and validate NSG rules against Azure limits with AI-powered recommendations for optimization.
          </p>
        </div>

        {/* Selection Controls */}
        <div className="enterprise-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Resource Selection</span>
            </CardTitle>
            <CardDescription>
              Choose your subscription, resource group, location, and NSG to validate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* First Row: Subscription and Resource Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Subscription</label>
                <Select value={selectedSubscription} onValueChange={setSelectedSubscription}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingSubscriptions ? "Loading..." : "Select subscription"} />
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptions.map((sub) => (
                      <SelectItem key={sub.subscription_id} value={sub.subscription_id}>
                        {sub.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Resource Group</label>
                <Select 
                  value={selectedResourceGroup} 
                  onValueChange={setSelectedResourceGroup}
                  disabled={!selectedSubscription}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !selectedSubscription ? "Select subscription first" :
                      loadingResourceGroups ? "Loading..." : 
                      "Select resource group"
                    } />
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceGroups.map((rg) => (
                      <SelectItem key={rg.name} value={rg.name}>
                        {rg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second Row: Location and NSG */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Location (Optional)</label>
                <Select 
                  value={selectedLocation} 
                  onValueChange={setSelectedLocation}
                  disabled={!selectedSubscription}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !selectedSubscription ? "Select subscription first" :
                      loadingLocations ? "Loading..." : 
                      "All locations"
                    } />
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all-locations" value="">All locations</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.name} value={loc.name}>
                        {loc.display_name || loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Network Security Group</label>
                <Select 
                  value={selectedNSG} 
                  onValueChange={setSelectedNSG}
                  disabled={!selectedSubscription || !selectedResourceGroup}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !selectedSubscription || !selectedResourceGroup ? "Select subscription and resource group first" :
                      loadingNSGs ? "Loading..." : 
                      "Select NSG"
                    } />
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </SelectTrigger>
                  <SelectContent>
                    {nsgs.map((nsg) => (
                      <SelectItem key={nsg.id || `${nsg.resourceGroup}-${nsg.name}`} value={nsg.name}>
                        {nsg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder="Search results..."
                  className="input-modern pl-12 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={clearSelections}
                  variant="outline"
                  className="btn-outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
                <Button 
                  onClick={validateNSG}
                  disabled={loading || !canValidate}
                  className="btn-secondary"
                >
                  <Shield className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Validate NSG
                </Button>
              </div>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </div>

        {/* Validation Results */}
        <div className="space-y-6">
          {/* Export Buttons - Show only when there are results with AI analysis */}

          
          {filteredResults.map((result, index) => (
            <div key={`${result.nsgName}-${result.subscription}`} className="enterprise-card animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl shadow-lg ${
                      result.isWithinLimits 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                        : 'bg-gradient-to-r from-red-500 to-orange-600'
                    }`}>
                      {result.isWithinLimits ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <XCircle className="w-4 h-4 text-white" />
                      )}

                {/* Ready-to-Implement Rules Section Removed */}
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800">{result.nsgName}</CardTitle>
                      <CardDescription className="text-slate-600">
                        {result.subscription} • {result.resourceGroup} • {result.location} • {result.totalRules} rules
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={result.isWithinLimits 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-red-100 text-red-800 border-red-200'
                    }>
                      {result.isWithinLimits ? 'COMPLIANT' : 'VIOLATIONS FOUND'}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        onClick={() => generateRecommendations(result.nsgName)}
                        disabled={analyzing}
                        className="btn-secondary"
                      >
                        <Brain className={`w-4 h-4 mr-2 ${analyzing ? 'animate-pulse' : ''}`} />
                        AI Analysis
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => handlePDFExport(result)}
                        disabled={!result.aiAnalysis}
                        className="btn-outline"
                        title="Export comprehensive PDF report"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </Button>

                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Statistics Grid */}
                <div className="space-y-6">
                  {/* Inbound Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center">
                      <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
                      Inbound Rules ({result.inboundRules})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Source IPs + ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{(result.inboundSourceIpCount ?? 0).toLocaleString()}</p>
                          </div>
                          <Network className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="mt-2">
                          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                            result.inboundSourceIpCount > 4000 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {result.inboundSourceIpCount > 4000 ? 'Over Limit' : 'Within Limit'}
                          </div>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Destination IPs + ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{(result.inboundDestinationIpCount ?? 0).toLocaleString()}</p>
                          </div>
                          <Network className="w-8 h-8 text-purple-500" />
                        </div>
                        <div className="mt-2">
                          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                            result.inboundDestinationIpCount > 4000 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {result.inboundDestinationIpCount > 4000 ? 'Over Limit' : 'Within Limit'}
                          </div>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Source ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{result.inboundSourceAsgCount}</p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-orange-500" />
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Destination ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{result.inboundDestinationAsgCount}</p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-orange-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zero Rules Guidance */}
                  {result.totalRules === 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-blue-800 mb-1">No Security Rules Found</h4>
                          <p className="text-sm text-blue-700 mb-2">
                            This NSG currently has no security rules configured. This is a valid scenario for newly created or unused NSGs.
                          </p>
                          <p className="text-sm text-blue-700">
                            <strong>To test the validation logic:</strong> Try selecting "demo-nsg" from the NSG dropdown, which contains sample rules for demonstration purposes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Outbound Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center">
                      <TrendingUp className="w-5 h-5 text-red-500 mr-2" />
                      Outbound Rules ({result.outboundRules})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Source IPs + ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{(result.outboundSourceIpCount ?? 0).toLocaleString()}</p>
                          </div>
                          <Network className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="mt-2">
                          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                            result.outboundSourceIpCount > 4000 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {result.outboundSourceIpCount > 4000 ? 'Over Limit' : 'Within Limit'}
                          </div>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Destination IPs + ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{(result.outboundDestinationIpCount ?? 0).toLocaleString()}</p>
                          </div>
                          <Network className="w-8 h-8 text-purple-500" />
                        </div>
                        <div className="mt-2">
                          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                            result.outboundDestinationIpCount > 4000 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {result.outboundDestinationIpCount > 4000 ? 'Over Limit' : 'Within Limit'}
                          </div>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Source ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{result.outboundSourceAsgCount}</p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-orange-500" />
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-600">Destination ASGs</p>
                            <p className="text-2xl font-bold text-slate-800">{result.outboundDestinationAsgCount}</p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-orange-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Violations */}
                {result.violations && result.violations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                      Violations Found
                    </h4>
                    <div className="space-y-2">
                      {result.violations.map((violation, idx) => (
                        <div key={idx} className={`p-4 rounded-lg border-l-4 ${getSeverityColor(violation.severity)}`}>
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={getSeverityColor(violation.severity)}>
                              {violation.severity.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-slate-600">
                              {violation.currentCount} / {violation.maxAllowed}
                            </span>
                          </div>
                          <p className="font-medium text-slate-800 mb-1">{violation.message}</p>
                          {violation.affectedRules.length > 0 && (
                            <p className="text-sm text-slate-600">
                              Affected rules: {violation.affectedRules.join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Recommendations */}
                {result.llmRecommendations && result.llmRecommendations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                        <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
                        AI Recommendations
                      </h4>
                    </div>
                    <div className="space-y-4">
                      {result.llmRecommendations.map((rec) => (
                        <div key={rec.id} className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-slate-800">{rec.title}</h5>
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority} Priority
                            </Badge>
                          </div>
                          <p className="text-slate-700 mb-3">{rec.description}</p>
                          
                          {/* Affected Resources Section */}
                          {rec.affected_resources && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                              <h5 className="font-medium text-slate-800 mb-2 flex items-center">
                                <Target className="w-4 h-4 mr-1" />
                                Affected Resources
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {rec.affected_resources.ip_addresses && rec.affected_resources.ip_addresses.length > 0 && (
                                  <div>
                                    <span className="font-medium text-slate-700">IP Addresses:</span>
                                    <div className="mt-1">
                                      {rec.affected_resources.ip_addresses.map((ip, idx) => (
                                        <span key={idx} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                          {ip}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {rec.affected_resources.asgs && rec.affected_resources.asgs.length > 0 && (
                                  <div>
                                    <span className="font-medium text-slate-700">ASGs:</span>
                                    <div className="mt-1">
                                      {rec.affected_resources.asgs.map((asg, idx) => (
                                        <span key={idx} className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                          {asg}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {rec.affected_resources.rules && rec.affected_resources.rules.length > 0 && (
                                  <div>
                                    <span className="font-medium text-slate-700">Rules:</span>
                                    <div className="mt-1">
                                      {rec.affected_resources.rules.map((rule, idx) => (
                                        <span key={idx} className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                          {rule}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {rec.affected_resources.ports && rec.affected_resources.ports.length > 0 && (
                                  <div>
                                    <span className="font-medium text-slate-700">Ports:</span>
                                    <div className="mt-1">
                                      {rec.affected_resources.ports.map((port, idx) => (
                                        <span key={idx} className="inline-block bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                          {port}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {rec.affected_resources.recommended_asgs && rec.affected_resources.recommended_asgs.length > 0 && (
                                  <div>
                                    <span className="font-medium text-slate-700">Recommended ASGs:</span>
                                    <div className="mt-1">
                                      {rec.affected_resources.recommended_asgs.map((asg, idx) => (
                                        <span key={idx} className="inline-block bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                          {asg}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {rec.affected_resources.recommended_cidrs && rec.affected_resources.recommended_cidrs.length > 0 && (
                                  <div>
                                    <span className="font-medium text-slate-700">Recommended CIDRs:</span>
                                    <div className="mt-1">
                                      {rec.affected_resources.recommended_cidrs.map((cidr, idx) => (
                                        <span key={idx} className="inline-block bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                          {cidr}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-slate-800 mb-1">Impact:</p>
                              <p className="text-slate-600">{rec.impact}</p>
                            </div>
                            <div>
                              <p className="font-medium text-slate-800 mb-1">Implementation:</p>
                              <p className="text-slate-600">{rec.implementation}</p>
                            </div>
                          </div>
                          
                          {/* Enhanced Estimated Savings */}
                          {rec.estimatedSavings && (
                            <div className="mt-3 p-3 bg-green-50 rounded-lg">
                              <p className="text-sm font-medium text-green-800 mb-1">Estimated Savings:</p>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-green-700">
                                {rec.estimatedSavings.ipAddresses && (
                                  <span className="flex items-center bg-blue-50 px-2 py-1 rounded">
                                    💰 Save {rec.estimatedSavings.ipAddresses} IP addresses
                                  </span>
                                )}
                                {rec.estimatedSavings.rules && (
                                  <span className="flex items-center bg-green-50 px-2 py-1 rounded">
                                    📋 Reduce {rec.estimatedSavings.rules} rules
                                  </span>
                                )}
                                {rec.estimatedSavings.rules_reduced && (
                                  <span className="flex items-center bg-yellow-50 px-2 py-1 rounded">
                                    🔧 {rec.estimatedSavings.rules_reduced} rules optimized
                                  </span>
                                )}
                                {rec.estimatedSavings.complexity_reduction && (
                                  <span className="flex items-center bg-purple-50 px-2 py-1 rounded">
                                    ⚡ {rec.estimatedSavings.complexity_reduction}
                                  </span>
                                )}
                                {rec.estimatedSavings.security_improvement && (
                                  <span className="flex items-center bg-red-50 px-2 py-1 rounded">
                                    🛡️ {rec.estimatedSavings.security_improvement}
                                  </span>
                                )}
                                {rec.estimatedSavings.risk_reduction && (
                                  <span className="flex items-center bg-orange-50 px-2 py-1 rounded">
                                    ⚠️ {rec.estimatedSavings.risk_reduction}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Analysis Section */}
                {result.aiAnalysis && showAIAnalysis[result.nsgName] && (
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <h4 className="text-xl font-bold text-slate-800 flex items-center">
                        <Brain className="w-6 h-6 mr-2 text-purple-500" />
                        AI Analysis
                      </h4>
                    </div>

                    {/* Visual Analytics Overview */}
                    {result.aiAnalysis.visualAnalytics && (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg">
                        <h5 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                          <BarChart3 className="w-5 h-5 mr-2 text-purple-500" />
                          Visual Analytics Overview
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {result?.aiAnalysis?.visualAnalytics?.ruleDistribution?.inbound || 0}
                            </div>
                            <div className="text-sm text-slate-600">Inbound Rules</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {result?.aiAnalysis?.visualAnalytics?.ruleDistribution?.outbound || 0}
                            </div>
                            <div className="text-sm text-slate-600">Outbound Rules</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {result?.aiAnalysis?.visualAnalytics?.accessTypes?.allow || 0}
                            </div>
                            <div className="text-sm text-slate-600">Allow Rules</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                              {result?.aiAnalysis?.visualAnalytics?.accessTypes?.deny || 0}
                            </div>
                            <div className="text-sm text-slate-600">Deny Rules</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {(result?.aiAnalysis?.visualAnalytics?.riskLevels?.critical || 0) + (result?.aiAnalysis?.visualAnalytics?.riskLevels?.high || 0)}
                            </div>
                            <div className="text-sm text-slate-600">High Risk</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Security Risks */}
                    {result.aiAnalysis?.securityRisks && result.aiAnalysis.securityRisks.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                          Security Risk Assessment ({result.aiAnalysis?.securityRisks?.length || 0})
                        </h5>
                        <div className="space-y-3">
                          {result.aiAnalysis?.securityRisks?.map((risk, idx) => (
                            <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                              risk.overallSeverity === 'Critical' ? 'border-red-500 bg-red-50' :
                              risk.overallSeverity === 'High' ? 'border-orange-500 bg-orange-50' :
                              risk.overallSeverity === 'Medium' ? 'border-yellow-500 bg-yellow-50' :
                              'border-blue-500 bg-blue-50'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-semibold text-slate-800">{risk.ruleName}</h6>
                                <Badge className={`${
                                  risk.overallSeverity === 'Critical' ? 'bg-red-100 text-red-800' :
                                  risk.overallSeverity === 'High' ? 'bg-orange-100 text-orange-800' :
                                  risk.overallSeverity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {risk.overallSeverity} Risk
                                </Badge>
                              </div>
                              <div className="text-sm text-slate-600 mb-2">
                                Rule ID: {risk.ruleId} | Direction: {risk.direction} | Priority: {risk.priority}
                              </div>
                              <div className="space-y-3">
                                {risk.risks.map((r, ridx) => (
                                  <div key={ridx} className="bg-white p-3 rounded border border-red-100">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-medium text-slate-800">{r.type}</span>
                                      <Badge variant="outline" className={`text-xs ${
                                        r.severity === 'Critical' ? 'border-red-500 text-red-700' :
                                        r.severity === 'High' ? 'border-orange-500 text-orange-700' :
                                        r.severity === 'Medium' ? 'border-yellow-500 text-yellow-700' :
                                        'border-blue-500 text-blue-700'
                                      }`}>
                                        {r.severity}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-slate-700 mb-2">{r.description}</div>
                                    <div className="text-sm text-slate-600 italic mb-2">→ {r.recommendation}</div>
                                    {(r.port || r.service || r.affectedRange || r.estimatedIpCount) && (
                                      <div className="text-xs text-slate-500 space-y-1 border-t pt-2">
                                        {r.port && <div>Port: <span className="font-mono bg-gray-100 px-1 rounded">{r.port}</span></div>}
                                        {r.service && <div>Service: <span className="font-medium">{r.service}</span></div>}
                                        {r.affectedRange && <div>Affected Range: <span className="font-mono bg-gray-100 px-1 rounded">{r.affectedRange}</span></div>}
                                        {r.estimatedIpCount && <div>Estimated IP Count: <span className="font-medium text-red-600">{(r.estimatedIpCount ?? 0).toLocaleString()}</span></div>}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}



                    {/* CIDR Overlaps */}
                    {result.aiAnalysis?.cidrOverlaps && result.aiAnalysis.cidrOverlaps.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <Target className="w-5 h-5 mr-2 text-green-500" />
                          CIDR Overlap Analysis ({result.aiAnalysis?.cidrOverlaps?.length || 0})
                        </h5>
                        <div className="space-y-3">
                          {result.aiAnalysis?.cidrOverlaps?.map((overlap, idx) => (
                            <div key={idx} className="p-4 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-semibold text-slate-800">
                                  {overlap.network1.cidr} ↔ {overlap.network2.cidr}
                                </h6>
                                <Badge className="bg-green-100 text-green-800">
                                  {overlap.overlapType}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-3">{overlap.recommendation}</p>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-700">Network Details:</div>
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="bg-white p-3 rounded border border-green-100">
                                    <div className="font-medium text-slate-800 mb-1">Network 1</div>
                                    <div className="text-sm text-slate-600 space-y-1">
                                      <div>CIDR: <span className="font-mono bg-gray-100 px-1 rounded">{overlap.network1.cidr}</span></div>
                                      <div>Rule: <span className="font-medium">{overlap.network1.ruleName}</span></div>
                                      <div>Rule ID: {overlap.network1.ruleId}</div>
                                      <div>Location: <span className="font-medium">{overlap.network1.location}</span></div>
                                    </div>
                                  </div>
                                  <div className="bg-white p-3 rounded border border-green-100">
                                    <div className="font-medium text-slate-800 mb-1">Network 2</div>
                                    <div className="text-sm text-slate-600 space-y-1">
                                      <div>CIDR: <span className="font-mono bg-gray-100 px-1 rounded">{overlap.network2.cidr}</span></div>
                                      <div>Rule: <span className="font-medium">{overlap.network2.ruleName}</span></div>
                                      <div>Rule ID: {overlap.network2.ruleId}</div>
                                      <div>Location: <span className="font-medium">{overlap.network2.location}</span></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Redundant Rules */}
                    {result.aiAnalysis?.redundantRules && result.aiAnalysis.redundantRules.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <GitMerge className="w-5 h-5 mr-2 text-orange-500" />
                          Redundant Rule Identification ({result.aiAnalysis?.redundantRules?.length || 0})
                        </h5>
                        <div className="space-y-3">
                          {result.aiAnalysis?.redundantRules?.map((redundant, idx) => (
                            <div key={idx} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-semibold text-slate-800">
                                  {redundant.rule1.name} ↔ {redundant.rule2.name}
                                </h6>
                                <Badge className="bg-orange-100 text-orange-800">
                                  {Math.round(redundant.similarityScore * 100)}% Similar
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{redundant.recommendation}</p>
                              <div className="text-xs text-slate-500">
                                Similarities: {redundant.similarityReasons.join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}



                    {/* IP Inventory Analysis */}
                    {result.aiAnalysis.ipInventory && (
                      <div className="space-y-3">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <Network className="w-5 h-5 mr-2 text-cyan-500" />
                          IP Address Inventory Analysis
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
                            <div className="text-2xl font-bold text-cyan-600">
                              {result.aiAnalysis?.ipInventory?.totalUniqueIps || 0}
                            </div>
                            <div className="text-sm text-slate-600">Unique IP Addresses</div>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="text-2xl font-bold text-blue-600">
                              {result.aiAnalysis?.ipInventory?.duplicateIpCount || 0}
                            </div>
                            <div className="text-sm text-slate-600">Duplicate IPs</div>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <div className="text-2xl font-bold text-green-600">
                              {result.aiAnalysis?.ipInventory?.consolidationPotential || 0}%
                            </div>
                            <div className="text-sm text-slate-600">Consolidation Potential</div>
                          </div>
                        </div>
                        
                        {/* IP Address Details */}
                        {result.aiAnalysis?.ipInventory?.ipDetails && result.aiAnalysis.ipInventory.ipDetails.length > 0 && (
                          <div className="space-y-3 mb-6">
                            <h6 className="font-medium text-slate-800">Detailed IP Address Inventory</h6>
                            <div className="max-h-96 overflow-y-auto space-y-2">
                              {result.aiAnalysis?.ipInventory?.ipDetails?.map((detail, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-slate-600">IP Address:</span>
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
                                        {detail.ipAddress}
                                      </span>
                                      <Badge className={`text-xs ${
                                        detail.type === 'source' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                                      }`}>
                                        {detail.type}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-slate-600">Rule:</span>
                                      <span className="text-sm text-slate-800">{detail.ruleName}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-slate-600">Direction:</span>
                                      <Badge className={`text-xs ${
                                        detail.direction === 'Inbound' ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800'
                                      }`}>
                                        {detail.direction}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-slate-600">Priority:</span>
                                      <span className="text-sm text-slate-800">{detail.priority}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-slate-600">Access:</span>
                                      <Badge className={`text-xs ${
                                        detail.access === 'Allow' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {detail.access}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-slate-600">Protocol:</span>
                                      <span className="text-sm text-slate-800">{detail.protocol}</span>
                                    </div>
                                    {detail.ports && (
                                      <div className="col-span-full">
                                        <div className="flex items-center space-x-4">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-slate-600">Source Ports:</span>
                                            <span className="text-sm text-slate-800 font-mono">{detail.ports.sourcePorts}</span>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-slate-600">Dest Ports:</span>
                                            <span className="text-sm text-slate-800 font-mono">{detail.ports.destinationPorts}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.aiAnalysis?.ipInventory?.ipCategories && (
                          <div className="space-y-3">
                            <h6 className="font-medium text-slate-800">IP Address Categories</h6>
                            <div className="grid gap-3">
                              {Object.entries(result.aiAnalysis?.ipInventory?.ipCategories || {}).map(([category, ips]) => (
                                <div key={category} className="bg-white p-4 rounded-lg border border-slate-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <h6 className="font-semibold text-slate-800 capitalize">
                                      {category.replace('_', ' ')} IPs
                                    </h6>
                                    <Badge className="bg-slate-100 text-slate-800">
                                      {Array.isArray(ips) ? ips.length : 0} addresses
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.isArray(ips) && ips.slice(0, 10).map((ip, idx) => (
                                      <span key={idx} className="inline-block bg-cyan-100 text-cyan-800 px-2 py-1 rounded text-xs">
                                        {ip}
                                      </span>
                                    ))}
                                    {Array.isArray(ips) && ips.length > 10 && (
                                      <span className="inline-block bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                                        +{ips.length - 10} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Service Tag Analysis */}
                    {result.aiAnalysis.serviceTagAnalysis && (
                      <div className="space-y-4">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <Tag className="w-5 h-5 mr-2 text-indigo-500" />
                          Service Tag Analysis & Optimization
                        </h5>
                        
                        {/* Service Tag Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                            <div className="text-2xl font-bold text-indigo-600">
                              {result.aiAnalysis?.serviceTagAnalysis?.summary?.totalServiceTags || 0}
                            </div>
                            <div className="text-sm text-slate-600">Service Tags Used</div>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <div className="text-2xl font-bold text-purple-600">
                              {result.aiAnalysis?.serviceTagAnalysis?.summary?.conversionOpportunities || 0}
                            </div>
                            <div className="text-sm text-slate-600">IP→Tag Opportunities</div>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="text-2xl font-bold text-blue-600">
                              {result.aiAnalysis?.serviceTagAnalysis?.summary?.highConsolidationPotential || 0}
                            </div>
                            <div className="text-sm text-slate-600">High Consolidation Potential</div>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <div className="text-2xl font-bold text-green-600">
                              {result.aiAnalysis?.serviceTagAnalysis?.summary?.securityImprovements || 0}
                            </div>
                            <div className="text-sm text-slate-600">Security Improvements</div>
                          </div>
                        </div>
                        
                        {/* Service Tag Recommendations */}
                        {result.aiAnalysis?.serviceTagAnalysis?.recommendations && (
                          <div className="space-y-3">
                            <h6 className="text-md font-semibold text-slate-800">Optimization Recommendations</h6>
                            {result.aiAnalysis?.serviceTagAnalysis?.recommendations?.map((rec, idx) => (
                              <div key={idx} className={`p-4 rounded-lg border ${
                                rec.type === 'ip_to_service_tag_conversion' ? 'bg-green-50 border-green-200' :
                                rec.type === 'service_tag_consolidation' ? 'bg-blue-50 border-blue-200' :
                                rec.type === 'overlapping_service_tags' ? 'bg-yellow-50 border-yellow-200' :
                                'bg-indigo-50 border-indigo-200'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-semibold text-slate-800">{rec.title}</h6>
                                  <Badge className={`${
                                    rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                                    rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {rec.priority} Priority
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-700 mb-3">{rec.description}</p>
                                
                                {/* IP to Service Tag Conversion Opportunities */}
                                {rec.type === 'ip_to_service_tag_conversion' && rec.opportunities && (
                                  <div className="mb-3">
                                    <div className="text-sm font-medium text-slate-800 mb-2">Conversion Opportunities:</div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                      {rec.opportunities.slice(0, 5).map((opp, oppIdx) => (
                                        <div key={oppIdx} className="bg-white p-3 rounded border border-green-100">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-slate-800">{opp.ruleName}</span>
                                            <Badge className="bg-green-100 text-green-800 text-xs">{opp.confidence}</Badge>
                                          </div>
                                          <div className="text-xs text-slate-600 mb-1">
                                            Replace: <code className="bg-slate-100 px-1 rounded">{opp.currentIp}</code> → 
                                            <span className="text-green-600 font-medium">{opp.recommendedServiceTag}</span>
                                          </div>
                                          <div className="text-xs text-slate-500">{opp.benefit}</div>
                                        </div>
                                      ))}
                                      {rec.opportunities.length > 5 && (
                                        <div className="text-xs text-slate-500 text-center py-2">
                                          +{rec.opportunities.length - 5} more opportunities
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Overlapping Service Tags */}
                                {rec.type === 'overlapping_service_tags' && rec.overlappingTags && (
                                  <div className="mb-3">
                                    <div className="text-sm font-medium text-slate-800 mb-2">Overlapping Tags:</div>
                                    <div className="space-y-2">
                                      {rec.overlappingTags.map((overlap, overlapIdx) => (
                                        <div key={overlapIdx} className="bg-white p-3 rounded border border-yellow-100">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">{overlap.tag1}</span>
                                            <span className="text-slate-400">↔</span>
                                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">{overlap.tag2}</span>
                                            <Badge className={`ml-auto ${
                                              overlap.severity === 'High' ? 'bg-red-100 text-red-800' :
                                              overlap.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                              'bg-blue-100 text-blue-800'
                                            }`}>
                                              {overlap.severity}
                                            </Badge>
                                          </div>
                                          <div className="text-xs text-slate-600 mb-1">{overlap.description}</div>
                                          <div className="text-xs text-green-600">{overlap.recommendation}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Current and Recommended Service Tags */}
                                {rec.currentServiceTags && (
                                  <div className="mb-3">
                                    <div className="text-sm font-medium text-slate-800 mb-1">Current Service Tags:</div>
                                    <div className="flex flex-wrap gap-1">
                                      {rec.currentServiceTags.map((tag, tagIdx) => (
                                        <span key={tagIdx} className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {rec.recommendedServiceTags && (
                                  <div className="mb-3">
                                    <div className="text-sm font-medium text-slate-800 mb-1">Recommended Service Tags:</div>
                                    <div className="flex flex-wrap gap-1">
                                      {rec.recommendedServiceTags.map((tag, tagIdx) => (
                                        <span key={tagIdx} className="inline-block bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {rec.estimatedSavings && (
                                  <div className="text-sm text-green-600 font-medium">
                                    💰 {rec.estimatedSavings}
                                  </div>
                                )}
                                
                                {rec.impact && (
                                  <div className="text-sm text-blue-600 mt-2">
                                    📈 Impact: {rec.impact}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Service Tags Inventory */}
                        {result.aiAnalysis?.serviceTagAnalysis?.serviceTags && result.aiAnalysis.serviceTagAnalysis.serviceTags.length > 0 && (
                          <div className="mt-4">
                            <h6 className="text-md font-semibold text-slate-800 mb-3">Service Tags Inventory</h6>
                            <div className="grid gap-3">
                              {result.aiAnalysis?.serviceTagAnalysis?.serviceTags?.slice(0, 6).map((tag, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-800">{tag.serviceTag}</span>
                                      <Badge className={`${
                                        tag.consolidationPotential === 'High' ? 'bg-red-100 text-red-800' :
                                        tag.consolidationPotential === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-green-100 text-green-800'
                                      }`}>
                                        {tag.consolidationPotential} Consolidation
                                      </Badge>
                                      {tag.securityImpact && (
                                        <Badge className={`${
                                          tag.securityImpact === 'High' ? 'bg-red-100 text-red-800' :
                                          tag.securityImpact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-blue-100 text-blue-800'
                                        }`}>
                                          {tag.securityImpact} Security Impact
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-sm text-slate-600">Used {tag.usageCount} times</span>
                                  </div>
                                  <p className="text-sm text-slate-600 mb-2">{tag.description}</p>
                                  {tag.alternativeServiceTags && tag.alternativeServiceTags.length > 0 && (
                                    <div>
                                      <div className="text-xs font-medium text-slate-700 mb-1">Alternatives:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {tag.alternativeServiceTags.map((altTag, altIdx) => (
                                          <span key={altIdx} className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                                            {altTag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {(result.aiAnalysis?.serviceTagAnalysis?.serviceTags?.length || 0) > 6 && (
                                <div className="text-center py-2 text-sm text-slate-500">
                                  +{(result.aiAnalysis?.serviceTagAnalysis?.serviceTags?.length || 0) - 6} more service tags
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rule Optimization Recommendations */}
                    {result.aiAnalysis.ruleOptimization && (
                      <div className="space-y-3">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <Settings className="w-5 h-5 mr-2 text-emerald-500" />
                          Rule Optimization Recommendations
                        </h5>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <div className="text-2xl font-bold text-red-600">
                              {result.aiAnalysis?.ruleOptimization?.rulesToRemove || 0}
                            </div>
                            <div className="text-sm text-slate-600">Rules to Remove</div>
                          </div>
                          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            <div className="text-2xl font-bold text-yellow-600">
                              {result.aiAnalysis?.ruleOptimization?.rulesToModify || 0}
                            </div>
                            <div className="text-sm text-slate-600">Rules to Modify</div>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="text-2xl font-bold text-blue-600">
                              {result.aiAnalysis?.ruleOptimization?.rulesToConsolidate || 0}
                            </div>
                            <div className="text-sm text-slate-600">Rules to Consolidate</div>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <div className="text-2xl font-bold text-green-600">
                              {result.aiAnalysis?.ruleOptimization?.complexityReduction || 0}%
                            </div>
                            <div className="text-sm text-slate-600">Complexity Reduction</div>
                          </div>
                        </div>
                        
                        {result.aiAnalysis?.ruleOptimization?.optimizationActions && (
                          <div className="space-y-3">
                            {result.aiAnalysis?.ruleOptimization?.optimizationActions?.map((action, idx) => (
                              <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                                action.action === 'remove' ? 'border-red-500 bg-red-50' :
                                action.action === 'modify' ? 'border-yellow-500 bg-yellow-50' :
                                action.action === 'consolidate' ? 'border-blue-500 bg-blue-50' :
                                'border-green-500 bg-green-50'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-semibold text-slate-800">
                                    {action.action.charAt(0).toUpperCase() + action.action.slice(1)}: {action.ruleName}
                                  </h6>
                                  <Badge className={`${
                                    action.impact === 'High' ? 'bg-red-100 text-red-800' :
                                    action.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {action.impact} Impact
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-700 mb-2">{action.reason}</p>
                                <p className="text-sm text-slate-600 mb-2">{action.recommendation}</p>
                                
                                {action.affectedRules && (
                                  <div className="text-xs text-slate-500">
                                    Affected rules: {action.affectedRules.join(', ')}
                                  </div>
                                )}
                                
                                {action.estimatedSavings && (
                                  <div className="text-sm text-green-600 font-medium mt-2">
                                    💰 {action.estimatedSavings}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredResults.length === 0 && validationResults.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No Validation Results</h3>
            <p className="text-slate-500">Select your Azure resources and click "Validate NSG" to get started.</p>
          </div>
        )}

        {/* No Results After Search */}
        {filteredResults.length === 0 && validationResults.length > 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No Results Found</h3>
            <p className="text-slate-500">Try adjusting your search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NSGValidationEnhancedPage;