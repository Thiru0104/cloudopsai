import React, { useState, useEffect } from 'react';
import { Plus, Play, Square, Trash2, Eye, Edit, Settings, Bot, Activity, Clock, CheckCircle, AlertTriangle, RefreshCw, Shield, Wrench, Search, FileCheck, History } from 'lucide-react';
import FilterComponent from '../components/FilterComponent';
import CreateAgentModal from '../components/CreateAgentModal';
import NSGSelectionModal from '../components/NSGSelectionModal';
import ExecutionHistoryModal from '../components/ExecutionHistoryModal';
import { apiClient, apiConfig } from '../config/api';

interface Agent {
  id: number;
  name: string;
  description: string;
  agent_type: string;
  ai_model: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_execution?: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  average_execution_time: number;
  configuration?: {
    validation_mode?: string;
    automated_remediation?: boolean;
    severity?: string;
    resource_type?: string;
    subscription_id?: string;
    resource_group?: string;
    region?: string;
    selected_nsgs?: string[];
    selected_route_tables?: string[];
  };
  system_prompt?: string;
  instructions?: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  max_tokens: number;
  cost_per_1k_tokens: number;
  is_available: boolean;
}

const AgentsPage: React.FC = () => {
  const [filters, setFilters] = useState<{
    selectedSubscription: string;
    selectedResourceGroup: string;
    selectedLocation: string;
    selectedNSG: string;
    selectedNSGs: string[];
  }>({
    selectedSubscription: '',
    selectedResourceGroup: '',
    selectedLocation: '',
    selectedNSG: '',
    selectedNSGs: []
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isNSGSelectionModalOpen, setIsNSGSelectionModalOpen] = useState(false);
  const [selectedAgentForNSG, setSelectedAgentForNSG] = useState<number | null>(null);
  const [isExecutionHistoryModalOpen, setIsExecutionHistoryModalOpen] = useState(false);
  const [selectedAgentForHistory, setSelectedAgentForHistory] = useState<number | null>(null);

  // Fetch agents from backend
  const fetchAgents = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(apiConfig.endpoints.agents);
      if (Array.isArray(data)) {
        setAgents(data);
      } else {
        console.warn('Invalid agents response:', data);
        setAgents([]);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const data = await apiClient.get(`${apiConfig.endpoints.agents}/models`);
      if (data && data.models) {
        const mappedModels: AIModel[] = data.models.map((m: any) => ({
          id: m.name,
          name: m.display_name || m.name,
          provider: m.provider,
          description: m.description,
          max_tokens: m.max_tokens,
          cost_per_1k_tokens: m.cost_per_1k_tokens,
          is_available: true
        }));
        setAvailableModels(mappedModels);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      // Fallback to mock models
      setAvailableModels([
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          provider: 'OpenAI',
          description: 'Most advanced GPT-4 model with multimodal capabilities',
          max_tokens: 128000,
          cost_per_1k_tokens: 0.005,
          is_available: true
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'OpenAI',
          description: 'Latest GPT-4 model with improved performance and lower costs',
          max_tokens: 128000,
          cost_per_1k_tokens: 0.01,
          is_available: true
        }
      ]);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchModels();
  }, []);

  const handleFilterChange = (newFilters: {
    selectedSubscription: string;
    selectedResourceGroup: string;
    selectedLocation: string;
    selectedNSG: string;
    selectedNSGs?: string[];
  }) => {
    setFilters({
      ...newFilters,
      selectedNSGs: newFilters.selectedNSGs || []
    });
    console.log('Filters changed:', newFilters);
  };

  const handleStartAgent = async (agentId: number) => {
    try {
      console.log('Starting agent:', agentId);
      // Optimistic update
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, status: 'running' } : agent
      ));
      
      await apiClient.post(`${apiConfig.endpoints.agents}/${agentId}/start`);
    } catch (error) {
      console.error('Error starting agent:', error);
      alert('Failed to start agent');
      // Revert status on error
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, status: 'idle' } : agent
      ));
    }
  };

  const handleStopAgent = async (agentId: number) => {
    try {
      console.log('Stopping agent:', agentId);
      // Optimistic update
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, status: 'stopped' } : agent
      ));
      
      await apiClient.post(`${apiConfig.endpoints.agents}/${agentId}/stop`);
    } catch (error) {
      console.error('Error stopping agent:', error);
      alert('Failed to stop agent');
      // Revert status on error (assuming it was running)
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, status: 'running' } : agent
      ));
    }
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
      try {
        await apiClient.delete(`${apiConfig.endpoints.agents}/${agentId}`);
        setAgents(prev => prev.filter(agent => agent.id !== agentId));
      } catch (error) {
        console.error('Error deleting agent:', error);
        alert('Failed to delete agent');
      }
    }
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setIsEditModalOpen(true);
  };

  const handleUpdateAgent = (updatedAgent: any) => {
    setAgents(prev => prev.map(agent => 
      agent.id === updatedAgent.id ? updatedAgent : agent
    ));
    setIsEditModalOpen(false);
    setEditingAgent(null);
  };

  const handleCreateAgent = (newAgent: any) => {
    setAgents(prev => [...prev, newAgent]);
  };

  const handleRunNSGValidation = (agentId: number) => {
    setSelectedAgentForNSG(agentId);
    setIsNSGSelectionModalOpen(true);
  };

  const handleExecuteNSGValidation = async (selectedNSGIds: number[]) => {
    if (!selectedAgentForNSG || selectedNSGIds.length === 0) {
      return;
    }

    try {
      // Update agent status to running
      setAgents(prev => prev.map(agent => 
        agent.id === selectedAgentForNSG 
          ? { ...agent, status: 'running' as const }
          : agent
      ));

      // Call the backend API
      const result = await apiClient.post(
        `${apiConfig.endpoints.agents}/${selectedAgentForNSG}/execute-nsg-validation`,
        selectedNSGIds // apiClient.post handles JSON stringification
      );

      console.log('NSG validation started:', result);
      
      // Simulate completion after some time (in real app, you'd poll for status)
      setTimeout(() => {
        setAgents(prev => prev.map(agent => 
          agent.id === selectedAgentForNSG 
            ? { 
                ...agent, 
                status: 'completed' as const,
                execution_count: agent.execution_count + 1,
                last_execution_at: new Date().toISOString()
              }
            : agent
        ));
      }, 5000);

    } catch (error) {
      console.error('Error executing NSG validation:', error);
      // Update agent status to failed
      setAgents(prev => prev.map(agent => 
        agent.id === selectedAgentForNSG 
          ? { ...agent, status: 'failed' as const }
          : agent
      ));
      alert('Failed to start NSG validation');
    }

    setIsNSGSelectionModalOpen(false);
    setSelectedAgentForNSG(null);
  };

  const handleViewExecutionHistory = (agentId: number) => {
    setSelectedAgentForHistory(agentId);
    setIsExecutionHistoryModalOpen(true);
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'stopped':
        return <Square className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'stopped':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getAgentTypeLabel = (type: Agent['agent_type']) => {
    switch (type) {
      case 'nsg_analyzer':
        return 'NSG Analyzer';
      case 'remediation_generator':
        return 'Remediation Generator';
      case 'security_auditor':
        return 'Security Auditor';
      case 'compliance_checker':
        return 'Compliance Checker';
      default:
        return type;
    }
  };

  const getAgentTypeIcon = (type: Agent['agent_type']) => {
    switch (type) {
      case 'nsg_analyzer':
        return <Shield className="w-4 h-4" />;
      case 'remediation_generator':
        return <Wrench className="w-4 h-4" />;
      case 'security_auditor':
        return <Search className="w-4 h-4" />;
      case 'compliance_checker':
        return <FileCheck className="w-4 h-4" />;
      default:
        return <Play className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
          <p className="text-gray-600 mt-1">
            Manage and monitor your AI-powered security analysis agents
          </p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Agent
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Agents</p>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
            </div>
            <Bot className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Agents</p>
              <p className="text-2xl font-bold text-gray-900">
                {agents.filter(a => a.is_active).length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Running Now</p>
              <p className="text-2xl font-bold text-gray-900">
                {agents.filter(a => a.status === 'running').length}
              </p>
            </div>
            <Play className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {agents.length > 0 ? Math.round(agents.reduce((acc, a) => acc + a.success_rate, 0) / agents.length) : 0}%
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Agent Scope Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Bot className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Agent Scope</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Select the subscription, resource group, and NSG for agent operations.
        </p>
        <FilterComponent
          selectedSubscription={filters.selectedSubscription}
          selectedResourceGroup={filters.selectedResourceGroup}
          selectedLocation={filters.selectedLocation}
          selectedNSG={filters.selectedNSG}
          selectedNSGs={filters.selectedNSGs}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Agents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AI Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Run
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Bot className="w-8 h-8 text-blue-500 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                        <div className="text-sm text-gray-500">{agent.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getAgentTypeLabel(agent.agent_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.ai_model}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(agent.status)}
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div>{agent.execution_count} runs</div>
                      <div className="text-xs text-gray-500">{agent.success_rate}% success</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agent.last_execution_at ? new Date(agent.last_execution_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-blue-600 hover:text-blue-900" title="View Details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewExecutionHistory(agent.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Execution History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditAgent(agent)}
                        className="text-gray-600 hover:text-gray-900" 
                        title="Edit Agent"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {agent.status === 'running' ? (
                        <button
                          onClick={() => handleStopAgent(agent.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Stop Agent"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (agent.agent_type === 'nsg_analyzer' || agent.agent_type === 'remediation_generator') {
                              handleRunNSGValidation(agent.id);
                            } else {
                              handleStartAgent(agent.id);
                            }
                          }}
                          className="text-green-600 hover:text-green-900"
                          title={`Run ${getAgentTypeLabel(agent.agent_type)}`}
                        >
                          {getAgentTypeIcon(agent.agent_type)}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAgent(agent.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Agent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Available AI Models */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Available AI Models</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableModels.map((model) => (
              <div key={model.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{model.name}</h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    model.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {model.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{model.description}</p>
                <div className="text-xs text-gray-500">
                  <div>Provider: {model.provider}</div>
                  <div>Max Tokens: {model.max_tokens.toLocaleString()}</div>
                  <div>Cost: ${model.cost_per_1k_tokens}/1K tokens</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Agent Modal */}
      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateAgent}
      />

      {/* Edit Agent Modal */}
      <CreateAgentModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingAgent(null);
        }}
        onSave={handleUpdateAgent}
        initialData={editingAgent ? {
          name: editingAgent.name,
          description: editingAgent.description,
          aiModel: editingAgent.ai_model,
        } : undefined}
        isEditing={true}
      />

      {/* NSG Selection Modal */}
      <NSGSelectionModal
        isOpen={isNSGSelectionModalOpen}
        onClose={() => {
          setIsNSGSelectionModalOpen(false);
          setSelectedAgentForNSG(null);
        }}
        onExecute={handleExecuteNSGValidation}
        agentId={selectedAgentForNSG}
        preSelectedNSGNames={filters.selectedNSGs}
      />

      {/* Execution History Modal */}
      <ExecutionHistoryModal
        isOpen={isExecutionHistoryModalOpen}
        onClose={() => {
          setIsExecutionHistoryModalOpen(false);
          setSelectedAgentForHistory(null);
        }}
        agentId={selectedAgentForHistory}
        agentName={selectedAgentForHistory ? agents.find(a => a.id === selectedAgentForHistory)?.name : undefined}
      />
    </div>
  );
};

export default AgentsPage;