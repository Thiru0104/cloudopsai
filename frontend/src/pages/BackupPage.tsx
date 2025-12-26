import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Download, Calendar, Shield, Database, Clock, Plus, FileText, FileSpreadsheet, RefreshCw, Check, Upload, RotateCcw, Edit, Eye, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import FilterComponent from '../components/FilterComponent';

const BackupPage: React.FC = () => {
  // State for filters
  const [filters, setFilters] = useState({
    selectedSubscription: '',
    selectedResourceGroup: '',
    selectedLocation: '',
    selectedNSG: ''
  });

  // State for backup configuration
  const [backupConfig, setBackupConfig] = useState({
    backupName: '',
    resourceType: 'nsg',
    selectedNSGs: [] as string[],
    selectedASGs: [] as string[],
    storageAccount: 'thirustorage001',
    containerName: 'nsg-backups',
    backupType: 'immediate',
    backupFormat: 'json',
    description: '',
    scheduledDate: '',
    scheduledTime: '',
    frequency: 'once',
    timezone: 'UTC'
  });

  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // State for available NSGs and ASGs
  const [availableNSGs, setAvailableNSGs] = useState<any[]>([]);
  const [availableASGs, setAvailableASGs] = useState<any[]>([]);
  const [showStatusSidebar, setShowStatusSidebar] = useState(false);
  const [backupStatus, setBackupStatus] = useState({
    activeBackups: [],
    completedBackups: [],
    failedBackups: []
  });

  // Fetch NSGs
  const { data: nsgsData, isLoading: nsgsLoading, error: nsgsError } = useQuery({
    queryKey: ['nsgs', filters.selectedSubscription, filters.selectedResourceGroup, filters.selectedLocation],
    queryFn: async () => {
      if (!filters.selectedSubscription) return { nsgs: [] };
      
      try {
        const params = new URLSearchParams({
          subscription_id: filters.selectedSubscription,
          ...(filters.selectedResourceGroup && { resource_group: filters.selectedResourceGroup }),
          ...(filters.selectedLocation && { region: filters.selectedLocation })
        });
        
        const response = await fetch(`/api/v1/nsgs?${params}`);
        if (!response.ok) throw new Error('Failed to fetch NSGs');
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching NSGs:', error);
        return { nsgs: [] };
      }
    },
    enabled: !!filters.selectedSubscription
  });

  // Fetch storage accounts
  const { data: storageData } = useQuery({
    queryKey: ['storage-accounts'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/v1/storage-accounts');
        if (!response.ok) throw new Error('Failed to fetch storage accounts');
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching storage accounts:', error);
        return { storage_accounts: [] };
      }
    }
  });

  // Export mutation for enhanced CSV export
  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'excel') => {
      // Check if any NSGs are selected
      if (backupConfig.selectedNSGs.length === 0) {
        toast.error('Please select at least one NSG to export');
        throw new Error('No NSGs selected');
      }
      
      const exportData = {
        ...filters,
        resourceType: backupConfig.resourceType,
        selectedNSGs: backupConfig.selectedNSGs,
        selectedASGs: backupConfig.selectedASGs,
        format: format === 'csv' ? 'enhanced_csv' : format,
        separateColumns: format === 'csv' ? true : false,
        includeRuleDetails: format === 'csv' ? true : false,
        includeASGMapping: format === 'csv' ? true : false
      };
      
      console.log('Export data:', exportData);
      console.log('Available NSGs:', availableNSGs);
      console.log('Selected NSGs from backupConfig:', backupConfig.selectedNSGs);
      console.log('Filters:', filters);
      
      // Validate that we have the required data before sending
      if (!filters.selectedSubscription) {
        toast.error('Please select a subscription');
        throw new Error('No subscription selected');
      }
      
      // Double check that we have NSGs selected
      if (exportData.selectedNSGs.length === 0) {
        toast.error('Please select at least one NSG to export');
        throw new Error('No NSGs selected for export');
      }
      
      const response = await fetch('/api/v1/backup/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData)
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `enhanced-backup-export-${filters.selectedSubscription?.slice(0, 8) || 'export'}.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Check if it's a ZIP file based on content type or filename
      const contentType = response.headers.get('Content-Type');
      if (contentType === 'application/zip' || filename.endsWith('.zip')) {
        // Handle ZIP file download for multiple NSGs
        console.log('Downloading ZIP file containing multiple NSG exports:', filename);
      } else {
        // Handle single CSV file download
        console.log('Downloading single CSV file:', filename);
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Export completed successfully!');
    },
    onError: (error: any) => {
      toast.error('Export failed: ' + error.message);
    }
  });

  // Create backup mutation
  const backupMutation = useMutation({
    mutationFn: async (backupData: any) => {
      const response = await fetch('/api/v1/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create backup');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const fileExtension = backupConfig.backupFormat === 'csv' ? 'csv' : 'json';
      const fileName = data.backup_file || `backup_nsg_${new Date().toISOString().slice(0,19).replace(/[-:]/g, '').replace('T', '_')}.${fileExtension}`;
      toast.success(`Backup created successfully! File: ${fileName}`);
      // Reset form
      setBackupConfig({
        backupName: '',
        resourceType: 'nsg',
        selectedNSGs: [],
        selectedASGs: [],
        storageAccount: 'thirustorage001',
        containerName: 'nsg-backups',
        backupType: 'immediate',
        backupFormat: 'json',
        description: '',
        scheduledDate: '',
        scheduledTime: '',
        frequency: 'once',
        timezone: 'UTC'
      });
    },
    onError: (error: any) => {
      toast.error('Failed to create backup: ' + error.message);
    }
  });
   
   // Event handlers
   const handleFilterChange = (newFilters: typeof filters) => {
     setFilters(newFilters);
   };
   
   const handleNSGSelection = (nsgName: string, selected: boolean) => {
     setBackupConfig(prev => ({
       ...prev,
       selectedNSGs: selected 
         ? [...prev.selectedNSGs, nsgName]
         : prev.selectedNSGs.filter(name => name !== nsgName)
     }));
    };
   
   const handleBackupSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     
     const backupData = {
       backup_name: backupConfig.backupName,
       resource_type: backupConfig.resourceType,
       subscription_id: filters.selectedSubscription,
       resource_group: filters.selectedResourceGroup,
       selected_nsgs: backupConfig.selectedNSGs,
       selected_asgs: backupConfig.selectedASGs,
       storage_account: backupConfig.storageAccount,
       container_name: backupConfig.containerName,
       backup_type: backupConfig.backupType,
       backup_format: backupConfig.backupFormat,
       description: backupConfig.description,
       scheduled_date: backupConfig.scheduledDate,
       scheduled_time: backupConfig.scheduledTime,
       frequency: backupConfig.frequency,
       timezone: backupConfig.timezone
     };
     
     backupMutation.mutate(backupData);
   };
   
   // Update available NSGs when data changes
   useEffect(() => {
     if (nsgsData?.nsgs) {
       setAvailableNSGs(nsgsData.nsgs);
     }
   }, [nsgsData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Backup Management</h1>
            <p className="text-gray-600">
              Configure automated backups for your network security groups and application security groups.
            </p>
          </div>
          <Button
            onClick={() => setShowStatusSidebar(!showStatusSidebar)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            {showStatusSidebar ? 'Hide' : 'Show'} Status
          </Button>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 space-y-6">
          {/* Content */}
          <form onSubmit={handleBackupSubmit} className="space-y-6">
            {/* Backup Scope */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <CardTitle>Backup Scope</CardTitle>
                </div>
                <CardDescription>
                  Select the subscription, resource group, and resources to backup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FilterComponent
                  selectedSubscription={filters.selectedSubscription}
                  selectedResourceGroup={filters.selectedResourceGroup}
                  selectedLocation={filters.selectedLocation}
                  selectedNSG={filters.selectedNSG}
                  onFilterChange={handleFilterChange}
                />
              </CardContent>
            </Card>

            {/* Resource Selection */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <CardTitle>Resource Selection</CardTitle>
                </div>
                <CardDescription>
                  Choose which Network Security Groups and Application Security Groups to backup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Resource Type
                    </Label>
                    <Select
                      value={backupConfig.resourceType}
                      onValueChange={(value) => setBackupConfig(prev => ({ ...prev, resourceType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nsg">Network Security Groups</SelectItem>
                        <SelectItem value="asg">Application Security Groups</SelectItem>
                        <SelectItem value="both">Both NSG and ASG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(backupConfig.resourceType === 'nsg' || backupConfig.resourceType === 'both') && (
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">
                        Network Security Groups ({availableNSGs.length} available)
                      </Label>
                      <div className="max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                        {nsgsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            Loading NSGs...
                          </div>
                        ) : availableNSGs.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">
                            {filters.selectedSubscription ? 'No NSGs found in selected scope' : 'Please select a subscription first'}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {availableNSGs.map((nsg: any) => (
                              <div key={nsg.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={nsg.name}
                                  checked={backupConfig.selectedNSGs.includes(nsg.name)}
                                  onChange={(e) => handleNSGSelection(nsg.name, e.target.checked)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Label htmlFor={nsg.name} className="text-sm text-slate-700 cursor-pointer">
                                  {nsg.name} ({nsg.resource_group})
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced CSV Export */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  Enhanced CSV Export
                </CardTitle>
                <CardDescription>
                  Export NSG and ASG data with detailed rule information in CSV format.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {/* Selection Summary */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          Selected for Export:
                        </span>
                      </div>
                      <div className="text-sm text-blue-700">
                        {backupConfig.selectedNSGs.length} NSG{backupConfig.selectedNSGs.length !== 1 ? 's' : ''}
                        {backupConfig.selectedNSGs.length > 1 && ' (ZIP download)'}
                      </div>
                    </div>
                    {backupConfig.selectedNSGs.length > 0 && (
                      <div className="mt-2 text-xs text-blue-600">
                        {backupConfig.selectedNSGs.slice(0, 3).map(nsgId => {
                          const nsg = availableNSGs.find(n => n.id === nsgId);
                          return nsg ? nsg.name : nsgId;
                        }).join(', ')}
                        {backupConfig.selectedNSGs.length > 3 && ` and ${backupConfig.selectedNSGs.length - 3} more...`}
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    variant="default" 
                    type="button"
                    onClick={() => {
                      if (!filters.selectedSubscription) {
                        toast.error('Please select a subscription first');
                        return;
                      }
                      if (backupConfig.selectedNSGs.length === 0) {
                        toast.error('Please select at least one NSG to export');
                        return;
                      }
                      exportMutation.mutate('csv');
                    }}
                    disabled={exportMutation.isPending || !filters.selectedSubscription || backupConfig.selectedNSGs.length === 0}
                    className="flex items-center justify-center space-x-2 h-12 bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                  >
                    <Download className="h-5 w-5" />
                    <div className="flex flex-col items-start">
                      <span className="font-medium">
                        {backupConfig.selectedNSGs.length > 1 ? 'Download ZIP' : 'Enhanced CSV'}
                      </span>
                      <span className="text-xs text-white/80">
                        {backupConfig.selectedNSGs.length > 1 
                          ? `${backupConfig.selectedNSGs.length} NSGs as ZIP` 
                          : 'NSG & ASG columns'
                        }
                      </span>
                    </div>
                    {exportMutation.isPending && (
                      <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                    )}
                  </Button>
                  
                  {/* Export Information */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Export Information</h4>
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li>• Enhanced CSV: NSG and ASG data in separate columns</li>
                      <li>• Includes security rules, ASG mappings, and compliance data</li>
                      <li>• All exports filtered by your current selection criteria</li>
                    </ul>
                  </div>
                  
                  {/* Export Status */}
                  {!filters.selectedSubscription ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">!</span>
                        </div>
                        <p className="text-sm text-yellow-800">Please select a subscription to enable export functionality.</p>
                      </div>
                    </div>
                  ) : backupConfig.selectedNSGs.length === 0 ? (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">!</span>
                        </div>
                        <p className="text-sm text-orange-800">Please select at least one NSG from the Resource Selection section above.</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Backup Configuration */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4 text-blue-600" />
                  <CardTitle>Backup Configuration</CardTitle>
                </div>
                <CardDescription>
                  Configure backup settings and storage options.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="backupName" className="text-sm font-medium text-slate-700 mb-2 block">
                      Backup Name
                    </Label>
                    <Input
                      id="backupName"
                      value={backupConfig.backupName}
                      onChange={(e) => setBackupConfig(prev => ({ ...prev, backupName: e.target.value }))}
                      placeholder="Enter backup name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="storageAccount" className="text-sm font-medium text-slate-700 mb-2 block">
                      Storage Account
                    </Label>
                    <Select
                      value={backupConfig.storageAccount}
                      onValueChange={(value) => setBackupConfig(prev => ({ ...prev, storageAccount: value }))}
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
                    <Label htmlFor="containerName" className="text-sm font-medium text-slate-700 mb-2 block">
                      Container Name
                    </Label>
                    <Input
                      id="containerName"
                      value={backupConfig.containerName}
                      onChange={(e) => setBackupConfig(prev => ({ ...prev, containerName: e.target.value }))}
                      placeholder="nsg-backups"
                    />
                  </div>

                  <div>
                    <Label htmlFor="backupFormat" className="text-sm font-medium text-slate-700 mb-2 block">
                      Backup Format
                    </Label>
                    <Select
                      value={backupConfig.backupFormat}
                      onValueChange={(value) => setBackupConfig(prev => ({ ...prev, backupFormat: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-full">
                    <Label htmlFor="description" className="text-sm font-medium text-slate-700 mb-2 block">
                      Description (Optional)
                    </Label>
                    <Input
                      id="description"
                      value={backupConfig.description}
                      onChange={(e) => setBackupConfig(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe this backup..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Backup Schedule */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <CardTitle>Backup Schedule</CardTitle>
                </div>
                <CardDescription>
                  Configure when and how often backups should run.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">Frequency</Label>
                    <Select 
                      value={backupConfig.frequency} 
                      onValueChange={(value) => setBackupConfig(prev => ({ ...prev, frequency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">One Time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">Timezone</Label>
                    <Select 
                      value={backupConfig.timezone} 
                      onValueChange={(value) => setBackupConfig(prev => ({ ...prev, timezone: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="EST">Eastern Time</SelectItem>
                        <SelectItem value="PST">Pacific Time</SelectItem>
                        <SelectItem value="CST">Central Time</SelectItem>
                        <SelectItem value="MST">Mountain Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {backupConfig.frequency !== 'once' && (
                    <>
                      <div>
                        <Label className="text-sm font-medium text-slate-700 mb-2 block">Start Date</Label>
                        <div className="relative">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            onClick={() => setShowCalendar(!showCalendar)}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {selectedDate ? selectedDate.toLocaleDateString() : 'Select date'}
                          </Button>
                          {showCalendar && (
                            <div className="absolute bottom-full left-0 mb-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[300px]">
                              <div className="flex items-center justify-between mb-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (currentMonth === 0) {
                                      setCurrentMonth(11);
                                      setCurrentYear(currentYear - 1);
                                    } else {
                                      setCurrentMonth(currentMonth - 1);
                                    }
                                  }}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <h3 className="text-sm font-medium">
                                  {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h3>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (currentMonth === 11) {
                                      setCurrentMonth(0);
                                      setCurrentYear(currentYear + 1);
                                    } else {
                                      setCurrentMonth(currentMonth + 1);
                                    }
                                  }}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                  <div key={day} className="p-2 font-medium text-gray-500">{day}</div>
                                ))}
                                {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }, (_, i) => (
                                  <div key={i} className="p-2"></div>
                                ))}
                                {Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, i) => {
                                  const date = new Date(currentYear, currentMonth, i + 1);
                                  const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                                  const isToday = date.toDateString() === new Date().toDateString();
                                  return (
                                    <Button
                                      key={i}
                                      type="button"
                                      variant={isSelected ? "default" : "ghost"}
                                      size="sm"
                                      className={`p-2 h-8 w-8 text-xs ${
                                        isToday ? 'bg-blue-100 text-blue-600' : ''
                                      } ${isSelected ? 'bg-blue-600 text-white' : ''}`}
                                      onClick={() => {
                                        setSelectedDate(date);
                                        setBackupConfig(prev => ({ ...prev, scheduledDate: date.toISOString().split('T')[0] }));
                                        setShowCalendar(false);
                                      }}
                                    >
                                      {i + 1}
                                    </Button>
                                  );
                                })}
                              </div>
                              <div className="flex justify-end gap-2 mt-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowCalendar(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setShowCalendar(false)}
                                >
                                  Done
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-slate-700 mb-2 block">Start Time</Label>
                        <Input
                          type="time"
                          value={backupConfig.scheduledTime}
                          onChange={(e) => setBackupConfig(prev => ({ ...prev, scheduledTime: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                </div>

                {backupConfig.frequency !== 'once' && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Schedule Summary</span>
                    </div>
                    <div className="mt-2 text-sm text-blue-800">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-600">Frequency:</span>
                        <span className="font-medium capitalize">{backupConfig.frequency}</span>
                        {selectedDate && (
                          <>
                            <span className="text-gray-600">Start Date:</span>
                            <span className="font-medium">{selectedDate.toLocaleDateString()}</span>
                          </>
                        )}
                        {backupConfig.scheduledTime && (
                          <>
                            <span className="text-gray-600">Time:</span>
                            <span className="font-medium">{backupConfig.scheduledTime}</span>
                          </>
                        )}
                        <span className="text-gray-600">Timezone:</span>
                        <span className="font-medium">{backupConfig.timezone}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setBackupConfig({
                    backupName: '',
                    resourceType: 'nsg',
                    selectedNSGs: [],
                    selectedASGs: [],
                    storageAccount: 'thirustorage001',
                    containerName: 'nsg-backups',
                    backupType: 'immediate',
                    backupFormat: 'json',
                    description: '',
                    scheduledDate: '',
                    scheduledTime: '',
                    frequency: 'once',
                    timezone: 'UTC'
                  });
                }}
              >
                Reset
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={!backupConfig.backupName || !filters.selectedSubscription || backupMutation.isPending}
              >
                {backupMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Create Backup
              </Button>
            </div>
          </form>
          </div>
          
          {/* Status Monitoring Sidebar */}
          {showStatusSidebar && (
            <div className="w-80 space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Backup Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Active Backups */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                      Active ({backupStatus.activeBackups.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {backupStatus.activeBackups.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No active backups</p>
                      ) : (
                        backupStatus.activeBackups.map((backup: any, index: number) => (
                          <div key={index} className="bg-blue-50 p-2 rounded text-xs">
                            <div className="font-medium">{backup.name}</div>
                            <div className="text-gray-600">{backup.progress}% complete</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Completed Backups */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Completed ({backupStatus.completedBackups.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {backupStatus.completedBackups.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No completed backups</p>
                      ) : (
                        backupStatus.completedBackups.slice(0, 3).map((backup: any, index: number) => (
                          <div key={index} className="bg-green-50 p-2 rounded text-xs">
                            <div className="font-medium">{backup.name}</div>
                            <div className="text-gray-600">{backup.completedAt}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Failed Backups */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Failed ({backupStatus.failedBackups.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {backupStatus.failedBackups.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No failed backups</p>
                      ) : (
                        backupStatus.failedBackups.slice(0, 3).map((backup: any, index: number) => (
                          <div key={index} className="bg-red-50 p-2 rounded text-xs">
                            <div className="font-medium">{backup.name}</div>
                            <div className="text-gray-600">{backup.error}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupPage;
