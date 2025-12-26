import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Check, X, Plus, Edit, Trash2, Search } from 'lucide-react';
import { apiClient } from '../config/api';

interface NSGRule {
  id: string;
  name: string;
  priority: number;
  source: string;
  destination: string;
  port: string;
  protocol: string;
  action: 'Allow' | 'Deny';
  originalRule?: any; // To store the full rule object from Azure
}

const NSGRuleEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<NSGRule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch real data from API
  const { data: nsgData, isLoading } = useQuery({
    queryKey: ['nsg-rules', id],
    queryFn: async () => {
      if (!id) throw new Error('NSG ID is required');
      
      const response = await apiClient.get(`/api/v1/nsgs/${id}`);
      const data = response.data || response;
      
      // Map backend data to frontend structure
      const mapRule = (rule: any) => ({
        id: rule.name, // Use name as ID since Azure rules don't always have a simple ID
        name: rule.name,
        priority: rule.priority,
        source: rule.source_address_prefix || rule.source_address_prefixes?.join(',') || '*',
        destination: rule.destination_address_prefix || rule.destination_address_prefixes?.join(',') || '*',
        port: rule.destination_port_range || rule.destination_port_ranges?.join(',') || '*',
        protocol: rule.protocol,
        action: rule.access,
        originalRule: rule
      });

      return {
        id: data.id,
        name: data.name,
        inboundRules: (data.inbound_rules || []).map(mapRule),
        outboundRules: (data.outbound_rules || []).map(mapRule),
        originalData: data
      };
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Prepare payload for backend
      // We need to convert back to the format backend expects
      const payload = {
        inbound_rules: data.inboundRules.map((r: NSGRule) => ({
          ...r.originalRule,
          name: r.name,
          priority: r.priority,
          source_address_prefix: r.source,
          destination_address_prefix: r.destination,
          destination_port_range: r.port,
          protocol: r.protocol,
          access: r.action,
          direction: 'Inbound'
        })),
        outbound_rules: data.outboundRules.map((r: NSGRule) => ({
          ...r.originalRule,
          name: r.name,
          priority: r.priority,
          source_address_prefix: r.source,
          destination_address_prefix: r.destination,
          destination_port_range: r.port,
          protocol: r.protocol,
          access: r.action,
          direction: 'Outbound'
        }))
      };

      await apiClient.put(`/api/v1/nsgs/${id}/rules`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success('NSG rules saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['nsg-rules', id] });
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      toast.error('Failed to save NSG rules: ' + (error.message || 'Unknown error'));
    }
  });

  const handleSave = () => {
    if (nsgData) {
      saveMutation.mutate(nsgData);
    }
  };

  const filteredInboundRules = (nsgData?.inboundRules || []).filter((rule: NSGRule) => 
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.port.toString().includes(searchTerm) ||
    rule.protocol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOutboundRules = (nsgData?.outboundRules || []).filter((rule: NSGRule) => 
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.port.toString().includes(searchTerm) ||
    rule.protocol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const RuleTable: React.FC<{
    title: string;
    rules: NSGRule[];
    onEdit: (rule: NSGRule) => void;
    onDelete: (rule: NSGRule) => void;
  }> = ({ title, rules, onEdit, onDelete }) => (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Port</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Protocol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rules.map((rule, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rule.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.priority}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.source}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.destination}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.port}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.protocol}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    rule.action === 'Allow' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {rule.action === 'Allow' ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                    {rule.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(rule)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(rule)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-gray-200">
        <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">NSG Rule Editor</h1>
          <p className="mt-2 text-gray-600">
            Manage network security group rules for your Azure resources.
          </p>
        </div>
        <div className="flex space-x-3">
          <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Search rules by name, source, destination, port, or protocol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Rules Tables */}
      <div className="space-y-6">
        <RuleTable
          title="Inbound Rules"
          rules={filteredInboundRules}
          onEdit={(rule) => setEditingRule(rule)}
          onDelete={(rule) => {
            if (confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
              toast.success(`Rule "${rule.name}" deleted`);
            }
          }}
        />
        
        <RuleTable
          title="Outbound Rules"
          rules={filteredOutboundRules}
          onEdit={(rule) => setEditingRule(rule)}
          onDelete={(rule) => {
            if (confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
              toast.success(`Rule "${rule.name}" deleted`);
            }
          }}
        />
      </div>

      {/* Edit Rule Modal would go here */}
      {editingRule && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Rule</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <input
                    type="number"
                    value={editingRule.priority}
                    onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setEditingRule(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Rule updated');
                      setEditingRule(null);
                    }}
                    className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NSGRuleEditorPage;
