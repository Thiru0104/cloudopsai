import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { 
  Shield, 
  Server, 
  Database, 
  Globe, 
  Lock, 
  Activity, 
  Map as MapIcon,
  Filter,
  ChevronDown
} from 'lucide-react';
import { apiClient } from '../config/api';

// Types
interface DashboardMetrics {
  live_connections: number;
  nsg_rules: number;
  security_groups: number;
  security_alerts: number;
  timeline?: TimelineItem[];
}

interface TimelineItem {
  timestamp: string;
  error: number;
  warning: number;
  critical: number;
}

interface Summary {
  virtual_machines: number;
  storage_accounts: number;
  web_apps: number;
  nsgs: number;
  wafs: number;
  key_vaults: number;
}

interface VM {
  name: string;
  location: string;
  resource_group: string;
  provisioning_state: string;
  vm_size: string;
  os_type: string;
}

interface StorageAccount {
  name: string;
  location: string;
  resource_group: string;
  provisioning_state: string;
  kind: string;
  sku: string;
}

interface Subscription {
  id: string;
  display_name: string;
  state: string;
}

interface FilterOptions {
  regions: string[];
  resource_groups: string[];
  vms: string[];
}

interface DashboardData {
  summary: Summary;
  resources: {
    vms: VM[];
    storage_accounts: StorageAccount[];
  };
  metrics: DashboardMetrics;
  recent_activity: RecentActivity[];
  system_status: SystemStatus;
  statistics: {
    total_subscriptions: number;
    total_resource_groups: number;
    total_nsgs: number;
    active_nsgs: number;
    total_rules: number;
  };
  subscription_breakdown: SubscriptionMetrics[];
  available_subscriptions: Subscription[];
  filter_options: FilterOptions;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

interface SystemStatus {
  api_status: 'online' | 'offline' | 'degraded';
  db_status: 'online' | 'offline' | 'degraded';
  last_updated: string;
}

interface SubscriptionMetrics {
  subscription_id: string;
  subscription_name: string;
  nsg_count: number;
  rule_count: number;
}

const DashboardPage: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [selectedSubscription, setSelectedSubscription] = useState<string>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedRG, setSelectedRG] = useState<string>('All');
  const [selectedVM, setSelectedVM] = useState<string>('All');
  const [selectedInterval, setSelectedInterval] = useState<string>('24h');

  // Dropdown visibility states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedSubscription, selectedRegion, selectedRG, selectedVM, selectedInterval]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedSubscription !== 'All') params.subscription_id = selectedSubscription;
      if (selectedRegion !== 'All') params.region = selectedRegion;
      if (selectedRG !== 'All') params.resource_group = selectedRG;
      if (selectedVM !== 'All') params.vm_name = selectedVM;
      params.time_range = selectedInterval;

      const data = await apiClient.get('/api/v1/dashboard', params);
      setDashboardData(data);
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (type: string, value: string) => {
    switch (type) {
      case 'subscription':
        setSelectedSubscription(value);
        setSelectedRegion('All');
        setSelectedRG('All');
        setSelectedVM('All');
        break;
      case 'region':
        setSelectedRegion(value);
        break;
      case 'rg':
        setSelectedRG(value);
        break;
      case 'vm':
        setSelectedVM(value);
        break;
      case 'interval':
        setSelectedInterval(value);
        break;
    }
    setOpenDropdown(null);
  };

  // Use real data if available, otherwise 0
  const stats = [
    { label: 'Virtual Machines', value: dashboardData?.summary?.virtual_machines || 0, color: '#2563eb', icon: Server }, // blue-600
    { label: 'Storage Accounts', value: dashboardData?.summary?.storage_accounts || 0, color: '#4f46e5', icon: Database }, // indigo-600
    { label: 'Web Apps', value: dashboardData?.summary?.web_apps || 0, color: '#3b82f6', icon: Globe }, // blue-500
    { label: "NSG's", value: dashboardData?.summary?.nsgs || 0, color: '#475569', icon: Shield }, // slate-600
    { label: 'WAF', value: dashboardData?.summary?.wafs || 0, color: '#f97316', icon: Activity }, // orange-500
    { label: 'Key Vaults', value: dashboardData?.summary?.key_vaults || 0, color: '#0d9488', icon: Lock }, // teal-600
  ];

  const vms = dashboardData?.resources?.vms || [];
  const storageAccounts = dashboardData?.resources?.storage_accounts || [];

  const FilterButton = ({ 
    label, 
    value, 
    dropdownId,
    options = []
  }: { 
    label: string, 
    value: string, 
    dropdownId?: string,
    options?: string[] | {id: string, label: string}[]
  }) => {
    const isOpen = openDropdown === dropdownId;
    
    return (
      <div className="relative">
        <button 
          onClick={() => dropdownId && setOpenDropdown(isOpen ? null : dropdownId)}
          className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <span className="font-medium text-slate-500">{label}:</span>
          <span className="font-semibold text-slate-800 max-w-[150px] truncate">{value}</span>
          {dropdownId && <ChevronDown className="h-3 w-3 text-slate-400" />}
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
            <div 
              className={`px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm ${value === 'All' ? 'font-bold text-blue-600' : 'text-slate-700'}`}
              onClick={() => handleFilterChange(dropdownId, 'All')}
            >
              All
            </div>
            {options?.map((opt: any) => {
              const optValue = typeof opt === 'string' ? opt : opt.id;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              return (
                <div 
                  key={optValue}
                  className={`px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm ${value === optValue ? 'font-bold text-blue-600' : 'text-slate-700'}`}
                  onClick={() => handleFilterChange(dropdownId, optValue)}
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
    <div className="space-y-6 animate-fade-in p-2">
      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center" onClick={() => setOpenDropdown(null)}>
        <div className="flex items-center text-slate-500 mr-2" onClick={(e) => e.stopPropagation()}>
          <Filter className="h-4 w-4 mr-1" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
           <FilterButton 
             label="Interval" 
             value={selectedInterval} 
             dropdownId="interval"
             options={['1h', '24h', '7d', '30d']}
           />
        </div>
        
        <div onClick={(e) => e.stopPropagation()}>
          <FilterButton 
            label="Subscriptions" 
            value={selectedSubscription === 'All' ? 'All' : dashboardData?.available_subscriptions?.find(s => s.id === selectedSubscription)?.display_name || selectedSubscription} 
            dropdownId="subscription"
            options={dashboardData?.available_subscriptions?.map(s => ({id: s.id, label: s.display_name}))}
          />
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <FilterButton 
            label="Region" 
            value={selectedRegion} 
            dropdownId="region"
            options={dashboardData?.filter_options?.regions}
          />
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <FilterButton 
            label="Resource Group" 
            value={selectedRG} 
            dropdownId="rg"
            options={dashboardData?.filter_options?.resource_groups}
          />
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <FilterButton 
            label="Virtual Machine" 
            value={selectedVM} 
            dropdownId="vm"
            options={dashboardData?.filter_options?.vms}
          />
        </div>
        
        <div className="ml-auto flex items-center space-x-2">
           <button className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
             Other Azure Services
           </button>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="border-t-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderTopColor: stat.color }}>
            <CardContent className="p-4 text-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</div>
              <div className="text-4xl font-bold text-slate-700">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Incident Timeline */}
      <Card className="shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Azure resources with Incidents</h3>
        </div>
        <CardContent className="p-6">
          <div className="h-24 w-full flex items-end justify-between space-x-1 relative">
             {dashboardData?.metrics?.timeline && dashboardData.metrics.timeline.length > 0 ? (
                (() => {
                  const timeline = dashboardData.metrics.timeline || [];
                  const maxCount = Math.max(...timeline.map(t => (t.error || 0) + (t.warning || 0) + (t.critical || 0)), 1);
                  
                  return timeline.map((item, i) => {
                    const count = (item.error || 0) + (item.warning || 0) + (item.critical || 0);
                    const height = Math.min((count / maxCount) * 80, 80); // Max height 80px
                    const date = new Date(item.timestamp);
                    const timeLabel = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:00`;
                    
                    let color = 'bg-green-500';
                    if (item.critical > 0) color = 'bg-red-500';
                    else if (item.error > 0) color = 'bg-orange-500';
                    else if (item.warning > 0) color = 'bg-yellow-500';
                    
                    return (
                     <div key={i} className="flex-1 flex flex-col justify-end group relative" title={`${timeLabel}: ${count} incidents`}>
                       {count > 0 && (
                         <div 
                            className={`w-full rounded-t ${color}`} 
                            style={{ height: `${Math.max(height, 4)}px` }}
                          />
                       )}
                       <div className="h-px bg-slate-200 w-full mt-1"></div>
                       {i % Math.ceil(timeline.length / 6) === 0 && (
                         <div className="absolute -bottom-6 left-0 text-[10px] text-slate-400 whitespace-nowrap">
                           {timeLabel}
                         </div>
                       )}
                     </div>
                   );
                  });
                })()
             ) : (
                <div className="w-full text-center text-slate-400 text-sm py-8">No incident data available</div>
             )}
          </div>
          <div className="mt-8 flex items-center justify-between text-xs text-slate-400">
             <span>0</span>
             <span>1</span>
             <span>2</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tables */}
        <div className="lg:col-span-2 space-y-6">
          {/* VMs Table */}
          <Card className="shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-700 text-sm">Running Virtual Machines</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Virtual Machine</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium">Resource Group</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vms.length > 0 ? vms.slice(0, 10).map((vm, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-blue-600 hover:underline cursor-pointer" title={vm.name}>{vm.name}</td>
                      <td className="px-4 py-3 text-slate-600">{vm.location}</td>
                      <td className="px-4 py-3 text-slate-600">{vm.resource_group}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{vm.vm_size}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${vm.provisioning_state === 'Succeeded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {vm.provisioning_state}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        {loading ? 'Loading...' : 'No Virtual Machines found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Storage Accounts Table */}
          <Card className="shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-700 text-sm">Storage Accounts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Storage Account</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium">Resource Group</th>
                    <th className="px-4 py-3 font-medium">Kind</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storageAccounts.length > 0 ? storageAccounts.slice(0, 10).map((account, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-blue-600 hover:underline cursor-pointer" title={account.name}>{account.name}</td>
                      <td className="px-4 py-3 text-slate-600">{account.location}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]" title={account.resource_group}>{account.resource_group}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{account.kind}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{account.sku}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${account.provisioning_state === 'Succeeded' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {account.provisioning_state}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        {loading ? 'Loading...' : 'No Storage Accounts found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column: Maps */}
        <div className="space-y-6">
          <Card className="shadow-sm border border-slate-200 h-[300px] flex flex-col">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-700 text-sm">VMs Map</h3>
            </div>
            <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
               <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')] bg-cover bg-center bg-no-repeat"></div>
               <div className="relative z-10 flex flex-col items-center">
                  <MapIcon className="h-12 w-12 text-slate-300 mb-2" />
                  <span className="text-slate-400 text-sm">Interactive Map Placeholder</span>
               </div>
               {/* Mock Map Markers */}
               <div className="absolute top-1/3 left-1/4 h-3 w-3 bg-green-500 rounded-full shadow-lg ring-2 ring-white"></div>
               <div className="absolute top-1/2 left-1/2 h-3 w-3 bg-green-500 rounded-full shadow-lg ring-2 ring-white"></div>
            </div>
          </Card>

          <Card className="shadow-sm border border-slate-200 h-[300px] flex flex-col">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-700 text-sm">Storage Accounts Map</h3>
            </div>
            <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
               <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')] bg-cover bg-center bg-no-repeat"></div>
               <div className="relative z-10 flex flex-col items-center">
                  <MapIcon className="h-12 w-12 text-slate-300 mb-2" />
                  <span className="text-slate-400 text-sm">Interactive Map Placeholder</span>
               </div>
               {/* Mock Map Markers */}
               <div className="absolute top-1/3 left-1/3 h-3 w-3 bg-green-500 rounded-full shadow-lg ring-2 ring-white"></div>
               <div className="absolute top-1/4 left-1/2 h-3 w-3 bg-green-500 rounded-full shadow-lg ring-2 ring-white"></div>
               <div className="absolute top-1/2 left-3/4 h-3 w-3 bg-green-500 rounded-full shadow-lg ring-2 ring-white"></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;