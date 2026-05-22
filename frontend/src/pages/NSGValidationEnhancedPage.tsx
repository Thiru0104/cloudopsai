import React, { useState, useEffect } from 'react';
import { exportToPDF } from '../utils/exportUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
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
  ArrowUp,
  Combine
} from 'lucide-react';
import { buildApiUrl, apiClient } from '../config/api';


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
  rules?: any[];
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
  const [isExporting, setIsExporting] = useState(false);

  // Offline mode state
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineFile, setOfflineFile] = useState<File | null>(null);

  // Export state
  const [reportLimit, setReportLimit] = useState<string>('15');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setOfflineFile(e.target.files[0]);
    }
  };

  const validateOfflineNSG = async () => {
    if (!offlineFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('file', offlineFile);
      
      const response = await fetch(buildApiUrl('/api/v1/nsg-validation/offline'), {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to validate offline NSG');
      }
      
      const result = await response.json();
      
      // Add metadata
      result.subscription = 'Offline';
      result.resourceGroup = 'Offline';
      result.location = 'Offline';
      
      setValidationResults(prev => {
        // Remove existing result with same name if exists
        const filtered = prev.filter(r => r.nsgName !== result.nsgName);
        return [...filtered, result];
      });

      // Automatically show AI analysis for offline mode since it's generated on upload
      setShowAIAnalysis(prev => ({ ...prev, [result.nsgName]: true }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };


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
      const response = await fetch(buildApiUrl('/api/v1/subscriptions'));
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
      const data = await apiClient.get('/api/v1/resource-groups', { subscription_id: subscriptionId });
      setResourceGroups(data.resource_groups || []);
    } catch (err: any) {
      console.error('Failed to load resource groups:', err);
      setError(err.message || 'Failed to load resource groups');
    } finally {
      setLoadingResourceGroups(false);
    }
  };

  const loadLocations = async (subscriptionId: string) => {
    try {
      setLoadingLocations(true);
      const data = await apiClient.get('/api/v1/locations', { subscription_id: subscriptionId });
      setLocations(data.locations || []);
    } catch (err: any) {
      console.error('Failed to load locations:', err);
      setError(err.message || 'Failed to load locations');
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadNSGs = async (subscriptionId: string, resourceGroup: string, location?: string) => {
    try {
      setLoadingNSGs(true);
      const params: Record<string, string> = { subscription_id: subscriptionId };
      if (resourceGroup) params.resource_group = resourceGroup;
      if (location) params.region = location;
      
      const data = await apiClient.get('/api/v1/nsgs', params);
      setNSGs(data.nsgs || []);
    } catch (err: any) {
      console.error('Failed to load NSGs:', err);
      setError(err.message || 'Failed to load NSGs');
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
        buildApiUrl(`/api/v1/nsg-validation/${encodeURIComponent(selectedNSG)}?subscription_id=${encodeURIComponent(selectedSubscription)}&resource_group=${encodeURIComponent(selectedResourceGroup)}`)
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
    // If offline mode, the analysis is already generated during upload
    // Just ensure it's visible and return, avoiding the API call that requires Azure params
    if (isOfflineMode) {
      setShowAIAnalysis(prev => ({ ...prev, [nsgName]: true }));
      return;
    }

    try {
      setAnalyzing(true);
      
      // Validate required parameters
      if (!selectedSubscription || !selectedResourceGroup || !nsgName) {
        throw new Error('Missing required parameters: subscription, resource group, or NSG name');
      }
      
      const response = await fetch(
        buildApiUrl(`/api/v1/nsg-recommendations/${encodeURIComponent(nsgName)}?subscription_id=${encodeURIComponent(selectedSubscription)}&resource_group=${encodeURIComponent(selectedResourceGroup)}`),
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
  const handlePDFExport = async (result: NSGValidationResult) => {
    if (!result.aiAnalysis) {
      setError('AI Analysis data is required for PDF export. Please run AI Analysis first.');
      return;
    }

    setIsExporting(true);
    // Yield to the event loop so the UI can update the button state to show loading
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Extract NSG rules from backend response or fallback to IP inventory details
      let extractedRules: any[] = [];
      if (result.rules && result.rules.length > 0) {
        // Map snake_case to camelCase
        extractedRules = result.rules.map((r: any) => ({
          name: r.name,
          priority: r.priority,
          direction: r.direction,
          access: r.access,
          protocol: r.protocol,
          sourcePortRange: r.source_port_range,
          destinationPortRange: r.destination_port_range,
          sourceAddressPrefix: r.source_address_prefix,
          destinationAddressPrefix: r.destination_address_prefix
        }));
      } else if (result.aiAnalysis.ipInventory?.ipDetails) {
        const ruleMap = new Map();
        result.aiAnalysis.ipInventory.ipDetails.forEach((detail: any) => {
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
        asgCount: result.aiAnalysis.asgCount || result.asgCount || 0,
        isWithinLimits: result.aiAnalysis.isWithinLimits !== false,
        duplicateIps: result.aiAnalysis.duplicateIps || [],
        cidrOverlaps: result.aiAnalysis.cidrOverlaps || [],
        consolidationOpportunities: result.aiAnalysis.consolidationOpportunities || [],
        inboundStats: { 
          sourceIpsAsgs: result.inboundSourceIpCount || 0, 
          destIpsAsgs: result.inboundDestinationIpCount || 0, 
          sourceAsgs: result.inboundSourceAsgCount || 0, 
          destAsgs: result.inboundDestinationAsgCount || 0 
        },
        outboundStats: { 
          sourceIpsAsgs: result.outboundSourceIpCount || 0, 
          destIpsAsgs: result.outboundDestinationIpCount || 0, 
          sourceAsgs: result.outboundSourceAsgCount || 0, 
          destAsgs: result.outboundDestinationAsgCount || 0 
        },
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
        inboundRules: result.inboundRules,
        outboundRules: result.outboundRules,
        violations: result.violations || [],
        recommendations: result.llmRecommendations || [],
        aiAnalysis: aiAnalysis,
        rules: extractedRules
      };
      
      exportToPDF(exportData, reportLimit === 'all' ? 99999 : parseInt(reportLimit, 10));
    } catch (error) {
      console.error('PDF Export Error:', error);
      setError('Failed to generate PDF report. Please try again.');
    } finally {
      setIsExporting(false);
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>Resource Selection</span>
                </CardTitle>
                <CardDescription>
                  {isOfflineMode 
                    ? "Upload an NSG rules file (Excel/CSV) to validate" 
                    : "Choose your subscription, resource group, location, and NSG to validate"}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="offline-mode" 
                  checked={isOfflineMode} 
                  onCheckedChange={setIsOfflineMode} 
                />
                <Label htmlFor="offline-mode">Offline Mode</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOfflineMode ? (
               <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Upload NSG Rules File</Label>
                    <Input 
                      id="file-upload" 
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleFileChange} 
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-slate-500">
                      Supported formats: Excel (.xlsx, .xls) or CSV. Columns required: Name, Priority, Direction, Access, Protocol, SourceAddressPrefix, SourcePortRange, DestinationAddressPrefix, DestinationPortRange.
                    </p>
                  </div>
               </div>
            ) : (
              <>
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
              </>
            )}

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
                  onClick={isOfflineMode ? validateOfflineNSG : validateNSG}
                  disabled={loading || (isOfflineMode ? !offlineFile : !canValidate)}
                  className="btn-secondary"
                >
                  <Shield className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {isOfflineMode ? "Validate Offline File" : "Validate NSG"}
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
                      {result.aiAnalysis && (
                        <div className="flex items-center space-x-2 mr-2">
                          <Label htmlFor={`report-limit-${result.nsgName}`} className="text-xs text-slate-500 whitespace-nowrap">Report Top Items:</Label>
                          <Select value={reportLimit} onValueChange={setReportLimit}>
                            <SelectTrigger id={`report-limit-${result.nsgName}`} className="h-8 w-24 text-xs">
                              <SelectValue placeholder="Limit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">Top 10</SelectItem>
                              <SelectItem value="15">Top 15</SelectItem>
                              <SelectItem value="20">Top 20</SelectItem>
                              <SelectItem value="30">Top 30</SelectItem>
                              <SelectItem value="all">All Items</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
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
                        disabled={!result.aiAnalysis || isExporting}
                        className="btn-outline"
                        title="Export comprehensive PDF report"
                      >
                        {isExporting ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Export PDF
                          </>
                        )}
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

                {/* Consolidation Opportunities */}
                {result.aiAnalysis?.consolidationOpportunities && result.aiAnalysis.consolidationOpportunities.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                      <GitMerge className="w-5 h-5 mr-2 text-indigo-500" />
                      Consolidation Opportunities
                    </h4>
                    <div className="space-y-4">
                      {result.aiAnalysis.consolidationOpportunities.slice(0, reportLimit === 'all' ? 99999 : parseInt(reportLimit, 10)).map((opp, idx) => (
                        <div key={idx} className="p-4 rounded-lg border bg-indigo-50 border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-slate-800 capitalize">{opp.type?.replace(/_/g, ' ') || 'Opportunity'}</h5>
                            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                              {opp.priority} Priority
                            </Badge>
                          </div>
                          <p className="text-slate-700 mb-3">{opp.description}</p>
                          
                          <div className="bg-white p-3 rounded border border-indigo-100 mb-3">
                            <p className="text-sm font-medium text-slate-900 mb-1">Recommendation:</p>
                            <p className="text-sm text-slate-600">{opp.recommendation}</p>
                          </div>

                          <div className="flex gap-4 text-sm text-slate-600 mb-3">
                            {opp.potentialSavings?.ruleReduction && (
                              <span className="flex items-center bg-white px-2 py-1 rounded border border-indigo-100">
                                <ArrowDown className="w-4 h-4 mr-1 text-green-500" />
                                Reduce {opp.potentialSavings.ruleReduction} rules
                              </span>
                            )}
                            {opp.potentialSavings?.managementComplexity && (
                              <span className="flex items-center bg-white px-2 py-1 rounded border border-indigo-100">
                                <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                                Complexity: {opp.potentialSavings.managementComplexity}
                              </span>
                            )}
                          </div>

                          <div className="text-sm border-t border-indigo-200 pt-2 mt-2">
                            <span className="font-medium text-slate-700">Affected Rules: </span>
                            <span className="text-slate-600">
                              {opp.rules?.map(r => r.name).join(', ') || 'None'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CIDR Overlaps */}
                {result.aiAnalysis?.cidrOverlaps && result.aiAnalysis.cidrOverlaps.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                      <Network className="w-5 h-5 mr-2 text-pink-500" />
                      CIDR Overlaps
                    </h4>
                    <div className="space-y-4">
                      {result.aiAnalysis.cidrOverlaps.slice(0, reportLimit === 'all' ? 99999 : parseInt(reportLimit, 10)).map((overlap, idx) => (
                        <div key={idx} className="p-4 rounded-lg border bg-pink-50 border-pink-200">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-slate-800 flex items-center">
                              {overlap.overlapType?.replace(/_/g, ' ') || 'Overlap'}
                            </h5>
                            <Badge className="bg-pink-100 text-pink-800 border-pink-200">
                              {overlap.severity} Severity
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div className="bg-white p-2 rounded border border-pink-100">
                              <p className="text-xs font-medium text-slate-500 uppercase">Network 1</p>
                              <p className="font-mono text-sm">{overlap.network1?.cidr || 'N/A'}</p>
                              <p className="text-xs text-slate-600">Rule: {overlap.network1?.ruleName || 'Unknown'}</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-pink-100">
                              <p className="text-xs font-medium text-slate-500 uppercase">Network 2</p>
                              <p className="font-mono text-sm">{overlap.network2?.cidr || 'N/A'}</p>
                              <p className="text-xs text-slate-600">Rule: {overlap.network2?.ruleName || 'Unknown'}</p>
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 bg-white p-3 rounded border border-pink-100">
                            <span className="font-medium">Recommendation: </span>
                            {overlap.recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Redundant Rules */}
                {result.aiAnalysis?.redundantRules && result.aiAnalysis.redundantRules.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                      <Copy className="w-5 h-5 mr-2 text-orange-500" />
                      Redundant Rules
                    </h4>
                    <div className="space-y-4">
                       {result.aiAnalysis.redundantRules.map((redundant, idx) => (
                         <div key={idx} className="p-4 rounded-lg border bg-orange-50 border-orange-200">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-slate-800 flex items-center">
                              {redundant.redundancyType?.replace(/_/g, ' ') || 'Redundancy'}
                            </h5>
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                              {redundant.severity} Severity
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div className="bg-white p-2 rounded border border-orange-100">
                              <p className="text-xs font-medium text-slate-500 uppercase">Rule 1 (Shadowed)</p>
                              <p className="font-medium text-sm">{redundant.rule1?.name || 'Unknown'}</p>
                              <p className="text-xs text-slate-600">Priority: {redundant.rule1?.priority || 'N/A'}</p>
                            </div>
                            <div className="bg-white p-2 rounded border border-orange-100">
                              <p className="text-xs font-medium text-slate-500 uppercase">Rule 2 (Shadowing)</p>
                              <p className="font-medium text-sm">{redundant.rule2?.name || 'Unknown'}</p>
                              <p className="text-xs text-slate-600">Priority: {redundant.rule2?.priority || 'N/A'}</p>
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 bg-white p-3 rounded border border-orange-100">
                            <span className="font-medium">Recommendation: </span>
                            {redundant.recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rule Optimization */}
                {result.aiAnalysis?.ruleOptimization && (result.aiAnalysis.ruleOptimization.removableRules.length > 0 || result.aiAnalysis.ruleOptimization.optimizationSuggestions.length > 0) && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                      Rule Optimization
                    </h4>
                    
                    {/* Removable Rules */}
                    {result.aiAnalysis.ruleOptimization.removableRules.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Candidates for Removal</h5>
                        <div className="grid gap-3">
                          {result.aiAnalysis.ruleOptimization.removableRules.map((rule, idx) => (
                            <div key={idx} className="p-3 rounded border bg-yellow-50 border-yellow-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-slate-800">{rule.ruleName} (Priority: {rule.priority})</p>
                                  <div className="flex gap-2 mt-1">
                                    <Badge variant="outline" className="bg-white text-xs">{rule.direction}</Badge>
                                    <Badge variant="outline" className="bg-white text-xs">{rule.access}</Badge>
                                  </div>
                                </div>
                                <Badge className={rule.riskLevel === 'Low' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                  {rule.riskLevel} Risk
                                </Badge>
                              </div>
                              <div className="mt-2 space-y-1">
                                {rule.removalReasons.map((reason, rIdx) => (
                                  <p key={rIdx} className="text-sm text-slate-600 flex items-start">
                                    <span className="mr-2">•</span>
                                    {reason.description}
                                  </p>
                                ))}
                              </div>
                              <p className="mt-2 text-sm font-medium text-slate-700 bg-white p-2 rounded border border-yellow-100">
                                Recommendation: {rule.recommendation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Optimization Suggestions */}
                    {result.aiAnalysis.ruleOptimization.optimizationSuggestions.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h5 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Optimization Suggestions</h5>
                        <div className="grid gap-3">
                          {result.aiAnalysis.ruleOptimization.optimizationSuggestions.map((sugg, idx) => (
                            <div key={idx} className="p-3 rounded border bg-blue-50 border-blue-200">
                              <div className="flex justify-between items-start mb-2">
                                <h6 className="font-medium text-slate-800">{sugg.title}</h6>
                                <Badge className="bg-blue-100 text-blue-800">{sugg.priority}</Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{sugg.description}</p>
                              {sugg.gaps && (
                                <div className="text-xs text-slate-500">
                                  Identified gaps: {sugg.gaps.map(g => `${g.start}-${g.end} (Size: ${g.size})`).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI proposed actionable recommendation */}
                {result.llmRecommendations && result.llmRecommendations.filter((rec) => rec?.type !== 'REDUNDANT_RULE' && !String(rec?.title || '').toLowerCase().includes('redundant')).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                        <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
                        AI proposed actionable recommendation
                      </h4>
                    </div>
                    <div className="space-y-4">
                      {result.llmRecommendations
                        .filter((rec) => rec?.type !== 'REDUNDANT_RULE' && !String(rec?.title || '').toLowerCase().includes('redundant'))
                        .map((rec) => (
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

                          {/* Proposed Rules Table */}
                          {rec.proposedRules && rec.proposedRules.length > 0 && (
                            <div className="mt-4">
                              <h6 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                                <Settings className="w-4 h-4 mr-1 text-blue-500" />
                                Recommended Rule Configuration
                              </h6>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                                  <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                      <th className="px-3 py-2 border-b">NSG Name</th>
                                      <th className="px-3 py-2 border-b">Rule Name</th>
                                      <th className="px-3 py-2 border-b">Direction</th>
                                      <th className="px-3 py-2 border-b">Priority</th>
                                      <th className="px-3 py-2 border-b">Access</th>
                                      <th className="px-3 py-2 border-b">Protocol</th>
                                      <th className="px-3 py-2 border-b">Source Port</th>
                                      <th className="px-3 py-2 border-b">Dest Port</th>
                                      <th className="px-3 py-2 border-b">Source Address</th>
                                      <th className="px-3 py-2 border-b">Dest Address</th>
                                      <th className="px-3 py-2 border-b">Source ASG</th>
                                      <th className="px-3 py-2 border-b">Dest ASG</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-slate-100">
                                    {rec.proposedRules.map((rule, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-3 py-2">{rule.nsgName || '-'}</td>
                                        <td className="px-3 py-2 font-medium text-blue-600">{rule.ruleName || '-'}</td>
                                        <td className="px-3 py-2">
                                          <Badge className={`text-[10px] px-1 py-0 ${rule.direction === 'Inbound' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'}`}>
                                            {rule.direction || '-'}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-2">{rule.priority || '-'}</td>
                                        <td className="px-3 py-2">
                                          <Badge className={`text-[10px] px-1 py-0 ${rule.access === 'Allow' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {rule.access || '-'}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-2">{rule.protocol || '-'}</td>
                                        <td className="px-3 py-2 font-mono">{rule.sourcePort || '-'}</td>
                                        <td className="px-3 py-2 font-mono">{rule.destinationPort || '-'}</td>
                                        <td className="px-3 py-2 font-mono">{rule.sourceAddress || '-'}</td>
                                        <td className="px-3 py-2 font-mono">{rule.destinationAddress || '-'}</td>
                                        <td className="px-3 py-2">{rule.sourceAsg || '-'}</td>
                                        <td className="px-3 py-2">{rule.destinationAsg || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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

                    {/* We only want Rule Optimization, Consolidation, Security Risks, Redundant Rules, and AI Actionable Recommendations */}

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
                          {Array.from(
                            new Map(
                              (result.aiAnalysis?.cidrOverlaps || []).map((overlap: any) => {
                                const key = [
                                  overlap?.network1?.ruleId,
                                  overlap?.network1?.cidr,
                                  overlap?.network2?.ruleId,
                                  overlap?.network2?.cidr
                                ].join('|');
                                return [key, overlap];
                              })
                            ).values()
                          ).map((overlap, idx) => (
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

                              {/* Proposed Rules Table */}
                              {overlap.proposedRules && overlap.proposedRules.length > 0 && (
                                <div className="mt-4">
                                  <h6 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                                    <Settings className="w-4 h-4 mr-1 text-blue-500" />
                                    Recommended Rule Configuration
                                  </h6>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                                      <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                          <th className="px-3 py-2 border-b">NSG Name</th>
                                          <th className="px-3 py-2 border-b">Rule Name</th>
                                          <th className="px-3 py-2 border-b">Direction</th>
                                          <th className="px-3 py-2 border-b">Priority</th>
                                          <th className="px-3 py-2 border-b">Access</th>
                                          <th className="px-3 py-2 border-b">Protocol</th>
                                          <th className="px-3 py-2 border-b">Source Port</th>
                                          <th className="px-3 py-2 border-b">Dest Port</th>
                                          <th className="px-3 py-2 border-b">Source Address</th>
                                          <th className="px-3 py-2 border-b">Dest Address</th>
                                          <th className="px-3 py-2 border-b">Source ASG</th>
                                          <th className="px-3 py-2 border-b">Dest ASG</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-slate-100">
                                        {overlap.proposedRules.map((rule: any, pIdx: number) => (
                                          <tr key={pIdx} className="hover:bg-slate-50">
                                            <td className="px-3 py-2">{rule.nsgName || '-'}</td>
                                            <td className="px-3 py-2 font-medium text-blue-600">{rule.ruleName || '-'}</td>
                                            <td className="px-3 py-2">{rule.direction || '-'}</td>
                                            <td className="px-3 py-2">{rule.priority || '-'}</td>
                                            <td className="px-3 py-2">{rule.access || '-'}</td>
                                            <td className="px-3 py-2">{rule.protocol || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.sourcePort || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.destinationPort || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.sourceAddress || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.destinationAddress || '-'}</td>
                                            <td className="px-3 py-2">{rule.sourceAsg || '-'}</td>
                                            <td className="px-3 py-2">{rule.destinationAsg || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Duplicate IPs */}
                    {result.aiAnalysis?.duplicateIps && result.aiAnalysis.duplicateIps.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                          <Copy className="w-5 h-5 mr-2 text-orange-500" />
                          Duplicate IPs / Redundancy
                        </h4>
                        <div className="space-y-4">
                        {result.aiAnalysis.duplicateIps.slice(0, reportLimit === 'all' ? 99999 : parseInt(reportLimit, 10)).map((dup, idx) => (
                          <div key={idx} className="p-4 rounded-lg border bg-orange-50 border-orange-200">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-semibold text-slate-800">{dup.ipAddress}</h5>
                                <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                                  Used {dup.usageCount} times
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{dup.recommendation}</p>
                              <div className="text-sm border-t border-orange-200 pt-2 mt-2">
                                <span className="font-medium text-slate-700">Found in rules: </span>
                                <span className="text-slate-600">
                                  {dup.rules.map((r: any) => r.ruleName).join(', ')}
                                </span>
                              </div>
                              
                              {/* Proposed Rules Table */}
                              {dup.proposedRules && dup.proposedRules.length > 0 && (
                                <div className="mt-4">
                                  <h6 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                                    <Settings className="w-4 h-4 mr-1 text-blue-500" />
                                    Recommended Rule Configuration
                                  </h6>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                                      <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                          <th className="px-3 py-2 border-b">NSG Name</th>
                                          <th className="px-3 py-2 border-b">Rule Name</th>
                                          <th className="px-3 py-2 border-b">Direction</th>
                                          <th className="px-3 py-2 border-b">Priority</th>
                                          <th className="px-3 py-2 border-b">Access</th>
                                          <th className="px-3 py-2 border-b">Protocol</th>
                                          <th className="px-3 py-2 border-b">Source Port</th>
                                          <th className="px-3 py-2 border-b">Dest Port</th>
                                          <th className="px-3 py-2 border-b">Source Address</th>
                                          <th className="px-3 py-2 border-b">Dest Address</th>
                                          <th className="px-3 py-2 border-b">Source ASG</th>
                                          <th className="px-3 py-2 border-b">Dest ASG</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-slate-100">
                                        {dup.proposedRules.map((rule: any, pIdx: number) => (
                                          <tr key={pIdx} className="hover:bg-slate-50">
                                            <td className="px-3 py-2">{rule.nsgName || '-'}</td>
                                            <td className="px-3 py-2 font-medium text-blue-600">{rule.ruleName || '-'}</td>
                                            <td className="px-3 py-2">{rule.direction || '-'}</td>
                                            <td className="px-3 py-2">{rule.priority || '-'}</td>
                                            <td className="px-3 py-2">{rule.access || '-'}</td>
                                            <td className="px-3 py-2">{rule.protocol || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.sourcePort || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.destinationPort || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.sourceAddress || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.destinationAddress || '-'}</td>
                                            <td className="px-3 py-2">{rule.sourceAsg || '-'}</td>
                                            <td className="px-3 py-2">{rule.destinationAsg || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Consolidation Opportunities */}
                    {result.aiAnalysis?.consolidationOpportunities && result.aiAnalysis.consolidationOpportunities.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <Combine className="w-5 h-5 mr-2 text-blue-500" />
                          Consolidation Opportunities ({result.aiAnalysis?.consolidationOpportunities?.length || 0})
                        </h5>
                        <div className="space-y-3">
                          {result.aiAnalysis?.consolidationOpportunities?.map((opp, idx) => (
                            <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <h6 className="font-semibold text-slate-800">
                                    {opp.type === 'similar_rules_consolidation' ? 'Rule Consolidation' : 
                                     opp.type === 'ip_consolidation' ? 'IP Consolidation' : 
                                     opp.type.replace(/_/g, ' ')}
                                  </h6>
                                  <Badge className={`${
                                    opp.priority === 'High' ? 'bg-red-100 text-red-800' :
                                    opp.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {opp.priority} Priority
                                  </Badge>
                                </div>
                                <Badge className="bg-green-100 text-green-800">
                                  Save {opp.potentialSavings?.ruleReduction || 0} Rules
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-700 font-medium mb-1">{opp.description}</p>
                              <p className="text-sm text-slate-600 mb-3">{opp.recommendation}</p>
                              
                              {opp.rules && opp.rules.length > 0 && (
                                <div className="bg-white p-3 rounded border border-blue-100">
                                  <div className="text-xs font-medium text-slate-500 uppercase mb-2">Affected Rules</div>
                                  <div className="flex flex-wrap gap-1">
                                    {opp.rules.map((rule, rIdx) => (
                                      <span key={rIdx} className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">
                                        {rule.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Proposed Rules Table */}
                              {opp.proposedRules && opp.proposedRules.length > 0 && (
                                <div className="mt-4">
                                  <h6 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
                                    <Settings className="w-4 h-4 mr-1 text-blue-500" />
                                    Recommended Rule Configuration
                                  </h6>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                                      <thead className="bg-slate-100 text-slate-700">
                                        <tr>
                                          <th className="px-3 py-2 border-b">NSG Name</th>
                                          <th className="px-3 py-2 border-b">Rule Name</th>
                                          <th className="px-3 py-2 border-b">Direction</th>
                                          <th className="px-3 py-2 border-b">Priority</th>
                                          <th className="px-3 py-2 border-b">Access</th>
                                          <th className="px-3 py-2 border-b">Protocol</th>
                                          <th className="px-3 py-2 border-b">Source Port</th>
                                          <th className="px-3 py-2 border-b">Dest Port</th>
                                          <th className="px-3 py-2 border-b">Source Address</th>
                                          <th className="px-3 py-2 border-b">Dest Address</th>
                                          <th className="px-3 py-2 border-b">Source ASG</th>
                                          <th className="px-3 py-2 border-b">Dest ASG</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-slate-100">
                                        {opp.proposedRules.map((rule: any, pIdx: number) => (
                                          <tr key={pIdx} className="hover:bg-slate-50">
                                            <td className="px-3 py-2">{rule.nsgName || '-'}</td>
                                            <td className="px-3 py-2 font-medium text-blue-600">{rule.ruleName || '-'}</td>
                                            <td className="px-3 py-2">{rule.direction || '-'}</td>
                                            <td className="px-3 py-2">{rule.priority || '-'}</td>
                                            <td className="px-3 py-2">{rule.access || '-'}</td>
                                            <td className="px-3 py-2">{rule.protocol || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.sourcePort || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.destinationPort || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.sourceAddress || '-'}</td>
                                            <td className="px-3 py-2 font-mono">{rule.destinationAddress || '-'}</td>
                                            <td className="px-3 py-2">{rule.sourceAsg || '-'}</td>
                                            <td className="px-3 py-2">{rule.destinationAsg || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Duplicate IPs */}
                    {result.aiAnalysis?.duplicateIps && result.aiAnalysis.duplicateIps.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="text-lg font-semibold text-slate-800 flex items-center">
                          <Copy className="w-5 h-5 mr-2 text-purple-500" />
                          Duplicate IP Detection ({result.aiAnalysis?.duplicateIps?.length || 0})
                        </h5>
                        <div className="space-y-3">
                          {result.aiAnalysis?.duplicateIps?.map((dup, idx) => (
                            <div key={idx} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono bg-white px-2 py-1 rounded border border-purple-100 font-semibold text-purple-700">
                                    {dup.ipAddress}
                                  </span>
                                  <span className="text-sm text-slate-600">used in {dup.usageCount} rules</span>
                                </div>
                                <Badge className={`${
                                  dup.severity === 'High' ? 'bg-red-100 text-red-800' :
                                  dup.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {dup.severity} Severity
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mb-3">{dup.recommendation}</p>
                              
                              {dup.rules && dup.rules.length > 0 && (
                                <div className="bg-white p-3 rounded border border-purple-100">
                                  <div className="text-xs font-medium text-slate-500 uppercase mb-2">Used in Rules</div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {dup.rules.map((rule, rIdx) => (
                                      <div key={rIdx} className="text-xs border border-slate-100 p-2 rounded">
                                        <div className="font-medium text-slate-700">{rule.ruleName}</div>
                                        <div className="text-slate-500">{rule.direction} • {rule.location}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}



                    {/* Rule Optimization */}
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
