import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { RefreshCw, Info } from 'lucide-react';
import { apiClient, apiConfig } from '../config/api';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agentData: AgentFormData) => void;
  initialData?: Partial<AgentFormData>;
  isEditing?: boolean;
  agentId?: number;
}

interface AgentFormData {
  name: string;
  description: string;
  instructions: string;
  validationCriteria: string;
  remediationActions: string;
  aiModel: string;
  severity: string;
  resourceType: string;
  resourceId?: string;
  subscription: string;
  validationMode: boolean;
  automatedRemediation: boolean;
  selectedNSGs: string[];
  selectedRouteTables: string[];
}

interface Subscription {
  id: string;
  name: string;
  tenantId: string;
}

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  isEditing = false,
  agentId,
}) => {
  const getInitialFormData = () => ({
    name: initialData?.name || '',
    description: initialData?.description || '',
    instructions: initialData?.instructions || '',
    validationCriteria: initialData?.validationCriteria || '',
    remediationActions: initialData?.remediationActions || '',
    aiModel: initialData?.aiModel || 'gpt-4o',
    severity: initialData?.severity || 'Medium',
    resourceType: initialData?.resourceType || 'Network Security Group',
    resourceId: initialData?.resourceId || '',
    subscription: initialData?.subscription || '',
    resourceGroup: '',
    region: '',
    networkSecurityGroup: '',
    routeTable: '',
    validationMode: initialData?.validationMode ?? true,
    automatedRemediation: initialData?.automatedRemediation ?? false,
    selectedNSGs: initialData?.selectedNSGs || [],
    selectedRouteTables: initialData?.selectedRouteTables || []
  });

  const [formData, setFormData] = useState(getInitialFormData());

  const [azureResources, setAzureResources] = useState({
    subscriptions: [],
    resourceGroups: [],
    regions: [],
    nsgs: [],
    routeTables: []
  });

  const [loading, setLoading] = useState({
    subscriptions: false,
    resourceGroups: false,
    regions: false,
    nsgs: false,
    routeTables: false
  });

  const [showNSGModal, setShowNSGModal] = useState(false);

  // Load subscriptions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSubscriptions();
    }
  }, [isOpen]);

  // Reset form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData());
    }
  }, [isOpen, initialData]);

  // Fetch subscriptions from backend
  const fetchSubscriptions = async () => {
    setLoading(prev => ({ ...prev, subscriptions: true }));
    try {
      const data = await apiClient.get(apiConfig.endpoints.subscriptions);
      if (data && Array.isArray(data.subscriptions)) {
        // Map backend response to frontend interface
        const mappedSubscriptions = data.subscriptions.map((sub: any) => ({
          id: sub.id || '',
          name: sub.name || sub.display_name || 'Unknown',
          tenantId: sub.tenant_id || ''
        }));
        setAzureResources(prev => ({ ...prev, subscriptions: mappedSubscriptions }));
      } else {
        console.warn('Invalid subscriptions response:', data);
        setAzureResources(prev => ({ ...prev, subscriptions: [] }));
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setAzureResources(prev => ({ ...prev, subscriptions: [] }));
    } finally {
      setLoading(prev => ({ ...prev, subscriptions: false }));
    }
  };

  // Fetch resource groups when subscription changes
  const fetchResourceGroups = async (subscriptionId: string) => {
    if (!subscriptionId) return;
    setLoading(prev => ({ ...prev, resourceGroups: true }));
    try {
      const data = await apiClient.get(apiConfig.endpoints.resourceGroups, { subscription_id: subscriptionId });
      if (data.resource_groups) {
        setAzureResources(prev => ({ ...prev, resourceGroups: data.resource_groups }));
      }
    } catch (error) {
      console.error('Error fetching resource groups:', error);
    } finally {
      setLoading(prev => ({ ...prev, resourceGroups: false }));
    }
  };

  // Fetch regions when subscription changes
  const fetchRegions = async (subscriptionId: string) => {
    if (!subscriptionId) return;
    setLoading(prev => ({ ...prev, regions: true }));
    try {
      const data = await apiClient.get(apiConfig.endpoints.locations, { subscription_id: subscriptionId });
      if (data.locations) {
        setAzureResources(prev => ({ ...prev, regions: data.locations }));
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
    } finally {
      setLoading(prev => ({ ...prev, regions: false }));
    }
  };

  // Fetch NSGs when subscription, resource group, or region change
  const fetchNSGs = async (subscriptionId: string, resourceGroup?: string, region?: string) => {
    if (!subscriptionId) return;
    setLoading(prev => ({ ...prev, nsgs: true }));
    try {
      const params: Record<string, string> = { subscription_id: subscriptionId };
      if (resourceGroup) {
        params.resource_group = resourceGroup;
      }
      if (region) {
        params.region = region;
      }
      const data = await apiClient.get(apiConfig.endpoints.nsgs, params);
      // Handle both array response and object with nsgs property
      const nsgs = Array.isArray(data) ? data : (data.nsgs || []);
      setAzureResources(prev => ({ ...prev, nsgs: nsgs }));
    } catch (error) {
      console.error('Error fetching NSGs:', error);
    } finally {
      setLoading(prev => ({ ...prev, nsgs: false }));
    }
  };

  // Fetch Route Tables when subscription and resource group change
  const fetchRouteTables = async (subscriptionId: string, resourceGroup?: string) => {
    if (!subscriptionId) return;
    setLoading(prev => ({ ...prev, routeTables: true }));
    try {
      const params: Record<string, string> = { subscription_id: subscriptionId };
      if (resourceGroup) {
        params.resource_group = resourceGroup;
      }
      const data = await apiClient.get(apiConfig.endpoints.routeTables, params);
      const routeTables = data.route_tables || [];
      setAzureResources(prev => ({ ...prev, routeTables: routeTables }));
    } catch (error) {
      console.error('Error fetching Route Tables:', error);
      setAzureResources(prev => ({ ...prev, routeTables: [] }));
    } finally {
      setLoading(prev => ({ ...prev, routeTables: false }));
    }
  };

  const aiModels = [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'azure-openai-gpt4', label: 'Azure OpenAI GPT-4' },
  ];

  const severityOptions = [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' },
    { value: 'Critical', label: 'Critical' },
  ];

  const resourceTypes = [
    { value: 'Network Security Group', label: 'Network Security Group' },
    { value: 'Route Table', label: 'Route Table' },
    { value: 'Remediation', label: 'Remediation Agent' },
    { value: 'Compliance Checker', label: 'Compliance Checker' },
    { value: 'Security Auditor', label: 'Security Auditor' },
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Trigger dependent API calls when certain fields change
    if (field === 'subscription' && typeof value === 'string') {
      fetchResourceGroups(value);
      fetchRegions(value);
      fetchNSGs(value);
      fetchRouteTables(value);
      // Reset dependent fields
      setFormData(prev => ({
        ...prev,
        resourceGroup: '',
        region: '',
        networkSecurityGroup: '',
        routeTable: ''
      }));
    } else if (field === 'resourceGroup' && typeof value === 'string') {
      // Fetch all NSGs in the resource group (don't filter by region)
      fetchNSGs(formData.subscription, value);
      fetchRouteTables(formData.subscription, value);
      // Reset NSG and Route Table fields
      setFormData(prev => ({
        ...prev,
        networkSecurityGroup: '',
        routeTable: '',
        selectedNSGs: []
      }));
    } else if (field === 'region' && typeof value === 'string') {
      // Don't refetch NSGs when region changes - show all NSGs in resource group
      // Reset NSG field for consistency
      setFormData(prev => ({
        ...prev,
        networkSecurityGroup: '',
        selectedNSGs: []
      }));
    }
  };



  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.name || !formData.name.trim()) {
        alert('Agent name is required');
        return;
      }
      
      const agentData = {
         name: formData.name.trim(),
         description: formData.description || 'AI-powered security agent',
         agent_type: (() => {
           switch (formData.resourceType) {
             case 'Network Security Group':
               return 'nsg_analyzer';
             case 'Remediation':
               return 'remediation';
             case 'Compliance Checker':
               return 'compliance_checker';
             case 'Security Auditor':
               return 'security_auditor';
             default:
               return 'custom';
           }
         })(),
         ai_model: formData.aiModel || 'gpt-4o',
         ai_model_config: {
           temperature: 0.3,
           max_tokens: 4000
         },
         configuration: {
           validation_mode: formData.validationMode,
           automated_remediation: formData.automatedRemediation,
           severity: formData.severity,
           resource_type: formData.resourceType,
           subscription_id: formData.subscription,
           resource_group: formData.resourceGroup,
           region: formData.region,
           selected_nsgs: formData.selectedNSGs,
           selected_route_tables: formData.selectedRouteTables
         },
         system_prompt: `You are an Azure ${formData.resourceType} security expert. Analyze and provide recommendations for security improvements.`,
         instructions: formData.instructions || `Analyze ${formData.resourceType} configurations and provide security recommendations.`,
         is_active: true
       };
      
      // Debug: Log the payload being sent
      console.log('🚀 Creating/Updating agent with payload:', JSON.stringify(agentData, null, 2));
      console.log('🔍 Form data:', formData);
      console.log('📡 API endpoint:', apiConfig.endpoints.agents);
      
      let result;

      if (isEditing && agentId) {
        // Call backend API to update agent
        console.log('📤 Sending update request to backend...');
        result = await apiClient.put(`${apiConfig.endpoints.agents}/${agentId}`, agentData);
        console.log('✅ Backend update response:', result);
      } else {
        // Call backend API to create agent
        console.log('📤 Sending create request to backend...');
        result = await apiClient.post(apiConfig.endpoints.agents, agentData);
        console.log('✅ Backend create response:', result);
      }
      
      // Backend returns the agent data directly on success
      if (result && result.id) {
        onSave(result);
        onClose();
        alert(isEditing ? 'Agent updated successfully!' : 'Agent created successfully!');
      } else {
        console.error('Failed to save agent: Invalid response format', result);
        alert('Failed to save agent: Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error saving agent:', error);
      
      // Enhanced error logging for 422 debugging
      if (error instanceof Error && error.message.includes('HTTP error! status:')) {
        const statusMatch = error.message.match(/status: (\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : null;
        
        console.error('📋 HTTP Error Status:', status);
        console.error('📋 Full Error:', error);
        
        if (status === 422) {
          // For 422 errors, we need to get more details from the fetch response
          console.error('🔍 422 Validation Error - checking response details');
          alert(`Validation Error (422): The request data doesn't match the expected format. Check console for details.`);
        } else if (status === 404) {
          alert(`Endpoint not found (404): ${error.message}`);
        } else {
          alert(`HTTP Error (${status}): ${error.message}`);
        }
      } else if (error.response) {
        console.error('📋 Error response status:', error.response.status);
        console.error('📋 Error response data:', error.response.data);
        
        if (error.response.status === 422) {
          console.error('🔍 422 Validation Error Details:', JSON.stringify(error.response.data, null, 2));
          alert(`Validation Error (422): ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
          alert(`Error creating agent (${error.response.status}): ${error.response.data?.detail || error.message}`);
        }
      } else {
        console.error('📋 Network or other error:', error.message);
        alert('Error creating agent: ' + error.message);
      }
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      description: '',
      instructions: '',
      validationCriteria: '',
      remediationActions: '',
      aiModel: 'gpt-4o',
      severity: 'Medium',
      resourceType: 'Network Security Group',
      resourceId: '',
      subscription: '',
      resourceGroup: '',
      region: '',
      networkSecurityGroup: '',
      routeTable: '',
      validationMode: true,
      automatedRemediation: false,
      selectedNSGs: [],
      selectedRouteTables: []
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit AI Agent' : 'Create New AI Agent'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Agent Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent Name</Label>
              <Input
                id="agentName"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter agent name"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aiModel">AI Model</Label>
              <Select
                value={formData.aiModel}
                onValueChange={(value) => handleInputChange('aiModel', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select AI Model" />
                </SelectTrigger>
                <SelectContent>
                  {aiModels.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Agent Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter a brief description of what this agent will do"
              className="w-full min-h-[80px]"
            />
          </div>

          {/* Agent Instructions and Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Agent Instructions & Configuration</h3>
            
            <div className="space-y-2">
              <Label htmlFor="instructions">Agent Instructions *</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => handleInputChange('instructions', e.target.value)}
                placeholder="Provide detailed instructions for what the agent should analyze and how it should behave. For example: 'Analyze Network Security Group rules for overly permissive access, identify rules allowing 0.0.0.0/0 source access on critical ports like 22, 3389, and 443.'"
                className="w-full min-h-[100px]"
              />
            </div>

            {formData.validationMode && (
              <div className="space-y-2">
                <Label htmlFor="validationCriteria">Validation Criteria</Label>
                <Textarea
                  id="validationCriteria"
                  value={formData.validationCriteria}
                  onChange={(e) => handleInputChange('validationCriteria', e.target.value)}
                  placeholder="Define specific criteria for validation. For example: 'Check for inbound rules with source 0.0.0.0/0, verify port ranges are not overly broad, ensure priority values follow security best practices.'"
                  className="w-full min-h-[80px]"
                />
              </div>
            )}

            {formData.automatedRemediation && (
              <div className="space-y-2">
                <Label htmlFor="remediationActions">Remediation Actions</Label>
                <Textarea
                  id="remediationActions"
                  value={formData.remediationActions}
                  onChange={(e) => handleInputChange('remediationActions', e.target.value)}
                  placeholder="Specify what actions should be taken when issues are found. For example: 'Replace 0.0.0.0/0 with specific IP ranges, modify overly broad port ranges, adjust rule priorities for better security posture.'"
                  className="w-full min-h-[80px]"
                />
              </div>
            )}
          </div>

          {/* Resource Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Resource Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value) => handleInputChange('severity', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resourceType">Resource-Type *</Label>
                <Select
                  value={formData.resourceType}
                  onValueChange={(value) => handleInputChange('resourceType', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select resource type" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resourceId">Resource ID (Optional)</Label>
              <Input
                id="resourceId"
                value={formData.resourceId}
                onChange={(e) => handleInputChange('resourceId', e.target.value)}
                placeholder="Enter resource ID"
                className="w-full"
              />
            </div>
          </div>

          {/* Azure Subscription Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Azure Subscription Configuration</h3>
            
            <div className="space-y-2">
              <Label htmlFor="subscription">Azure Subscription *</Label>
              <Select
                value={formData.subscription}
                onValueChange={(value) => handleInputChange('subscription', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loading.subscriptions ? "Loading..." : "Select subscription"} />
                </SelectTrigger>
                <SelectContent>
                  {azureResources.subscriptions.map((sub: any) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{sub.name}</span>
                        <span className="text-xs text-gray-500">{sub.id}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resourceGroup">Resource Group</Label>
                <Select value={formData.resourceGroup} onValueChange={(value) => handleInputChange('resourceGroup', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loading.resourceGroups ? "Loading..." : "Select resource group"} />
                  </SelectTrigger>
                  <SelectContent>
                    {azureResources.resourceGroups.map((rg: any) => (
                      <SelectItem key={rg.name} value={rg.name}>
                        {rg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select value={formData.region} onValueChange={(value) => handleInputChange('region', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loading.regions ? "Loading..." : "Select region"} />
                  </SelectTrigger>
                  <SelectContent>
                    {azureResources.regions.map((region: any) => (
                      <SelectItem key={region.name} value={region.name}>
                        {region.displayName || region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditional Resource Selection based on Resource Type */}
            {formData.resourceType === 'Network Security Group' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="networkSecurityGroup">Available Network Security Groups</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    onClick={() => {
                      // Refetch NSGs for the current resource group when modal opens
                      if (formData.subscription && formData.resourceGroup) {
                        fetchNSGs(formData.subscription, formData.resourceGroup);
                      }
                      setShowNSGModal(true);
                    }}
                    disabled={loading.nsgs || !formData.resourceGroup}
                  >
                    {loading.nsgs ? (
                      "Loading NSGs..."
                    ) : !formData.resourceGroup ? (
                      "Select a resource group first"
                    ) : formData.selectedNSGs.length === 0 ? (
                      "Click to select NSGs"
                    ) : (
                      `${formData.selectedNSGs.length} NSG(s) selected`
                    )}
                  </Button>
                </div>
                
                {/* Selected NSGs Display */}
                {formData.selectedNSGs.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Network Security Groups ({formData.selectedNSGs.length})</Label>
                    <div className="border rounded-lg p-3 bg-gray-50 max-h-32 overflow-y-auto">
                      {formData.selectedNSGs.map((nsgName) => {
                        const nsg = azureResources.nsgs.find((n: any) => n.name === nsgName);
                        return (
                          <div key={nsgName} className="flex items-center justify-between py-1 px-2 bg-white rounded border mb-1 last:mb-0">
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{nsgName}</span>
                              <span className="text-xs text-gray-500">{nsg?.resource_group}</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updatedNSGs = formData.selectedNSGs.filter(name => name !== nsgName);
                                handleInputChange('selectedNSGs', updatedNSGs);
                              }}
                              className="text-red-600 hover:text-red-800 h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.resourceType === 'Route Table' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="routeTable">Available Route Tables</Label>
                  <Select onValueChange={(value) => {
                    if (value && !formData.selectedRouteTables.includes(value)) {
                      handleInputChange('selectedRouteTables', [...formData.selectedRouteTables, value]);
                    }
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={loading.routeTables ? "Loading..." : "Select Route Table to add"} />
                    </SelectTrigger>
                    <SelectContent>
                      {azureResources.routeTables
                        .filter((rt: any) => !formData.selectedRouteTables.includes(rt.name))
                        .map((rt: any) => (
                        <SelectItem key={rt.id} value={rt.name}>
                          <div className="flex flex-col">
                            <span className="font-medium">{rt.name}</span>
                            <span className="text-xs text-gray-500">{rt.resource_group}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Selected Route Tables Display */}
                {formData.selectedRouteTables.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Route Tables ({formData.selectedRouteTables.length})</Label>
                    <div className="border rounded-lg p-3 bg-gray-50 max-h-32 overflow-y-auto">
                      {formData.selectedRouteTables.map((rtName) => {
                        const rt = azureResources.routeTables.find((r: any) => r.name === rtName);
                        return (
                          <div key={rtName} className="flex items-center justify-between py-1 px-2 bg-white rounded border mb-1 last:mb-0">
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{rtName}</span>
                              <span className="text-xs text-gray-500">{rt?.resource_group}</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updatedRouteTables = formData.selectedRouteTables.filter(name => name !== rtName);
                                handleInputChange('selectedRouteTables', updatedRouteTables);
                              }}
                              className="text-red-600 hover:text-red-800 h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}



            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Azure credentials are configured via environment variables (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET) for security.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Execution Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Agent Execution Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="validationMode"
                      checked={formData.validationMode}
                      onChange={(e) => handleInputChange('validationMode', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out cursor-pointer ${
                        formData.validationMode ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      onClick={() => handleInputChange('validationMode', !formData.validationMode)}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          formData.validationMode ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="validationMode" className="font-medium cursor-pointer">
                      Enable Validation Mode (Recommended)
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="automatedRemediation"
                      checked={formData.automatedRemediation}
                      onChange={(e) => handleInputChange('automatedRemediation', e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out cursor-pointer ${
                        formData.automatedRemediation ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      onClick={() => handleInputChange('automatedRemediation', !formData.automatedRemediation)}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          formData.automatedRemediation ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="automatedRemediation" className="font-medium cursor-pointer">
                      Enable Automated Remediation Execution (Uses Azure SDK)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Detailed Information about Validation and Remediation */}
              <div className="space-y-4 mt-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-2">Validation Mode Details:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>AutoGen Framework:</strong> Uses multi-agent conversation for complex analysis and decision-making</li>
                        <li><strong>Azure SDK Integration:</strong> Fetches real-time resource configurations and metadata</li>
                        <li><strong>AI-Powered Analysis:</strong> Leverages selected AI model for intelligent pattern recognition</li>
                        <li><strong>Best Practice Validation:</strong> Compares configurations against security standards and compliance requirements</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium mb-2">Remediation Execution Methods:</p>
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium">🔧 Azure SDK (Direct API Calls):</p>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Used for: Simple, well-defined configuration changes</li>
                            <li>Examples: Adding/removing NSG rules, updating route table entries</li>
                            <li>Benefits: Fast execution, direct resource manipulation</li>
                            <li>Limitations: Requires predefined remediation scripts</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium">🤖 AutoGen Multi-Agent Framework:</p>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Used for: Complex scenarios requiring analysis and planning</li>
                            <li>Examples: Multi-step security policy updates, compliance alignment</li>
                            <li>Benefits: Intelligent decision-making, adaptive remediation strategies</li>
                            <li>Process: Agent collaboration → Plan generation → Execution approval → Implementation</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-2">Execution Flow:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li><strong>Discovery:</strong> Agent scans Azure resources using SDK</li>
                        <li><strong>Analysis:</strong> AI model evaluates configurations against your criteria</li>
                        <li><strong>Validation:</strong> AutoGen agents discuss findings and recommendations</li>
                        <li><strong>Planning:</strong> Generate remediation plan with risk assessment</li>
                        <li><strong>Execution:</strong> Apply changes via SDK (if automated) or provide manual instructions</li>
                        <li><strong>Verification:</strong> Confirm changes and validate security posture improvement</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!formData.name || !formData.instructions}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Create Agent
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* NSG Selection Modal */}
      <Dialog open={showNSGModal} onOpenChange={setShowNSGModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select Network Security Groups</DialogTitle>
            <p className="text-sm text-gray-600">
              Choose NSGs from resource group: {formData.resourceGroup}
            </p>
          </DialogHeader>
          
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto border rounded-lg p-4 space-y-2 max-h-96">
              {loading.nsgs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading NSGs...</div>
                </div>
              ) : azureResources.nsgs.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">No NSGs found in this resource group</div>
                </div>
              ) : (
                azureResources.nsgs.map((nsg: any) => (
                  <div key={nsg.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={`nsg-${nsg.id}`}
                      checked={formData.selectedNSGs.includes(nsg.name)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        const updatedNSGs = isChecked
                          ? [...formData.selectedNSGs, nsg.name]
                          : formData.selectedNSGs.filter(name => name !== nsg.name);
                        handleInputChange('selectedNSGs', updatedNSGs);
                      }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`nsg-${nsg.id}`} className="flex-1 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{nsg.name}</span>
                        <div className="text-sm text-gray-500">
                          <span>Region: {nsg.region || 'N/A'}</span>
                          <span className="mx-2">•</span>
                          <span>Rules: {(nsg.inbound_rules?.length || 0) + (nsg.outbound_rules?.length || 0)}</span>
                        </div>
                      </div>
                    </label>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-600">
                {formData.selectedNSGs.length} of {azureResources.nsgs.length} NSGs selected
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleInputChange('selectedNSGs', []);
                  }}
                >
                  Clear All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const allNSGNames = azureResources.nsgs.map((nsg: any) => nsg.name);
                    handleInputChange('selectedNSGs', allNSGNames);
                  }}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowNSGModal(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default CreateAgentModal;