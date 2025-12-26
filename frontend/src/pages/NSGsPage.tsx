import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

import { Search, Plus, Shield, Edit, Trash2, Eye, Filter, MapPin, Clock, Settings, RefreshCw, Cloud, X, Save, AlertTriangle, CheckCircle, Tag } from 'lucide-react';
import { apiClient } from '../config/api';

interface Subscription {
  id: string;
  display_name: string;
  state: string;
  tenant_id: string;
}

interface ResourceGroup {
  name: string;
  location: string;
  id: string;
  subscription_id: string;
  provisioning_state: string;
  tags: Record<string, string>;
}

interface Location {
  name: string;
  display_name: string;
  latitude: number;
  longitude: number;
  subscription_id: string;
}

interface NSG {
  id: number;
  name: string;
  resource_group: string;
  region: string;
  subscription_id: string;
  azure_id: string;
  inbound_rules: any[];
  outbound_rules: any[];
  tags: Record<string, string>;
  is_active: boolean;
  compliance_score: number;
  risk_level: string;
  last_sync: string;
  last_backup: string | null;
  created_at: string;
  updated_at: string;
}

const NSGsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [selectedResourceGroup, setSelectedResourceGroup] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [nsgs, setNsgs] = useState<NSG[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [resourceGroupsLoading, setResourceGroupsLoading] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedNSG, setSelectedNSG] = useState<NSG | null>(null);
  
  // Form states for create/edit
  const [formData, setFormData] = useState({
    name: '',
    resource_group: '',
    region: '',
    tags: {} as Record<string, string>
  });
  
  // Rule editing states
  const [editingInboundRules, setEditingInboundRules] = useState<any[]>([]);
  const [editingOutboundRules, setEditingOutboundRules] = useState<any[]>([]);

  // API functions
  const fetchSubscriptions = async () => {
    try {
      setSubscriptionsLoading(true);
      const data = await apiClient.get('/api/v1/subscriptions');
      // Map backend response to frontend interface
      if (data && Array.isArray(data.subscriptions)) {
        const mappedSubscriptions = data.subscriptions.map((sub: any) => ({
          id: sub.id || '',
          display_name: sub.name || sub.display_name || 'Unknown',
          state: sub.state || 'Unknown',
          tenant_id: sub.tenant_id || ''
        }));
        setSubscriptions(mappedSubscriptions);
        if (mappedSubscriptions.length > 0 && !selectedSubscription) {
          setSelectedSubscription(mappedSubscriptions[0].id);
        }
      } else {
        console.warn('Invalid subscriptions response:', data);
        setSubscriptions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscriptions');
      setSubscriptions([]);
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  const fetchResourceGroups = async (subscriptionId: string) => {
    if (!subscriptionId) return;
    
    try {
      setResourceGroupsLoading(true);
      const data = await apiClient.get('/api/v1/resource-groups', { subscription_id: subscriptionId });
      
      // Add null checks and validation
      if (data && Array.isArray(data.resource_groups)) {
        setResourceGroups(data.resource_groups);
      } else {
        console.warn('Invalid resource groups response:', data);
        setResourceGroups([]);
      }
    } catch (err) {
      console.error('Failed to fetch resource groups:', err);
      setResourceGroups([]);
    } finally {
      setResourceGroupsLoading(false);
    }
  };

  const fetchLocations = async (subscriptionId: string) => {
    if (!subscriptionId) return;
    
    try {
      setLocationsLoading(true);
      const data = await apiClient.get('/api/v1/locations', { subscription_id: subscriptionId });
      
      // Add null checks and validation
      if (data && Array.isArray(data.locations)) {
        setLocations(data.locations);
      } else {
        console.warn('Invalid locations response:', data);
        setLocations([]);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  };

  const fetchNSGs = async (subscriptionId: string, resourceGroup?: string, region?: string) => {
    if (!subscriptionId) return;
    
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = { subscription_id: subscriptionId };
      if (resourceGroup) {
        params.resource_group = resourceGroup;
      }
      if (region) {
        params.region = region;
      }
      const data = await apiClient.get('/api/v1/nsgs', params);
      
      // Add null checks and validation for NSGs data
      if (data && Array.isArray(data.nsgs)) {
        // Ensure each NSG has proper inbound_rules and outbound_rules arrays
        const validatedNSGs = data.nsgs.map((nsg: any) => ({
          ...nsg,
          inbound_rules: Array.isArray(nsg.inbound_rules) ? nsg.inbound_rules : [],
          outbound_rules: Array.isArray(nsg.outbound_rules) ? nsg.outbound_rules : [],
          compliance_score: nsg.compliance_score || 0,
          risk_level: nsg.risk_level || 'UNKNOWN',
          is_active: nsg.is_active !== undefined ? nsg.is_active : false
        }));
        setNsgs(validatedNSGs);
      } else {
        console.warn('Invalid NSGs response:', data);
        setNsgs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch NSGs');
      setNsgs([]);
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    if (selectedSubscription) {
      // Reset dependent selections
      setSelectedResourceGroup('');
      setSelectedLocation('');
      // Fetch dependent data
      fetchResourceGroups(selectedSubscription);
      fetchLocations(selectedSubscription);
      fetchNSGs(selectedSubscription);
    } else {
      setResourceGroups([]);
      setLocations([]);
      setNsgs([]);
    }
  }, [selectedSubscription]);

  useEffect(() => {
    if (selectedSubscription) {
      fetchNSGs(selectedSubscription, selectedResourceGroup || undefined, selectedLocation || undefined);
    }
  }, [selectedResourceGroup, selectedLocation]);

  const filteredNSGs = nsgs.filter(nsg => {
    const matchesSearch = nsg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nsg.resource_group.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nsg.region.toLowerCase().includes(searchTerm.toLowerCase());
    
    // We already filtered by location in the backend, but we keep this check if the user just cleared the search
    // actually, if we filter by backend, nsg.region should match selectedLocation if it's set.
    // However, if we change location, we re-fetch.
    // So this client side filter is redundant for exact match but harmless.
    const matchesLocation = !selectedLocation || nsg.region === selectedLocation;
    
    return matchesSearch && matchesLocation;
  });

  const handleRefresh = () => {
    if (selectedSubscription) {
      fetchResourceGroups(selectedSubscription);
      fetchLocations(selectedSubscription);
      fetchNSGs(selectedSubscription, selectedResourceGroup || undefined, selectedLocation || undefined);
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // NSG operation handlers
  const handleViewNSG = (nsg: NSG) => {
    setSelectedNSG(nsg);
    setViewModalOpen(true);
  };

  const handleEditNSG = (nsg: NSG) => {
    setSelectedNSG(nsg);
    setFormData({
      name: nsg.name,
      resource_group: nsg.resource_group,
      region: nsg.region,
      tags: nsg.tags || {}
    });
    // Initialize rule editing states with deep copies
    setEditingInboundRules(JSON.parse(JSON.stringify(nsg.inbound_rules || [])));
    setEditingOutboundRules(JSON.parse(JSON.stringify(nsg.outbound_rules || [])));
    setEditModalOpen(true);
  };

  const handleDeleteNSG = (nsg: NSG) => {
    setSelectedNSG(nsg);
    setDeleteModalOpen(true);
  };

  const handleCreateNSG = () => {
    setFormData({
      name: '',
      resource_group: selectedResourceGroup || '',
      region: selectedLocation || '',
      tags: {}
    });
    setCreateModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedNSG) return;
    
    try {
      const response = await fetch(`/api/v1/nsgs/${selectedNSG.azure_id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete NSG');
      
      // Refresh NSG list
      fetchNSGs(selectedSubscription, selectedResourceGroup || undefined);
      setDeleteModalOpen(false);
      setSelectedNSG(null);
    } catch (err) {
      console.error('Failed to delete NSG:', err);
      alert('Failed to delete NSG: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Helper functions for rule editing
  const updateInboundRule = (index: number, field: string, value: string | number) => {
    const updatedRules = [...editingInboundRules];
    // Convert priority to number if it's a priority field
    const processedValue = field === 'priority' ? parseInt(value as string, 10) || 0 : value;
    updatedRules[index] = { ...updatedRules[index], [field]: processedValue };
    setEditingInboundRules(updatedRules);
  };

  const updateOutboundRule = (index: number, field: string, value: string | number) => {
    const updatedRules = [...editingOutboundRules];
    // Convert priority to number if it's a priority field
    const processedValue = field === 'priority' ? parseInt(value as string, 10) || 0 : value;
    updatedRules[index] = { ...updatedRules[index], [field]: processedValue };
    setEditingOutboundRules(updatedRules);
  };

  const deleteInboundRule = (index: number) => {
    const updatedRules = editingInboundRules.filter((_, i) => i !== index);
    setEditingInboundRules(updatedRules);
  };

  const deleteOutboundRule = (index: number) => {
    const updatedRules = editingOutboundRules.filter((_, i) => i !== index);
    setEditingOutboundRules(updatedRules);
  };

  const addInboundRule = () => {
    const newRule = {
      name: '',
      priority: 1000,
      access: 'Allow',
      protocol: 'TCP',
      source_address_prefix: '*',
      source_port_range: '*',
      destination_address_prefix: '*',
      destination_port_range: '*',
      description: ''
    };
    setEditingInboundRules([...editingInboundRules, newRule]);
  };

  const addOutboundRule = () => {
    const newRule = {
      name: '',
      priority: 1000,
      access: 'Allow',
      protocol: 'TCP',
      source_address_prefix: '*',
      source_port_range: '*',
      destination_address_prefix: '*',
      destination_port_range: '*',
      description: ''
    };
    setEditingOutboundRules([...editingOutboundRules, newRule]);
  };

  const saveNSG = async () => {
    try {
      if (selectedNSG) {
        // Update existing NSG - use dedicated rules endpoint
        const rulesResponse = await fetch(`/api/v1/nsgs/${selectedNSG.id}/rules?subscription_id=${selectedSubscription}&resource_group=${selectedNSG.resource_group}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inbound_rules: editingInboundRules,
            outbound_rules: editingOutboundRules
          })
        });
        
        if (!rulesResponse.ok) throw new Error('Failed to update NSG rules');
        
        // Update basic NSG properties if they changed
        if (formData.name !== selectedNSG.name || 
            formData.resource_group !== selectedNSG.resource_group || 
            formData.region !== selectedNSG.region) {
          const nsgResponse = await fetch(`/api/v1/nsgs/${selectedNSG.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: formData.name,
              resource_group: formData.resource_group,
              region: formData.region,
              subscription_id: selectedSubscription
            })
          });
          
          if (!nsgResponse.ok) throw new Error('Failed to update NSG properties');
        }
      } else {
        // Create new NSG
        const payload = {
          ...formData,
          subscription_id: selectedSubscription,
          inbound_rules: editingInboundRules,
          outbound_rules: editingOutboundRules
        };
        
        const response = await fetch('/api/v1/nsgs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Failed to create NSG');
      }
      
      // Refresh NSG list
      fetchNSGs(selectedSubscription, selectedResourceGroup || undefined);
      setEditModalOpen(false);
      setCreateModalOpen(false);
      setSelectedNSG(null);
    } catch (err) {
      console.error(`Failed to ${selectedNSG ? 'update' : 'create'} NSG:`, err);
      alert(`Failed to ${selectedNSG ? 'update' : 'create'} NSG: ` + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Error boundary for render errors
  if (renderError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="enterprise-card">
            <CardContent className="p-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Render Error</h2>
                <p className="text-red-700 mb-4">{renderError}</p>
                <Button onClick={() => setRenderError(null)} className="btn-secondary">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </div>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <h1 className="text-4xl font-bold gradient-text">
            Network Security Groups
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Manage and monitor your Azure Network Security Groups (NSGs) and their security rules with advanced controls.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4 animate-slide-up">
          <div className="enterprise-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total NSGs</p>
                  <p className="text-3xl font-bold text-slate-800">{loading ? '...' : nsgs.length}</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                  <Shield className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </div>
          
          <div className="enterprise-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active NSGs</p>
                  <p className="text-3xl font-bold text-slate-800">{loading ? '...' : nsgs.filter(n => n.is_active === true).length}</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl">
                  <Settings className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </div>
          
          <div className="enterprise-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Rules</p>
                  <p className="text-3xl font-bold text-slate-800">{loading ? '...' : nsgs.reduce((sum, nsg) => sum + (nsg.inbound_rules?.length || 0) + (nsg.outbound_rules?.length || 0), 0)}</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl">
                  <Filter className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </div>
          
          <div className="enterprise-card card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Avg Compliance</p>
                  <p className="text-3xl font-bold text-slate-800">{loading ? '...' : nsgs.length > 0 ? Math.round(nsgs.reduce((sum, nsg) => sum + (nsg.compliance_score || 0), 0) / nsgs.length) + '%' : '0%'}</p>
                </div>
                <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </div>
        </div>

        {/* Subscription Selection and Search */}
        <div className="enterprise-card animate-scale-in">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-blue-600" />
                  <div className="min-w-[200px]">
                    <select
                      value={selectedSubscription}
                      onChange={(e) => setSelectedSubscription(e.target.value)}
                      disabled={subscriptionsLoading}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{subscriptionsLoading ? "Loading subscriptions..." : "Select subscription"}</option>
                       {subscriptions.map((sub) => (
                         <option key={sub.id} value={sub.id}>
                           {sub.display_name}
                         </option>
                       ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-green-600" />
                  <div className="min-w-[200px]">
                    <select
                      value={selectedResourceGroup}
                      onChange={(e) => setSelectedResourceGroup(e.target.value)}
                      disabled={resourceGroupsLoading || !selectedSubscription}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{resourceGroupsLoading ? "Loading resource groups..." : `All resource groups (${resourceGroups.length})`}</option>
                       {resourceGroups.map((rg) => (
                         <option key={rg.name} value={rg.name}>
                           {rg.name}
                         </option>
                       ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  <div className="min-w-[200px]">
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      disabled={locationsLoading || !selectedSubscription}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{locationsLoading ? "Loading locations..." : `All locations (${locations.length})`}</option>
                       {locations.map((loc) => (
                         <option key={loc.name} value={loc.name}>
                           {loc.display_name}
                         </option>
                       ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    placeholder="Search NSGs by name, resource group, or location..."
                    className="input-modern pl-12 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    className="btn-secondary" 
                    onClick={handleRefresh} 
                    disabled={loading || !selectedSubscription}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button className="btn-secondary">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </Button>
                  <Button className="button-modern" onClick={handleCreateNSG}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create NSG
                  </Button>
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </div>

        {/* NSGs Grid */}
        <div className="grid gap-6 animate-fade-in">
          {filteredNSGs.map((nsg, index) => (
            <div key={nsg.id} className="enterprise-card card-hover" style={{animationDelay: `${index * 100}ms`}}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800">{nsg.name || 'Unnamed NSG'}</CardTitle>
                      <CardDescription className="text-slate-600 flex items-center mt-1">
                        <MapPin className="w-4 h-4 mr-1" />
                        {nsg.resource_group || 'Unknown'} • {nsg.region || 'Unknown'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={getRiskLevelColor(nsg.risk_level || 'unknown')}>
                      {(nsg.risk_level || 'UNKNOWN').toUpperCase()}
                    </Badge>
                    <Badge 
                      className={nsg.is_active === true
                        ? 'bg-green-100 text-green-800 border-green-200' 
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                      }
                    >
                      {nsg.is_active === true ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <p className="text-sm font-medium text-slate-600 mb-1">Security Rules</p>
                    <p className="text-2xl font-bold text-blue-600">{(nsg.inbound_rules?.length || 0) + (nsg.outbound_rules?.length || 0)}</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <p className="text-sm font-medium text-slate-600 mb-1">Compliance Score</p>
                    <p className="text-2xl font-bold text-purple-600">{nsg.compliance_score || 0}%</p>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                    <p className="text-sm font-medium text-slate-600 mb-1">Last Sync</p>
                    <div className="flex items-center justify-center text-sm text-green-600 font-medium">
                      <Clock className="w-4 h-4 mr-1" />
                      {nsg.last_sync ? formatDate(nsg.last_sync) : 'Never'}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-100">
                    <p className="text-sm font-medium text-slate-600 mb-2">Actions</p>
                    <div className="flex justify-center space-x-2">
                      <Button size="sm" className="btn-secondary text-xs px-3 py-1" onClick={() => handleViewNSG(nsg)}>
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" className="btn-secondary text-xs px-3 py-1" onClick={() => handleEditNSG(nsg)}>
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" className="btn-secondary text-xs px-3 py-1 text-red-600 hover:text-red-700" onClick={() => handleDeleteNSG(nsg)}>
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredNSGs.length === 0 && (
          <div className="enterprise-card animate-fade-in">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="p-6 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <Shield className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">
                  {searchTerm ? 'No NSGs found' : 'No NSGs available'}
                </h3>
                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  {searchTerm 
                    ? `No Network Security Groups match your search for "${searchTerm}".`
                    : 'Get started by creating your first Network Security Group to secure your Azure resources.'
                  }
                </p>
                {!searchTerm && (
                  <Button className="button-modern" onClick={handleCreateNSG}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First NSG
                  </Button>
                )}
              </div>
            </CardContent>
          </div>
        )}

        {/* View NSG Modal */}
        <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                View NSG: {selectedNSG?.name}
              </DialogTitle>
              <DialogDescription>
                Network Security Group details and rules
              </DialogDescription>
            </DialogHeader>
            {selectedNSG && (
              <div className="space-y-6">
                {/* NSG Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <div><strong>Resource Group:</strong> {selectedNSG.resource_group}</div>
                    <div><strong>Region:</strong> {selectedNSG.region}</div>
                    <div><strong>Subscription ID:</strong> {selectedNSG.subscription_id}</div>
                  </div>
                  <div className="space-y-2">
                    <div><strong>Compliance Score:</strong> 
                      <Badge variant={selectedNSG.compliance_score >= 80 ? "default" : selectedNSG.compliance_score >= 60 ? "secondary" : "destructive"} className="ml-2">
                        {selectedNSG.compliance_score}%
                      </Badge>
                    </div>
                    <div><strong>Risk Level:</strong> 
                      <Badge variant={selectedNSG.risk_level === 'LOW' ? "default" : selectedNSG.risk_level === 'MEDIUM' ? "secondary" : "destructive"} className="ml-2">
                        {selectedNSG.risk_level}
                      </Badge>
                    </div>
                    <div><strong>Status:</strong> 
                      <Badge variant={selectedNSG.is_active ? "default" : "secondary"} className="ml-2">
                        {selectedNSG.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* NSG Rules */}
                <Tabs defaultValue="inbound" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="inbound">Inbound Rules ({selectedNSG.inbound_rules?.length || 0})</TabsTrigger>
                    <TabsTrigger value="outbound">Outbound Rules ({selectedNSG.outbound_rules?.length || 0})</TabsTrigger>
                  </TabsList>
                <TabsContent value="inbound" className="space-y-4">
                  <div className="space-y-2">
                    {selectedNSG.inbound_rules?.length > 0 ? (
                      selectedNSG.inbound_rules.map((rule: any, index: number) => (
                        <div key={`inbound-${rule.name || rule.priority || index}`} className="p-3 border rounded-lg bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div><strong>Name:</strong> {rule.name || 'N/A'}</div>
                            <div><strong>Priority:</strong> {rule.priority || 'N/A'}</div>
                            <div><strong>Action:</strong> {rule.access || 'N/A'}</div>
                            <div><strong>Protocol:</strong> {rule.protocol || 'N/A'}</div>
                            <div><strong>Source:</strong> {rule.source_address_prefix || 'N/A'}</div>
                            <div><strong>Source Port:</strong> {rule.source_port_range || 'N/A'}</div>
                            <div><strong>Destination:</strong> {rule.destination_address_prefix || 'N/A'}</div>
                            <div><strong>Dest Port:</strong> {rule.destination_port_range || 'N/A'}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No inbound rules configured</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="outbound" className="space-y-4">
                  <div className="space-y-2">
                    {selectedNSG.outbound_rules?.length > 0 ? (
                      selectedNSG.outbound_rules.map((rule: any, index: number) => (
                        <div key={`outbound-${rule.name || rule.priority || index}`} className="p-3 border rounded-lg bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div><strong>Name:</strong> {rule.name || 'N/A'}</div>
                            <div><strong>Priority:</strong> {rule.priority || 'N/A'}</div>
                            <div><strong>Action:</strong> {rule.access || 'N/A'}</div>
                            <div><strong>Protocol:</strong> {rule.protocol || 'N/A'}</div>
                            <div><strong>Source:</strong> {rule.source_address_prefix || 'N/A'}</div>
                            <div><strong>Source Port:</strong> {rule.source_port_range || 'N/A'}</div>
                            <div><strong>Destination:</strong> {rule.destination_address_prefix || 'N/A'}</div>
                            <div><strong>Dest Port:</strong> {rule.destination_port_range || 'N/A'}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No outbound rules configured</p>
                    )}
                  </div>
                </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit NSG Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit NSG: {selectedNSG?.name}
              </DialogTitle>
              <DialogDescription>
                Update Network Security Group details and security rules
              </DialogDescription>
            </DialogHeader>
            {selectedNSG && (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">NSG Details</TabsTrigger>
                  <TabsTrigger value="inbound">Inbound Rules ({selectedNSG.inbound_rules?.length || 0})</TabsTrigger>
                  <TabsTrigger value="outbound">Outbound Rules ({selectedNSG.outbound_rules?.length || 0})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-name">NSG Name</Label>
                      <Input
                        id="edit-name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Enter NSG name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-resource-group">Resource Group</Label>
                      <Input
                        id="edit-resource-group"
                        value={formData.resource_group}
                        onChange={(e) => setFormData({...formData, resource_group: e.target.value})}
                        placeholder="Enter resource group"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-region">Region</Label>
                    <Input
                      id="edit-region"
                      value={formData.region}
                      onChange={(e) => setFormData({...formData, region: e.target.value})}
                      placeholder="Enter region"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="inbound" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Inbound Security Rules</h3>
                    <Button className="btn-secondary" size="sm" onClick={addInboundRule}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editingInboundRules.length > 0 ? (
                      editingInboundRules.map((rule: any, index: number) => (
                        <div key={`edit-inbound-${rule.name || rule.priority || index}`} className="p-4 border rounded-lg bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Name</Label>
                              <Input 
                                value={rule.name || ''} 
                                onChange={(e) => updateInboundRule(index, 'name', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Rule name"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Priority</Label>
                              <Input 
                                type="number"
                                value={rule.priority || ''} 
                                onChange={(e) => updateInboundRule(index, 'priority', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Priority"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Action</Label>
                              <select 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded"
                                value={rule.access || 'Allow'}
                                onChange={(e) => updateInboundRule(index, 'access', e.target.value)}
                              >
                                <option key="inbound-allow" value="Allow">Allow</option>
                              <option key="inbound-deny" value="Deny">Deny</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Protocol</Label>
                              <select 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded"
                                value={rule.protocol || 'TCP'}
                                onChange={(e) => updateInboundRule(index, 'protocol', e.target.value)}
                              >
                                <option key="inbound-any" value="*">Any</option>
                              <option key="inbound-tcp" value="TCP">TCP</option>
                              <option key="inbound-udp" value="UDP">UDP</option>
                              <option key="inbound-icmp" value="ICMP">ICMP</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Source</Label>
                              <Input 
                                value={rule.source_address_prefix || ''} 
                                onChange={(e) => updateInboundRule(index, 'source_address_prefix', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Source address"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Source Port</Label>
                              <Input 
                                value={rule.source_port_range || ''} 
                                onChange={(e) => updateInboundRule(index, 'source_port_range', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Source port"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Destination</Label>
                              <Input 
                                value={rule.destination_address_prefix || ''} 
                                onChange={(e) => updateInboundRule(index, 'destination_address_prefix', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Destination address"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Dest Port</Label>
                              <Input 
                                value={rule.destination_port_range || ''} 
                                onChange={(e) => updateInboundRule(index, 'destination_port_range', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Destination port"
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <Label className="text-xs font-medium text-gray-600">Description</Label>
                            <Input 
                              value={rule.description || ''} 
                              onChange={(e) => updateInboundRule(index, 'description', e.target.value)}
                              className="mt-1" 
                              placeholder="Rule description" 
                            />
                          </div>
                          <div className="flex justify-end mt-3">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => deleteInboundRule(index)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-8">No inbound rules configured</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="outbound" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Outbound Security Rules</h3>
                    <Button className="btn-secondary" size="sm" onClick={addOutboundRule}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Rule
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editingOutboundRules.length > 0 ? (
                      editingOutboundRules.map((rule: any, index: number) => (
                        <div key={`edit-outbound-${rule.name || rule.priority || index}`} className="p-4 border rounded-lg bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Name</Label>
                              <Input 
                                value={rule.name || ''} 
                                onChange={(e) => updateOutboundRule(index, 'name', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Rule name"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Priority</Label>
                              <Input 
                                type="number"
                                value={rule.priority || ''} 
                                onChange={(e) => updateOutboundRule(index, 'priority', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Priority"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Action</Label>
                              <select 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded"
                                value={rule.access || 'Allow'}
                                onChange={(e) => updateOutboundRule(index, 'access', e.target.value)}
                              >
                                <option key="outbound-allow" value="Allow">Allow</option>
                              <option key="outbound-deny" value="Deny">Deny</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Protocol</Label>
                              <select 
                                className="w-full mt-1 px-2 py-1 text-sm border rounded"
                                value={rule.protocol || 'TCP'}
                                onChange={(e) => updateOutboundRule(index, 'protocol', e.target.value)}
                              >
                                <option key="outbound-any" value="*">Any</option>
                              <option key="outbound-tcp" value="TCP">TCP</option>
                              <option key="outbound-udp" value="UDP">UDP</option>
                              <option key="outbound-icmp" value="ICMP">ICMP</option>
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Source</Label>
                              <Input 
                                value={rule.source_address_prefix || ''} 
                                onChange={(e) => updateOutboundRule(index, 'source_address_prefix', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Source address"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Source Port</Label>
                              <Input 
                                value={rule.source_port_range || ''} 
                                onChange={(e) => updateOutboundRule(index, 'source_port_range', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Source port"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Destination</Label>
                              <Input 
                                value={rule.destination_address_prefix || ''} 
                                onChange={(e) => updateOutboundRule(index, 'destination_address_prefix', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Destination address"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-600">Dest Port</Label>
                              <Input 
                                value={rule.destination_port_range || ''} 
                                onChange={(e) => updateOutboundRule(index, 'destination_port_range', e.target.value)}
                                className="mt-1" 
                                size="sm" 
                                placeholder="Destination port"
                              />
                            </div>
                          </div>
                          <div className="mt-3">
                            <Label className="text-xs font-medium text-gray-600">Description</Label>
                            <Input 
                              value={rule.description || ''} 
                              onChange={(e) => updateOutboundRule(index, 'description', e.target.value)}
                              className="mt-1" 
                              placeholder="Rule description" 
                            />
                          </div>
                          <div className="flex justify-end mt-3">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => deleteOutboundRule(index)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-8">No outbound rules configured</p>
                    )}
                  </div>
                </TabsContent>
                
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={saveNSG}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Create NSG Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New NSG
              </DialogTitle>
              <DialogDescription>
                Create a new Network Security Group
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-name">NSG Name</Label>
                  <Input
                    id="create-name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter NSG name"
                  />
                </div>
                <div>
                  <Label htmlFor="create-resource-group">Resource Group</Label>
                  <Select value={formData.resource_group} onValueChange={(value) => setFormData({...formData, resource_group: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select resource group" />
                    </SelectTrigger>
                    <SelectContent>
                      {resourceGroups.map((rg) => (
                        <SelectItem key={rg.name} value={rg.name}>{rg.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="create-region">Region</Label>
                <Select value={formData.region} onValueChange={(value) => setFormData({...formData, region: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.name} value={loc.name}>{loc.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={saveNSG}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create NSG
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete NSG Modal */}
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete NSG
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this Network Security Group?
              </DialogDescription>
            </DialogHeader>
            {selectedNSG && (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>NSG Name:</strong> {selectedNSG.name}<br/>
                    <strong>Resource Group:</strong> {selectedNSG.resource_group}<br/>
                    <strong>Region:</strong> {selectedNSG.region}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  This action cannot be undone. All security rules associated with this NSG will be permanently deleted.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={confirmDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete NSG
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
  } catch (error) {
    // Set render error to display error message instead of black screen
    setTimeout(() => {
      setRenderError(error instanceof Error ? error.message : 'An unknown rendering error occurred');
    }, 0);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="enterprise-card">
            <CardContent className="p-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Loading Error</h2>
                <p className="text-red-700 mb-4">Something went wrong while rendering the page.</p>
                <Button onClick={() => window.location.reload()} className="btn-secondary">
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </div>
        </div>
      </div>
    );
  }
};

export default NSGsPage;
