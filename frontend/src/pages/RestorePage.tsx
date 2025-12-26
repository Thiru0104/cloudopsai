import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { RotateCcw, Upload, Shield, Database, CheckCircle, AlertTriangle, Eye, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { useProgress } from '../contexts/ProgressContext';
import FilterComponent from '../components/FilterComponent';
import { apiClient } from '../config/api';

const RestorePage: React.FC = () => {
  const { addProgressItem, updateProgressItem, addLogToItem } = useProgress();
  
  const [filters, setFilters] = useState({
    selectedSubscription: '',
    selectedResourceGroup: '',
    selectedLocation: '',
    selectedNSG: ''
  });
  
  // Restore configuration state
  const [restoreConfig, setRestoreConfig] = useState({
    sourceType: 'storage',
    storageAccount: 'thirustorage001',
    containerName: 'nsg-backups',
    backupFileName: '',
    csvFile: null,
    overwriteExisting: false,
    validateRules: true,
    createBackupBeforeRestore: true
  });
  
  // Restore scope configuration
  const [restoreScope, setRestoreScope] = useState({
    targetType: 'single', // 'single', 'multiple', 'all'
    selectedResourceGroups: [] as string[],
    selectedNSGs: [] as string[],
    applyToAllNSGs: false,
    createNewNSGs: false,
    newNSGNames: [] as { resourceGroup: string; nsgName: string }[]
  });

  // Preview state
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editableRules, setEditableRules] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch storage accounts
  const { data: storageData } = useQuery({
    queryKey: ['storage-accounts', filters.selectedSubscription],
    queryFn: async () => {
      if (!filters.selectedSubscription) return { storage_accounts: [] };
      return await apiClient.get('/api/v1/storage-accounts', { subscription_id: filters.selectedSubscription });
    },
    enabled: !!filters.selectedSubscription
  });
  
  // Fetch resource groups for restore scope selection
  const { data: resourceGroupsData, isLoading: resourceGroupsLoading } = useQuery({
    queryKey: ['resource-groups', filters.selectedSubscription],
    queryFn: async () => {
      if (!filters.selectedSubscription) return { resource_groups: [] };
      return await apiClient.get('/api/v1/resource-groups', { subscription_id: filters.selectedSubscription });
    },
    enabled: !!filters.selectedSubscription
  });
  
  // Fetch containers for restore storage account
  const { data: restoreContainers = [] } = useQuery({
    queryKey: ['restore-containers', restoreConfig.storageAccount],
    queryFn: async () => {
      if (!restoreConfig.storageAccount) return [];
      try {
        const data = await apiClient.get('/api/v1/containers', { storage_account: restoreConfig.storageAccount });
        console.log('Containers API response:', data);
        console.log('Parsed containers:', Array.isArray(data.containers) ? data.containers : Array.isArray(data) ? data : []);
        return Array.isArray(data.containers) ? data.containers : Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching restore containers:', error);
        return [];
      }
    },
    enabled: !!restoreConfig.storageAccount
  });
  
  // Fetch backup files for restore
  const { data: backupFiles = [] } = useQuery({
    queryKey: ['backup-files', restoreConfig.storageAccount, restoreConfig.containerName],
    queryFn: async () => {
      if (!restoreConfig.storageAccount || !restoreConfig.containerName) return [];
      try {
        const data = await apiClient.get('/api/v1/backup/files', { 
          storage_account: restoreConfig.storageAccount,
          container: restoreConfig.containerName 
        });
        console.log('Backup files response:', data);
        return Array.isArray(data.files) ? data.files : [];
      } catch (error) {
        console.error('Error fetching backup files:', error);
        return [];
      }
    },
    enabled: !!restoreConfig.storageAccount && !!restoreConfig.containerName
  });

  // Handle restore preview
  const handleRestorePreview = async () => {
    try {
      // Determine target resource groups for preview
      let targetResourceGroups = [];
      if (restoreScope.targetType === 'single') {
        targetResourceGroups = filters.selectedResourceGroup ? [filters.selectedResourceGroup] : [];
      } else if (restoreScope.targetType === 'multiple') {
        targetResourceGroups = restoreScope.selectedResourceGroups;
      } else if (restoreScope.targetType === 'all') {
        targetResourceGroups = ['*'];
      }
      
      // Read CSV file content if source type is CSV
      let csvFileContent = null;
      if (restoreConfig.sourceType === 'csv' && restoreConfig.csvFile) {
        csvFileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(new Error('Failed to read CSV file'));
          reader.readAsText(restoreConfig.csvFile!);
        });
      }
      
      const previewData = {
        source_type: restoreConfig.sourceType,
        storage_account: restoreConfig.storageAccount,
        container_name: restoreConfig.containerName,
        backup_file_name: restoreConfig.backupFileName,
        csv_file: csvFileContent,
        subscription_id: filters.selectedSubscription,
        target_resource_groups: targetResourceGroups,
        target_type: restoreScope.targetType,
        apply_to_all_nsgs: restoreScope.applyToAllNSGs,
        selected_nsgs: restoreScope.selectedNSGs,
        create_new_nsgs: restoreScope.createNewNSGs,
        new_nsg_names: restoreScope.newNSGNames
      };

    const response = await fetch('/api/v1/backup/restore/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(previewData)
      });

      if (!response.ok) {
        throw new Error('Failed to preview restore');
      }

      const result = await response.json();
      setPreviewData(result);
      setEditableRules(result.preview?.rules || []);
      setShowPreview(true);
      setIsEditMode(false);
      
      if (result.preview?.error) {
        toast.error(result.preview.error);
      } else {
        toast.success(`Preview loaded: ${result.preview?.rules?.length || 0} rules found`);
      }
    } catch (error) {
      toast.error('Failed to preview restore: ' + (error as Error).message);
      setPreviewData(null);
      setShowPreview(false);
    }
  };

  // Handle rule editing
  const handleRuleChange = (index: number, field: string, value: string) => {
    const updatedRules = [...editableRules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    setEditableRules(updatedRules);
  };

  const handleDeleteRule = (index: number) => {
    const updatedRules = editableRules.filter((_, i) => i !== index);
    setEditableRules(updatedRules);
  };

  const handleAddRule = () => {
    const newRule = {
      name: 'NewRule',
      priority: 1000,
      direction: 'Inbound',
      access: 'Allow',
      protocol: 'TCP',
      sourceAddressPrefix: '*',
      sourcePortRange: '*',
      destinationAddressPrefix: '*',
      destinationPortRange: '*',
      description: ''
    };
    setEditableRules([...editableRules, newRule]);
  };

  // Handle restore execution with progress monitoring
  const handleRestoreExecute = async () => {
    // Create progress item
    const progressId = addProgressItem({
      type: 'restore',
      status: 'pending',
      title: 'NSG Restore Operation',
      description: `Restoring from ${restoreConfig.sourceType === 'csv' ? 'CSV file' : 'backup file'}`,
      progress: 0
    });

    try {
      // Update to in progress
      updateProgressItem(progressId, { status: 'in_progress', progress: 10 });
      addLogToItem(progressId, 'Starting restore operation...');

      // Determine target resource groups based on scope configuration
      let targetResourceGroups = [];
      if (restoreScope.targetType === 'single') {
        targetResourceGroups = filters.selectedResourceGroup ? [filters.selectedResourceGroup] : [];
      } else if (restoreScope.targetType === 'multiple') {
        targetResourceGroups = restoreScope.selectedResourceGroups;
      } else if (restoreScope.targetType === 'all') {
        targetResourceGroups = ['*']; // Backend should interpret this as all resource groups
      }
      
      addLogToItem(progressId, `Target resource groups: ${targetResourceGroups.join(', ')}`);
      updateProgressItem(progressId, { progress: 20 });
      
      // Read CSV file content if source type is CSV
      let csvFileContent = null;
      if (restoreConfig.sourceType === 'csv' && restoreConfig.csvFile) {
        addLogToItem(progressId, 'Reading CSV file content...');
        csvFileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(new Error('Failed to read CSV file'));
          reader.readAsText(restoreConfig.csvFile!);
        });
        addLogToItem(progressId, 'CSV file content loaded successfully');
      } else {
        addLogToItem(progressId, `Using backup file: ${restoreConfig.backupFileName}`);
      }
      
      updateProgressItem(progressId, { progress: 40 });
      
      const restoreData = {
        source_type: restoreConfig.sourceType,
        storage_account: restoreConfig.storageAccount,
        container_name: restoreConfig.containerName,
        backup_file_name: restoreConfig.backupFileName,
        csv_file: csvFileContent,
        subscription_id: filters.selectedSubscription,
        resource_group: filters.selectedResourceGroup, // Keep for backward compatibility
        target_resource_groups: targetResourceGroups,
        target_type: restoreScope.targetType,
        apply_to_all_nsgs: restoreScope.applyToAllNSGs,
        selected_nsgs: restoreScope.selectedNSGs,
        create_new_nsgs: restoreScope.createNewNSGs,
        new_nsg_names: restoreScope.newNSGNames,
        overwrite_existing: restoreConfig.overwriteExisting,
        validate_rules: restoreConfig.validateRules,
        create_backup_before_restore: restoreConfig.createBackupBeforeRestore,
        edited_rules: editableRules
      };

      addLogToItem(progressId, 'Sending restore request to backend...');
      updateProgressItem(progressId, { progress: 60 });

    const response = await fetch('/api/v1/backup/restore/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(restoreData)
      });

      if (!response.ok) {
        throw new Error('Failed to execute restore');
      }

      updateProgressItem(progressId, { progress: 80 });
      addLogToItem(progressId, 'Processing restore response...');

      const result = await response.json();
      
      // Update progress with final results
      updateProgressItem(progressId, { 
        status: 'completed', 
        progress: 100,
        details: {
          rulesProcessed: result.restored_rules_count || 0,
          totalRules: result.restored_rules_count || 0,
          nsgsCreated: result.nsgs_created || 0
        }
      });
      
      addLogToItem(progressId, `Restore completed successfully: ${result.restored_rules_count || 0} rules restored`);
      if (result.nsgs_created) {
        addLogToItem(progressId, `NSGs created: ${result.nsgs_created}`);
      }
      
      toast.success(`Restore completed: ${result.restored_rules_count || 0} rules restored`);
    } catch (error) {
      // Update progress with error
      updateProgressItem(progressId, { 
        status: 'failed',
        details: {
          errors: [(error as Error).message]
        }
      });
      addLogToItem(progressId, `Error: ${(error as Error).message}`);
      toast.error('Failed to execute restore: ' + (error as Error).message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.selectedSubscription) {
      toast.error('Please select a subscription');
      return;
    }
    
    if (restoreConfig.sourceType === 'storage' && !restoreConfig.backupFileName) {
      toast.error('Please select a backup file');
      return;
    }
    
    if (restoreConfig.sourceType === 'csv' && !restoreConfig.csvFile) {
      toast.error('Please upload a CSV file');
      return;
    }
    
    handleRestoreExecute();
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
              <RotateCcw className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Restore Configuration
            </h1>
          </div>
          <p className="text-slate-600 text-lg">
            Restore network security group configurations from backup files or CSV uploads.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Restore Scope */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <CardTitle>Restore Scope</CardTitle>
              </div>
              <CardDescription>
                Select the target subscription and resource group for restoration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Basic Subscription Selection */}
                <FilterComponent
                  selectedSubscription={filters.selectedSubscription}
                  selectedResourceGroup={filters.selectedResourceGroup}
                  selectedLocation={filters.selectedLocation}
                  selectedNSG={filters.selectedNSG}
                  onFilterChange={handleFilterChange}
                  showNSGSelector={false}
                  showLocationSelector={false}
                />
                
                {/* Restore Target Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Restore Target
                  </Label>
                  <Select
                    value={restoreScope.targetType}
                    onValueChange={(value) => setRestoreScope(prev => ({ ...prev, targetType: value, selectedResourceGroups: [], selectedNSGs: [] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single Resource Group</SelectItem>
                      <SelectItem value="multiple">Multiple Resource Groups</SelectItem>
                      <SelectItem value="all">All Resource Groups</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Resource Group Selection for Multiple Target Type */}
                {restoreScope.targetType === 'multiple' && filters.selectedSubscription && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Select Resource Groups
                    </Label>
                    
                    {/* Add Resource Group Selector */}
                    <div className="mb-3">
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (value && !restoreScope.selectedResourceGroups.includes(value)) {
                            setRestoreScope(prev => ({
                              ...prev,
                              selectedResourceGroups: [...prev.selectedResourceGroups, value]
                            }));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add resource group..." />
                        </SelectTrigger>
                        <SelectContent>
                          {resourceGroupsData?.resource_groups
                            ?.filter(rg => !restoreScope.selectedResourceGroups.includes(rg.name))
                            ?.map((rg) => (
                              <SelectItem key={rg.name} value={rg.name}>
                                {rg.name}
                              </SelectItem>
                            )) || (
                            <SelectItem value="" disabled>
                              {resourceGroupsLoading ? 'Loading...' : 'No resource groups available'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Selected Resource Groups Display */}
                    <div className="border rounded-lg p-3 bg-slate-50 max-h-32 overflow-y-auto">
                      <div className="text-sm text-slate-600 mb-2">
                        Selected: {restoreScope.selectedResourceGroups.length} resource groups
                      </div>
                      {restoreScope.selectedResourceGroups.length === 0 ? (
                        <div className="text-sm text-slate-500 italic">
                          No resource groups selected
                        </div>
                      ) : (
                        restoreScope.selectedResourceGroups.map((rg, index) => (
                          <div key={index} className="flex items-center justify-between bg-white rounded px-2 py-1 mb-1">
                            <span className="text-sm">{rg}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRestoreScope(prev => ({
                                ...prev,
                                selectedResourceGroups: prev.selectedResourceGroups.filter(g => g !== rg)
                              }))}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              ×
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
                
                {/* NSG Selection Options */}
                {restoreScope.targetType !== 'all' && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="applyToAllNSGs"
                        checked={restoreScope.applyToAllNSGs}
                        onChange={(e) => setRestoreScope(prev => ({ ...prev, applyToAllNSGs: e.target.checked, selectedNSGs: [] }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <label htmlFor="applyToAllNSGs" className="text-sm text-slate-700">
                        Apply to all NSGs in selected resource groups
                      </label>
                    </div>
                    
                    {/* Create New NSGs Option */}
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="createNewNSGs"
                        checked={restoreScope.createNewNSGs}
                        onChange={(e) => setRestoreScope(prev => ({ 
                          ...prev, 
                          createNewNSGs: e.target.checked,
                          newNSGNames: e.target.checked ? [] : prev.newNSGNames
                        }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <label htmlFor="createNewNSGs" className="text-sm text-slate-700">
                        Create new NSGs with custom names
                      </label>
                    </div>
                  </div>
                )}
                
                {/* New NSG Names Configuration */}
                {restoreScope.createNewNSGs && restoreScope.targetType !== 'all' && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      NSG Name Configuration
                    </Label>
                    
                    {/* Add New NSG Name */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <Select
                        value=""
                        onValueChange={(resourceGroup) => {
                          if (resourceGroup) {
                            const newNSGName = `nsg-${resourceGroup}-${Date.now().toString().slice(-4)}`;
                            setRestoreScope(prev => ({
                              ...prev,
                              newNSGNames: [...prev.newNSGNames, { resourceGroup, nsgName: newNSGName }]
                            }));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select resource group" />
                        </SelectTrigger>
                        <SelectContent>
                          {restoreScope.targetType === 'single' && filters.selectedResourceGroup && (
                            <SelectItem value={filters.selectedResourceGroup}>
                              {filters.selectedResourceGroup}
                            </SelectItem>
                          )}
                          {restoreScope.targetType === 'multiple' && restoreScope.selectedResourceGroups.map((rg) => (
                            <SelectItem key={rg} value={rg}>
                              {rg}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const availableRGs = restoreScope.targetType === 'single' 
                            ? [filters.selectedResourceGroup].filter(Boolean)
                            : restoreScope.selectedResourceGroups;
                          
                          if (availableRGs.length > 0) {
                            const resourceGroup = availableRGs[0];
                            const newNSGName = `nsg-${resourceGroup}-${Date.now().toString().slice(-4)}`;
                            setRestoreScope(prev => ({
                              ...prev,
                              newNSGNames: [...prev.newNSGNames, { resourceGroup, nsgName: newNSGName }]
                            }));
                          }
                        }}
                        className="text-sm"
                      >
                        Add NSG
                      </Button>
                    </div>
                    
                    {/* Display Configured NSG Names */}
                    <div className="border rounded-lg p-3 bg-slate-50 max-h-32 overflow-y-auto">
                      <div className="text-sm text-slate-600 mb-2">
                        Configured NSGs: {restoreScope.newNSGNames.length}
                      </div>
                      {restoreScope.newNSGNames.length === 0 ? (
                        <div className="text-sm text-slate-500 italic">
                          No NSGs configured
                        </div>
                      ) : (
                        restoreScope.newNSGNames.map((nsgConfig, index) => (
                          <div key={index} className="flex items-center justify-between bg-white rounded px-2 py-1 mb-1">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <span className="text-sm font-medium">{nsgConfig.resourceGroup}</span>
                              <input
                                type="text"
                                value={nsgConfig.nsgName}
                                onChange={(e) => {
                                  const updatedNames = [...restoreScope.newNSGNames];
                                  updatedNames[index].nsgName = e.target.value;
                                  setRestoreScope(prev => ({ ...prev, newNSGNames: updatedNames }));
                                }}
                                className="text-sm border rounded px-1 py-0.5"
                                placeholder="NSG name"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRestoreScope(prev => ({
                                ...prev,
                                newNSGNames: prev.newNSGNames.filter((_, i) => i !== index)
                              }))}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 ml-2"
                            >
                              ×
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Backup Source */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Upload className="h-4 w-4 text-blue-600" />
                <CardTitle>Backup Source</CardTitle>
              </div>
              <CardDescription>
                Choose the backup source - Azure Storage or upload a CSV file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    Source Type
                  </Label>
                  <Select
                    value={restoreConfig.sourceType}
                    onValueChange={(value) => setRestoreConfig(prev => ({ ...prev, sourceType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="storage">Azure Storage</SelectItem>
                      <SelectItem value="csv">CSV File Upload</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {restoreConfig.sourceType === 'storage' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="restoreStorageAccount" className="text-sm font-medium text-slate-700 mb-2 block">
                        Storage Account
                      </Label>
                      <Select
                        value={restoreConfig.storageAccount}
                        onValueChange={(value) => setRestoreConfig(prev => ({ ...prev, storageAccount: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="thirustorage001">thirustorage001</SelectItem>
                          {storageData?.storage_accounts?.map((account: any) => (
                            <SelectItem key={account.name} value={account.name}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="restoreContainerName" className="text-sm font-medium text-slate-700 mb-2 block">
                        Container Name
                      </Label>
                      <Select
                        value={restoreConfig.containerName}
                        onValueChange={(value) => setRestoreConfig(prev => ({ ...prev, containerName: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select container" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nsg-backups">nsg-backups</SelectItem>
                          {Array.isArray(restoreContainers) && restoreContainers.length > 0 ? (
                            restoreContainers.map((container: any) => {
                              console.log('Rendering container:', container);
                              return (
                                <SelectItem key={container.name} value={container.name}>
                                  {container.name}
                                </SelectItem>
                              );
                            })
                          ) : (
                            console.log('No containers to render, restoreContainers:', restoreContainers) || null
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="backupFileName" className="text-sm font-medium text-slate-700 mb-2 block">
                        Backup File Name
                      </Label>
                      <Select
                        value={restoreConfig.backupFileName}
                        onValueChange={(value) => setRestoreConfig(prev => ({ ...prev, backupFileName: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select backup file" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            console.log('Rendering backup files:', backupFiles);
                            console.log('Backup files length:', backupFiles.length);
                            return backupFiles.length === 0 ? (
                              <SelectItem value="" disabled>
                                No backup files found
                              </SelectItem>
                            ) : (
                              backupFiles.map((file: any) => {
                                console.log('Rendering file:', file);
                                const fileName = file.name || file.id || 'Unknown file';
                                const fileDetails = file.createdAt || file.lastModified ? 
                                  ` (${file.createdAt || file.lastModified}${file.size ? ' • ' + file.size : ''})` : '';
                                return (
                                  <SelectItem key={fileName} value={fileName} title={fileName + fileDetails}>
                                    {fileName}
                                  </SelectItem>
                                );
                              })
                            );
                          })()} 
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {restoreConfig.sourceType === 'csv' && (
                  <div>
                    <Label htmlFor="csvFile" className="text-sm font-medium text-slate-700 mb-2 block">
                      CSV File
                    </Label>
                    <Input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setRestoreConfig(prev => ({ ...prev, csvFile: file }));
                        }
                      }}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {restoreConfig.csvFile && (
                      <p className="text-sm text-slate-600 mt-2">
                        Selected: {restoreConfig.csvFile.name} ({(restoreConfig.csvFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Restore Options */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <CardTitle>Restore Options</CardTitle>
              </div>
              <CardDescription>
                Configure how the restore operation should be performed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="overwriteExisting"
                    checked={restoreConfig.overwriteExisting}
                    onChange={(e) => setRestoreConfig(prev => ({ ...prev, overwriteExisting: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="overwriteExisting" className="text-sm text-slate-700">
                    Overwrite existing NSG rules
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="validateRules"
                    checked={restoreConfig.validateRules}
                    onChange={(e) => setRestoreConfig(prev => ({ ...prev, validateRules: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="validateRules" className="text-sm text-slate-700">
                    Validate rules before applying
                  </label>
                </div>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="createBackupBeforeRestore"
                    checked={restoreConfig.createBackupBeforeRestore}
                    onChange={(e) => setRestoreConfig(prev => ({ ...prev, createBackupBeforeRestore: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="createBackupBeforeRestore" className="text-sm text-slate-700">
                    Create backup before restore
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setRestoreConfig({
                  sourceType: 'storage',
                  storageAccount: 'thirustorage001',
                  containerName: 'nsg-backups',
                  backupFileName: '',
                  csvFile: null,
                  overwriteExisting: false,
                  validateRules: true,
                  createBackupBeforeRestore: true
                });
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={!filters.selectedSubscription || (!restoreConfig.backupFileName && !restoreConfig.csvFile)}
              onClick={handleRestorePreview}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Rules
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              disabled={!filters.selectedSubscription || (!restoreConfig.backupFileName && !restoreConfig.csvFile)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Restore
            </Button>
          </div>
        </form>

        {/* Preview Section */}
        {showPreview && previewData && (
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <CardTitle>Restore Preview</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {isEditMode ? 'View Mode' : 'Edit Mode'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </Button>
                </div>
              </div>
              <CardDescription>
                Review the rules that will be restored. You can edit them before confirming the restore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editableRules && editableRules.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">Restore Summary</h4>
                        <p className="text-sm text-blue-700">
                          {editableRules.length} rules will be restored to the selected resource groups.
                        </p>
                      </div>
                      {isEditMode && (
                        <Button
                          onClick={handleAddRule}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Add Rule
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="p-3 text-left font-medium text-gray-700">Rule Name</th>
                          <th className="p-3 text-left font-medium text-gray-700">Priority</th>
                          <th className="p-3 text-left font-medium text-gray-700">Direction</th>
                          <th className="p-3 text-left font-medium text-gray-700">Access</th>
                          <th className="p-3 text-left font-medium text-gray-700">Protocol</th>
                          <th className="p-3 text-left font-medium text-gray-700">Source</th>
                          <th className="p-3 text-left font-medium text-gray-700">Destination</th>
                          {isEditMode && (
                            <th className="p-3 text-left font-medium text-gray-700">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {editableRules.map((rule: any, index: number) => (
                          <tr key={index} className="border-t hover:bg-gray-50">
                            <td className="p-3 text-sm">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={rule.name || ''}
                                  onChange={(e) => handleRuleChange(index, 'name', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                rule.name || 'N/A'
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              {isEditMode ? (
                                <input
                                  type="number"
                                  value={rule.priority || ''}
                                  onChange={(e) => handleRuleChange(index, 'priority', e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              ) : (
                                rule.priority || 'N/A'
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              {isEditMode ? (
                                <select
                                  value={rule.direction || 'Inbound'}
                                  onChange={(e) => handleRuleChange(index, 'direction', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  <option value="Inbound">Inbound</option>
                                  <option value="Outbound">Outbound</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  rule.direction === 'Inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {rule.direction || 'N/A'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              {isEditMode ? (
                                <select
                                  value={rule.access || 'Allow'}
                                  onChange={(e) => handleRuleChange(index, 'access', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  <option value="Allow">Allow</option>
                                  <option value="Deny">Deny</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  rule.access === 'Allow' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {rule.access || 'N/A'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              {isEditMode ? (
                                <select
                                  value={rule.protocol || 'TCP'}
                                  onChange={(e) => handleRuleChange(index, 'protocol', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  <option value="TCP">TCP</option>
                                  <option value="UDP">UDP</option>
                                  <option value="*">Any</option>
                                </select>
                              ) : (
                                rule.protocol || 'N/A'
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              {isEditMode ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={rule.sourceAddressPrefix || ''}
                                    onChange={(e) => handleRuleChange(index, 'sourceAddressPrefix', e.target.value)}
                                    placeholder="Source IP"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <input
                                    type="text"
                                    value={rule.sourcePortRange || ''}
                                    onChange={(e) => handleRuleChange(index, 'sourcePortRange', e.target.value)}
                                    placeholder="Source Port"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              ) : (
                                <div className="max-w-32 truncate" title={rule.source_address_prefix || 'N/A'}>
                                  {rule.source_address_prefix || 'N/A'}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              {isEditMode ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={rule.destinationAddressPrefix || ''}
                                    onChange={(e) => handleRuleChange(index, 'destinationAddressPrefix', e.target.value)}
                                    placeholder="Destination IP"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                  <input
                                    type="text"
                                    value={rule.destinationPortRange || ''}
                                    onChange={(e) => handleRuleChange(index, 'destinationPortRange', e.target.value)}
                                    placeholder="Destination Port"
                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  />
                                </div>
                              ) : (
                                <div className="max-w-32 truncate" title={rule.destination_address_prefix || 'N/A'}>
                                  {rule.destination_address_prefix || 'N/A'}
                                </div>
                              )}
                            </td>
                            {isEditMode && (
                              <td className="p-3 text-sm">
                                <Button
                                  onClick={() => handleDeleteRule(index)}
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  Delete
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Rules Found</h3>
                  <p className="text-gray-600">
                    {previewData?.preview?.error || "The selected backup file or CSV doesn't contain any rules to restore."}
                  </p>
                  {isEditMode && (
                    <Button
                      onClick={handleAddRule}
                      size="sm"
                      className="mt-4 bg-green-600 hover:bg-green-700 text-white"
                    >
                      Add First Rule
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default RestorePage;