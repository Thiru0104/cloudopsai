import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Download, Database, Search, RefreshCw, Filter, ChevronDown, Eye, Box } from 'lucide-react';
import { apiClient } from '../config/api';
import * as XLSX from 'xlsx';

interface StorageAccountReport {
  subscription_name: string;
  subscription_id: string;
  storage_account: string;
  resource_group: string;
  total_size_gb: number;
  last_activity: string;
  status: string;
  sku: string;
  location: string;
  container_count: number;
  archive_recommendation: string;
}

interface ContainerReport {
  subscription_name: string;
  subscription_id: string;
  storage_account: string;
  resource_group: string;
  location: string;
  container_name: string;
  total_size_gb: number;
  last_activity: string;
  status: string;
  archive_recommendation: string;
  blob_count: number;
}

const formatSize = (gb: number) => {
    if (gb === 0) return "0 B";
    if (gb < 0.000001) return `${(gb * 1024 * 1024 * 1024).toFixed(0)} B`;
    if (gb < 0.001) return `${(gb * 1024 * 1024).toFixed(2)} KB`;
    if (gb < 1) return `${(gb * 1024).toFixed(2)} MB`;
    return `${gb.toFixed(2)} GB`;
};

const StoragePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'accounts' | 'containers'>('accounts');

  // Data
  const [accountsData, setAccountsData] = useState<StorageAccountReport[]>([]);
  const [containersData, setContainersData] = useState<ContainerReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Cache tracking
  const lastAccountsParams = useRef<string>('');
  const lastContainersParams = useRef<string>('');

  // Filters
  const [selectedSubscription, setSelectedSubscription] = useState<string>(searchParams.get('subscription') || 'All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedResourceGroup, setSelectedResourceGroup] = useState<string>('All');
  // Account filter for containers tab (optional, if coming from eye icon)
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>(searchParams.get('account') || 'All');

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Filter Options
  const [filterOptions, setFilterOptions] = useState<{
      subscriptions: {id: string, label: string}[];
      regions: string[];
      resourceGroups: string[];
      accounts: string[];
  }>({ subscriptions: [], regions: [], resourceGroups: [], accounts: [] });
  
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Initialize from URL params if present
  useEffect(() => {
      const tab = searchParams.get('tab');
      if (tab === 'containers') {
          setActiveTab('containers');
      }
      const account = searchParams.get('account');
      if (account) {
          setSelectedAccountFilter(account);
      }
  }, []); // Run once on mount

  const fetchData = async (isInitial = false) => {
    
    const params: any = {};
    if (!isInitial) {
        if (selectedSubscription !== 'All') params.subscription_id = selectedSubscription;
        if (selectedRegion !== 'All') params.region = selectedRegion;
        if (selectedResourceGroup !== 'All') params.resource_group = selectedResourceGroup;
    }
    const accountsParamsStr = JSON.stringify(params);

    let shouldFetchAccounts = isInitial || accountsParamsStr !== lastAccountsParams.current || accountsData.length === 0;
    
    let shouldFetchContainers = false;
    let containersParamsStr = '';
    
    if (activeTab === 'containers') {
        const containerParams: any = { ...params };
        if (selectedAccountFilter !== 'All') {
            containerParams.account_name = selectedAccountFilter;
        }
        containersParamsStr = JSON.stringify(containerParams);
        // Fetch if params changed OR if we have no data yet
        shouldFetchContainers = containersParamsStr !== lastContainersParams.current || containersData.length === 0;
    }

    // If nothing needs fetching, return early
    if (!shouldFetchAccounts && !shouldFetchContainers) {
        return;
    }

    setLoading(true);
    setError(null);
    try {
      // Always fetch accounts to populate filters and account tab
      if (shouldFetchAccounts) {
          const accountsResponse = await apiClient.get('/api/v1/storage/report', params);
          const accountsReport = accountsResponse.report || [];
          setAccountsData(accountsReport);
          lastAccountsParams.current = accountsParamsStr;

          if (isInitial) {
              const subsMap = new Map();
              const regsSet = new Set<string>();
              const rgsSet = new Set<string>();
              const accsSet = new Set<string>();

              accountsReport.forEach((item: any) => {
                  if (item.subscription_id) {
                      subsMap.set(item.subscription_id, item.subscription_name || item.subscription_id);
                  }
                  if (item.location) regsSet.add(item.location);
                  if (item.resource_group) rgsSet.add(item.resource_group);
                  if (item.storage_account) accsSet.add(item.storage_account);
              });
              
              const subs = Array.from(subsMap.entries()).map(([id, name]) => ({ id: id, label: name }));
              const regs = Array.from(regsSet).filter(Boolean).sort();
              const rgs = Array.from(rgsSet).filter(Boolean).sort();
              const accs = Array.from(accsSet).sort();

              setFilterOptions({
                  subscriptions: subs,
                  regions: regs,
                  resourceGroups: rgs,
                  accounts: accs
              });
              setInitialLoadComplete(true);
          }
      }

      // If on containers tab, fetch containers
      if (shouldFetchContainers) {
          const containerParams: any = { ...params };
          if (selectedAccountFilter !== 'All') {
              containerParams.account_name = selectedAccountFilter;
          }
          const containersResponse = await apiClient.get('/api/v1/storage/containers', containerParams);
          setContainersData(containersResponse.report || []);
          lastContainersParams.current = containersParamsStr;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  useEffect(() => {
    if (initialLoadComplete) {
        fetchData(false);
    }
  }, [selectedSubscription, selectedRegion, selectedResourceGroup, activeTab, selectedAccountFilter]);

  const handleTabChange = (tab: 'accounts' | 'containers') => {
      setActiveTab(tab);
      // Update URL without reloading
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', tab);
      if (tab === 'accounts') {
          newParams.delete('account'); // Clear account filter when going back to main list
          setSelectedAccountFilter('All');
      }
      setSearchParams(newParams);
  };

  const handleViewContainers = (accountName: string) => {
      setSelectedAccountFilter(accountName);
      handleTabChange('containers');
  };

  const handleDownload = () => {
    if (activeTab === 'accounts') {
        const worksheet = XLSX.utils.json_to_sheet(accountsData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Storage Accounts");
        XLSX.writeFile(workbook, "StorageAccountsReport.xlsx");
    } else {
        const worksheet = XLSX.utils.json_to_sheet(containersData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Containers");
        XLSX.writeFile(workbook, "ContainersReport.xlsx");
    }
  };

  const filteredAccounts = accountsData.filter(item => 
    item.storage_account.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.resource_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredContainers = containersData.filter(item =>
      item.container_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.storage_account.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const FilterButton = ({ 
    label, 
    value, 
    dropdownId,
    options = []
  }: { 
    label: string, 
    value: string, 
    dropdownId: string,
    options: (string | {id: string, label: string})[]
  }) => {
    const isOpen = openDropdown === dropdownId;
    
    const getDisplayLabel = (val: string) => {
        if (val === 'All') return 'All';
        if (typeof options[0] === 'object') {
            const opt = (options as {id: string, label: string}[]).find(o => o.id === val);
            return opt ? opt.label : val;
        }
        return val;
    };

    const handleSelect = (val: string) => {
        if (dropdownId === 'subscription') setSelectedSubscription(val);
        if (dropdownId === 'region') setSelectedRegion(val);
        if (dropdownId === 'rg') setSelectedResourceGroup(val);
        if (dropdownId === 'account') setSelectedAccountFilter(val);
        setOpenDropdown(null);
    };

    return (
      <div className="relative">
        <button 
          onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
          className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <span className="font-medium text-slate-500">{label}:</span>
          <span className="font-semibold text-slate-800 max-w-[150px] truncate">{getDisplayLabel(value)}</span>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
            <div 
              className={`px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm ${value === 'All' ? 'font-bold text-blue-600' : 'text-slate-700'}`}
              onClick={() => handleSelect('All')}
            >
              All
            </div>
            {options.map((opt) => {
              const optValue = typeof opt === 'string' ? opt : opt.id;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              return (
                <div 
                    key={optValue}
                    className={`px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm ${value === optValue ? 'font-bold text-blue-600' : 'text-slate-700'}`}
                    onClick={() => handleSelect(optValue)}
                >
                    {optLabel}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" onClick={() => setOpenDropdown(null)}>
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-6">
            <button 
                onClick={() => handleTabChange('accounts')}
                className={`text-2xl font-bold tracking-tight transition-colors ${activeTab === 'accounts' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Storage Accounts
            </button>
            <button 
                onClick={() => handleTabChange('containers')}
                className={`text-2xl font-bold tracking-tight transition-colors ${activeTab === 'containers' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Containers
            </button>
        </div>
        <div className="flex space-x-2">
            <button 
                onClick={() => fetchData(false)} 
                className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
                disabled={loading}
            >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
            </button>
            <button 
                onClick={handleDownload}
                className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                disabled={(activeTab === 'accounts' ? accountsData.length : containersData.length) === 0}
            >
                <Download className="w-4 h-4 mr-2" />
                Download Excel
            </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center text-slate-500 mr-2">
          <Filter className="h-4 w-4 mr-1" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <FilterButton 
            label="Subscriptions" 
            value={selectedSubscription} 
            dropdownId="subscription"
            options={filterOptions.subscriptions}
          />
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <FilterButton 
            label="Region" 
            value={selectedRegion} 
            dropdownId="region"
            options={filterOptions.regions}
          />
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <FilterButton 
            label="Resource Group" 
            value={selectedResourceGroup} 
            dropdownId="rg"
            options={filterOptions.resourceGroups}
          />
        </div>

        {activeTab === 'containers' && (
            <div onClick={(e) => e.stopPropagation()}>
                <FilterButton 
                    label="Storage Account" 
                    value={selectedAccountFilter} 
                    dropdownId="account"
                    options={filterOptions.accounts}
                />
            </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{activeTab === 'accounts' ? 'Storage Accounts List' : 'Containers List'}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                placeholder={activeTab === 'accounts' ? "Search storage accounts..." : "Search containers..."}
                className="pl-8 h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
             </div>
          ) : error ? (
            <div className="text-red-500 p-4 text-center">
              {error}
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-slate-50 p-6">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    {activeTab === 'accounts' ? (
                        <>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Subscription Name</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Subscription ID</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Storage Account</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Resource Group</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Total Size</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Last Activity</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Status</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">SKU</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Location</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Container Count</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Archive Rec.</th>
                        </>
                    ) : (
                        <>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Subscription Name</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Subscription ID</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Storage Account</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Resource Group</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Region</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Container Name</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Total Size</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Blob Count</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Last Activity</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Status</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 z-10 bg-slate-100">Archive Rec.</th>
                        </>
                    )}
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0 bg-white">
                    {activeTab === 'accounts' ? (
                        filteredAccounts.length === 0 ? (
                            <tr><td colSpan={12} className="h-24 text-center text-slate-500">No storage accounts found.</td></tr>
                        ) : (
                            filteredAccounts.map((item, index) => (
                                <tr key={index} className="border-b transition-colors hover:bg-slate-50">
                                    <td className="p-4 align-middle">{item.subscription_name}</td>
                                    <td className="p-4 align-middle font-mono text-xs">{item.subscription_id}</td>
                                    <td className="p-4 align-middle font-medium">{item.storage_account}</td>
                                    <td className="p-4 align-middle">{item.resource_group}</td>
                                    <td className="p-4 align-middle">{formatSize(item.total_size_gb)}</td>
                                    <td className="p-4 align-middle">{item.last_activity}</td>
                                    <td className="p-4 align-middle">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                            item.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle">{item.sku}</td>
                                    <td className="p-4 align-middle">{item.location}</td>
                                    <td className="p-4 align-middle">{item.container_count}</td>
                                    <td className="p-4 align-middle">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                            item.archive_recommendation === 'Yes' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                                        }`}>
                                            {item.archive_recommendation}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )
                    ) : (
                        filteredContainers.length === 0 ? (
                            <tr><td colSpan={11} className="h-24 text-center text-slate-500">No containers found.</td></tr>
                        ) : (
                            filteredContainers.map((item, index) => (
                                <tr key={index} className="border-b transition-colors hover:bg-slate-50">
                                    <td className="p-4 align-middle">{item.subscription_name}</td>
                                    <td className="p-4 align-middle font-mono text-xs">{item.subscription_id}</td>
                                    <td className="p-4 align-middle font-semibold text-slate-700">{item.storage_account}</td>
                                    <td className="p-4 align-middle">{item.resource_group}</td>
                                    <td className="p-4 align-middle">{item.location}</td>
                                    <td className="p-4 align-middle font-medium">{item.container_name}</td>
                                    <td className="p-4 align-middle text-slate-600">{formatSize(item.total_size_gb)}</td>
                                    <td className="p-4 align-middle text-slate-600">{item.blob_count}</td>
                                    <td className="p-4 align-middle text-slate-600">
                                        {item.last_activity === 'Unknown' ? (
                                            <span className="text-slate-400 italic">Unknown</span>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span>{item.last_activity.split(' ')[0]}</span>
                                                <span className="text-xs text-slate-400">{item.last_activity.split(' ')[1]}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 align-middle">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            item.status === 'Active' 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            item.archive_recommendation === 'Yes' 
                                            ? 'bg-blue-100 text-blue-800' 
                                            : 'bg-slate-100 text-slate-800'
                                        }`}>
                                            {item.archive_recommendation}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )
                    )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StoragePage;