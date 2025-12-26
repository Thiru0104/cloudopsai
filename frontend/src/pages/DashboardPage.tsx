import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Activity, Shield, Users, AlertTriangle, CheckCircle, XCircle, TrendingUp, Server, Globe, Lock } from 'lucide-react';
import { apiClient } from '../config/api';

interface DashboardMetrics {
  live_connections: number;
  nsg_rules: number;
  security_groups: number;
  security_alerts: number;
}

interface RecentActivity {
  id: number;
  type: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
}

interface SystemStatus {
  azure_api: string;
  database: string;
  monitoring: string;
  backup_service: string;
}

interface SubscriptionMetrics {
  subscription_id: string;
  subscription_name: string;
  status: string;
  nsg_count: number;
  rule_count: number;
  high_risk_count: number;
  error?: string;
}

interface DashboardData {
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
}

const DashboardPage: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Fetching dashboard data from backend API');
      const data = await apiClient.get('/api/v1/dashboard');
      console.log('Dashboard data received:', JSON.stringify(data, null, 2));
      console.log('Data type:', typeof data);
      console.log('Data keys:', Object.keys(data || {}));
      console.log('Metrics exists:', !!data?.metrics);
      console.log('Metrics data:', data?.metrics);
      
      // Validate the data structure
      if (!data || !data.metrics) {
        throw new Error('Invalid dashboard data structure received');
      }
      
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Error loading dashboard: {error}</p>
          <button 
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <h1 className="text-5xl font-bold gradient-text">
            Enterprise Security Dashboard
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Comprehensive management hub for network security groups (NSGs) and application security groups (ASGs) in your Azure environment.
          </p>
          <div className="flex justify-center">
            <div className="status-online">
              <CheckCircle className="w-4 h-4 mr-2" />
              System Online - All Services Running
            </div>
          </div>
        </div>

        {/* Key Performance Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-slide-up">
          <div className="enterprise-card card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Live Connections</CardTitle>
              <div className="p-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg">
                <Activity className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{dashboardData.metrics.live_connections.toLocaleString()}</div>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600 font-medium">+12.5%</span>
                <span className="text-sm text-slate-500 ml-1">from last hour</span>
              </div>
            </CardContent>
          </div>
          
          <div className="enterprise-card card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">NSG Rules</CardTitle>
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg">
                <Shield className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{dashboardData.metrics.nsg_rules.toLocaleString()}</div>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-blue-500 mr-1" />
                <span className="text-sm text-blue-600 font-medium">+8.2%</span>
                <span className="text-sm text-slate-500 ml-1">optimized rules</span>
              </div>
            </CardContent>
          </div>
          
          <div className="enterprise-card card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Security Groups</CardTitle>
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <Users className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{dashboardData.metrics.security_groups}</div>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-purple-500 mr-1" />
                <span className="text-sm text-purple-600 font-medium">+15.6%</span>
                <span className="text-sm text-slate-500 ml-1">active groups</span>
              </div>
            </CardContent>
          </div>
          
          <div className="enterprise-card card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600">Security Alerts</CardTitle>
              <div className="p-2 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{dashboardData.metrics.security_alerts}</div>
              <div className="flex items-center mt-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 mr-1" />
                <span className="text-sm text-orange-600 font-medium">{dashboardData.metrics.security_alerts > 1 ? `${dashboardData.metrics.security_alerts - 1} high priority` : 'low priority'}</span>
              </div>
            </CardContent>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3 animate-scale-in">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="enterprise-card">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-800 flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-blue-500" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Latest changes and updates to your security configuration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {dashboardData.recent_activity.map((activity) => {
                    const getActivityStyle = (status: string) => {
                      switch (status) {
                        case 'success':
                          return {
                            bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
                            border: 'border-green-100',
                            dot: 'bg-green-500',
                            text: 'text-green-600',
                            icon: '✓'
                          };
                        case 'warning':
                          return {
                            bg: 'bg-gradient-to-r from-yellow-50 to-orange-50',
                            border: 'border-yellow-100',
                            dot: 'bg-yellow-500',
                            text: 'text-yellow-600',
                            icon: '⚠'
                          };
                        default:
                          return {
                            bg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
                            border: 'border-blue-100',
                            dot: 'bg-blue-500',
                            text: 'text-blue-600',
                            icon: '✓'
                          };
                      }
                    };
                    
                    const style = getActivityStyle(activity.status);
                    
                    return (
                      <div key={activity.id} className={`flex items-start space-x-4 p-4 ${style.bg} rounded-xl border ${style.border}`}>
                        <div className={`w-3 h-3 ${style.dot} rounded-full mt-2 ${activity.status === 'success' ? 'animate-pulse' : ''}`}></div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{activity.title}</p>
                          <p className="text-sm text-slate-600">{activity.description}</p>
                          <p className={`text-xs ${style.text} font-medium mt-1`}>{style.icon} {activity.status === 'success' ? 'Successfully applied' : activity.status === 'warning' ? 'Requires attention' : 'Configuration validated'}</p>
                        </div>
                        <div className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full">{activity.timestamp}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </div>
          </div>
          
          {/* System Status */}
          <div>
            <div className="enterprise-card">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-800 flex items-center">
                  <Server className="w-4 h-4 mr-2 text-indigo-500" />
                  System Status
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Current status of all monitored services.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboardData.system_status).map(([service, status]) => {
                    const getServiceConfig = (serviceName: string, status: string) => {
                      const configs = {
                        azure_api: { icon: Globe, name: 'Azure API' },
                        database: { icon: Server, name: 'Database' },
                        monitoring: { icon: Activity, name: 'Monitoring' },
                        backup_service: { icon: Lock, name: 'Backup Service' }
                      };
                      
                      const statusStyles = {
                        online: {
                          bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
                          border: 'border-green-100',
                          icon: 'text-green-500',
                          badge: 'status-online'
                        },
                        warning: {
                          bg: 'bg-gradient-to-r from-yellow-50 to-orange-50',
                          border: 'border-yellow-100',
                          icon: 'text-yellow-500',
                          badge: 'status-warning'
                        },
                        offline: {
                          bg: 'bg-gradient-to-r from-red-50 to-pink-50',
                          border: 'border-red-100',
                          icon: 'text-red-500',
                          badge: 'status-offline'
                        }
                      };
                      
                      return {
                        ...configs[serviceName as keyof typeof configs],
                        style: statusStyles[status as keyof typeof statusStyles] || statusStyles.offline
                      };
                    };
                    
                    const config = getServiceConfig(service, status);
                    const IconComponent = config.icon;
                    
                    return (
                      <div key={service} className={`flex items-center justify-between p-3 ${config.style.bg} rounded-lg border ${config.style.border}`}>
                        <div className="flex items-center space-x-3">
                          <IconComponent className={`w-4 h-4 ${config.style.icon}`} />
                          <span className="font-medium text-slate-700">{config.name}</span>
                        </div>
                        <div className={`${config.style.badge} text-xs`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </div>
          </div>
        </div>

        {/* Subscription Breakdown */}
        <div className="mt-6 animate-slide-up">
          <div className="enterprise-card">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center">
                <Globe className="w-4 h-4 mr-2 text-blue-500" />
                Subscription Overview
              </CardTitle>
              <CardDescription className="text-slate-600">
                Security posture across all connected Azure subscriptions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-600">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                    <tr>
                      <th className="px-6 py-3">Subscription Name</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">NSGs</th>
                      <th className="px-6 py-3">Rules</th>
                      <th className="px-6 py-3">High Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.subscription_breakdown && dashboardData.subscription_breakdown.length > 0 ? (
                      dashboardData.subscription_breakdown.map((sub) => (
                        <tr key={sub.subscription_id} className="bg-white border-b hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {sub.subscription_name}
                            <div className="text-xs text-slate-500">{sub.subscription_id}</div>
                          </td>
                          <td className="px-6 py-4">
                            {sub.error ? (
                               <span className="text-red-500 flex items-center font-medium"><AlertTriangle className="w-3 h-3 mr-1"/> Error</span>
                            ) : (
                               <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                 sub.status === 'Enabled' || sub.status === 'Warned' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                               }`}>
                                 {sub.status}
                               </span>
                            )}
                          </td>
                          <td className="px-6 py-4">{sub.nsg_count}</td>
                          <td className="px-6 py-4">{sub.rule_count}</td>
                          <td className="px-6 py-4">
                            {sub.high_risk_count > 0 ? (
                              <span className="text-red-600 font-bold">{sub.high_risk_count}</span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-slate-500">
                          No subscriptions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;