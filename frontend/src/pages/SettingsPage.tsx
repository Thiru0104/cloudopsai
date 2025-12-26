import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Settings, 
  Users, 
  Bell, 
  Globe, 
  Database,
  UserPlus,
  Edit3,
  Trash2,
  Save,
  X,
  Mail,
  Send,
  CheckCircle,
  Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'User' | 'Viewer';
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

const SettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailConfig, setEmailConfig] = useState({
    smtpServer: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: 'NSG Tool Reports',
    enableTLS: true,
    testEmail: ''
  });
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'User' as const });
  
  const [notificationSettings, setNotificationSettings] = useState({
    securityAlerts: true,
    systemUpdates: true,
    backupStatus: true,
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (activeTab === 'users') {
          console.log('Fetching users...');
          const data = await apiClient.get('/api/v1/users/');
          console.log('Raw users data:', data);
          if (Array.isArray(data)) {
             const mappedUsers = data.map((u: any) => ({
              id: u.id.toString(),
              name: u.full_name || u.username || u.email,
              email: u.email,
              role: u.is_superuser ? 'Admin' : (u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'User'),
              status: u.is_active ? 'Active' : 'Inactive',
              lastLogin: 'N/A'
            }));
            console.log('Mapped users:', mappedUsers);
            setUsers(mappedUsers);
          } else {
            console.error('Unexpected users data format:', data);
            setError('Failed to load users: Unexpected data format');
          }
        }
        if (activeTab === 'notifications') {
          const noti = await apiClient.get('/api/v1/settings/notifications');
          if (noti && (noti.settings || noti)) {
            setNotificationSettings(noti.settings || noti);
          }
          try {
            const cfg = await apiClient.get('/api/v1/email/config');
            if (cfg) {
              setEmailConfig(prev => ({
                ...prev,
                ...cfg,
                smtpServer: cfg.smtpServer || '',
                smtpPort: cfg.smtpPort || '',
                smtpUsername: cfg.smtpUsername || '',
                fromEmail: cfg.fromEmail || '',
                fromName: cfg.fromName || '',
                testEmail: cfg.testEmail || '',
                smtpPassword: '' 
              }));
            }
          } catch {}
        }
      } catch (e: any) {
        console.error('Failed to load settings/users', e);
        if (e.response && e.response.status === 403) {
          setError('Access denied: You need administrator privileges to view this page.');
          toast.error('Access denied: You need administrator privileges to view this page.');
        } else {
          setError('Failed to load data. Please try again.');
          toast.error('Failed to load data. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  const tabs = [
    { id: 'users', name: 'User Management', icon: Users },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'system', name: 'System', icon: Database }
  ];

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Password validation (min 6 chars)
    if (newUser.password.length < 6) {
       toast.error('Password must be at least 6 characters long');
       return;
    }

    try {
      const payload = {
        email: newUser.email,
        username: newUser.email,
        full_name: newUser.name,
        role: newUser.role.toLowerCase(),
        password: newUser.password,
        is_active: true,
        is_superuser: newUser.role === 'Admin'
      };

      const res = await apiClient.post('/api/v1/users/', payload);
      
      // The backend returns the user object directly, not wrapped in { success, user }
      if (res && res.id) {
        const createdUser = {
          id: res.id.toString(),
          name: res.full_name || res.username || res.email,
          email: res.email,
          role: res.is_superuser ? 'Admin' : (res.role ? res.role.charAt(0).toUpperCase() + res.role.slice(1) : 'User'),
          status: res.is_active ? 'Active' : 'Inactive',
          lastLogin: 'N/A'
        };
        // @ts-ignore
        setUsers([...users, createdUser]);
        setNewUser({ name: '', email: '', password: '', role: 'User' });
        setShowAddUser(false);
        toast.success('User added successfully');
      } else {
        toast.error('Failed to add user');
      }
    } catch (err: any) {
      if (err.response && err.response.status === 403) {
        toast.error('Access denied: You do not have permission to create users.');
      } else if (err.response && err.response.status === 422) {
        // Handle validation errors specifically
        const detail = err.response.data?.detail;
        if (Array.isArray(detail)) {
           // Pydantic validation errors are often arrays
           const msg = detail.map((e: any) => `${e.loc.join('.')} - ${e.msg}`).join(', ');
           toast.error(`Validation error: ${msg}`);
        } else {
           toast.error(`Validation error: ${detail || 'Invalid input data'}`);
        }
      } else {
        const msg = err?.response?.data?.detail || err?.message || 'Failed to add user';
        toast.error(msg);
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await apiClient.delete(`/api/v1/users/${userId}`);
      setUsers(users.filter(user => user.id !== userId));
      toast.success('User deleted successfully');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to delete user';
      toast.error(msg);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'User': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Viewer': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex items-center justify-center space-x-3">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-4xl font-bold gradient-text">Settings</h1>
          </div>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Manage system settings, user accounts, and security configurations.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-2 shadow-xl border border-white/30">
            <div className="flex space-x-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300
                      ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }
                    `}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Add User Button */}
              <div className="flex justify-end">
                {(currentUser?.role === 'admin' || currentUser?.role === 'Admin') && (
                  <Button
                    onClick={() => setShowAddUser(true)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                )}
              </div>

              {/* Add User Form */}
              {showAddUser && (
                <Card className="enterprise-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <UserPlus className="h-4 w-4 mr-2 text-blue-500" />
                        Add New User
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddUser(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                        <input
                          type="text"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter full name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter email address"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                        <input
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter password"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'Admin' | 'User' | 'Viewer' })}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Viewer">Viewer</option>
                          <option value="User">User</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <Button
                        variant="outline"
                        onClick={() => setShowAddUser(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddUser}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </div>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  // Export logs functionality
                  const logs = JSON.stringify({
                    timestamp: new Date().toISOString(),
                    settings: 'Current application settings and logs'
                  }, null, 2);
                  
                  const blob = new Blob([logs], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `nsg-tool-logs-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Logs
              </Button>
            </CardContent>
          </Card>
              )}

              {/* Users List */}
              <Card className="enterprise-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-blue-500" />
                        User Management
                        <span className="ml-2 text-sm font-normal text-slate-500">({users.length} users)</span>
                      </CardTitle>
                      <CardDescription>
                        Manage user accounts, roles, and permissions.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Force reload
                        const currentTab = activeTab;
                        setActiveTab('');
                        setTimeout(() => setActiveTab(currentTab), 10);
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Loading...' : 'Refresh List'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {error ? (
                     <div className="text-center py-8 text-red-500">
                       <p>{error}</p>
                       <Button 
                         variant="outline" 
                         className="mt-4"
                         onClick={() => setActiveTab('users')}
                       >
                         Retry
                       </Button>
                     </div>
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">User</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Role</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Last Login</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 && !isLoading ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-500">
                              No users found.
                            </td>
                          </tr>
                        ) : (
                        users.map((user) => (
                          <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-4 px-4">
                              <div>
                                <div className="font-semibold text-slate-900">{user.name}</div>
                                <div className="text-sm text-slate-500">{user.email}</div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <Badge className={getRoleColor(user.role)}>
                                {user.role}
                              </Badge>
                            </td>
                            <td className="py-4 px-4">
                              <Badge className={getStatusColor(user.status)}>
                                {user.status}
                              </Badge>
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-600">
                              {user.lastLogin}
                            </td>
                            <td className="py-4 px-4">
                              {(currentUser?.role === 'admin' || currentUser?.role === 'Admin') && (
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
                                      try {
                                        await apiClient.put(`/api/v1/users/${user.id}`, { is_active: newStatus === 'Active' });
                                        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
                                        toast.success('User updated');
                                      } catch (err: any) {
                                        const msg = err?.response?.data?.detail || err?.message || 'Failed to update user';
                                        toast.error(msg);
                                      }
                                    }}
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'notifications' && (
            <Card className="enterprise-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-4 w-4 mr-2 text-blue-500" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-semibold text-slate-900">Security Alerts</div>
                      <div className="text-sm text-slate-600">Get notified about security events</div>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600"
                      checked={notificationSettings.securityAlerts}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, securityAlerts: e.target.checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-semibold text-slate-900">System Updates</div>
                      <div className="text-sm text-slate-600">Notifications about system changes</div>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600"
                      checked={notificationSettings.systemUpdates}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, systemUpdates: e.target.checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-semibold text-slate-900">Backup Status</div>
                      <div className="text-sm text-slate-600">Updates on backup operations</div>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600"
                      checked={notificationSettings.backupStatus}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, backupStatus: e.target.checked })}
                    />
                  </div>
                </div>
                
                {/* Email Configuration Section */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-blue-500" />
                      Email Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure SMTP settings for report email notifications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">SMTP Server</label>
                        <input
                          type="text"
                          value={emailConfig.smtpServer || ''}
                          onChange={(e) => setEmailConfig({...emailConfig, smtpServer: e.target.value})}
                          placeholder="smtp.gmail.com"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">SMTP Port</label>
                        <input
                          type="text"
                          value={emailConfig.smtpPort || ''}
                          onChange={(e) => setEmailConfig({...emailConfig, smtpPort: e.target.value})}
                          placeholder="587"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                        <input
                          type="text"
                          value={emailConfig.smtpUsername || ''}
                          onChange={(e) => setEmailConfig({...emailConfig, smtpUsername: e.target.value})}
                          placeholder="your-email@gmail.com"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                        <input
                          type="password"
                          value={emailConfig.smtpPassword || ''}
                          onChange={(e) => setEmailConfig({...emailConfig, smtpPassword: e.target.value})}
                          placeholder="App password or SMTP password"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">From Email</label>
                        <input
                          type="email"
                          value={emailConfig.fromEmail || ''}
                          onChange={(e) => setEmailConfig({...emailConfig, fromEmail: e.target.value})}
                          placeholder="reports@company.com"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">From Name</label>
                        <input
                          type="text"
                          value={emailConfig.fromName || ''}
                          onChange={(e) => setEmailConfig({...emailConfig, fromName: e.target.value})}
                          placeholder="NSG Tool Reports"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enableTLS"
                        checked={emailConfig.enableTLS}
                        onChange={(e) => setEmailConfig({...emailConfig, enableTLS: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableTLS" className="text-sm font-medium text-slate-700">
                        Enable TLS/SSL encryption
                      </label>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Test Email Configuration</h4>
                      <div className="flex gap-3">
                        <input
                          type="email"
                          value={emailConfig.testEmail || ''}
                          onChange={(e) => setEmailConfig({...emailConfig, testEmail: e.target.value})}
                          placeholder="test@example.com"
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <Button
                          onClick={async () => {
                            setIsTestingEmail(true);
                            setEmailTestResult(null);
                            try {
                              const result = await apiClient.post('/api/v1/email/test', {
                                ...emailConfig,
                                testRecipient: emailConfig.testEmail
                              });
                              setEmailTestResult({
                                success: !!result?.success,
                                message: result.message || result.error || 'Test completed'
                              });
                            } catch (error) {
                              setEmailTestResult({
                                success: false,
                                message: 'Failed to test email configuration'
                              });
                            } finally {
                              setIsTestingEmail(false);
                            }
                          }}
                          disabled={isTestingEmail || !emailConfig.testEmail}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isTestingEmail ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {isTestingEmail ? 'Testing...' : 'Send Test'}
                        </Button>
                      </div>
                      
                      {emailTestResult && (
                        <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                          emailTestResult.success 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {emailTestResult.success ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          {emailTestResult.message}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={async () => {
                          try {
                            const response = await apiClient.post('/api/v1/email/config', emailConfig);
                            if (response && response.success) {
                              toast.success('Email configuration saved successfully');
                            } else {
                              toast.error('Failed to save email configuration');
                            }
                          } catch (error) {
                            toast.error('Failed to save email configuration');
                          }
                        }}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save Configuration
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const config = await apiClient.get('/api/v1/email/config');
                            setEmailConfig({
                              ...emailConfig,
                              ...config,
                              smtpPassword: ''
                            });
                            toast.success('Configuration loaded');
                          } catch (error) {
                            toast.error('Failed to load configuration');
                          }
                        }}
                        variant="outline"
                        className="px-6 py-2"
                      >
                        Load Saved Config
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      try {
                        const res = await apiClient.post('/api/v1/settings/notifications', notificationSettings);
                        if (res && res.success) {
                          toast.success('Notification settings saved');
                        } else {
                          toast.error('Failed to save notification settings');
                        }
                      } catch {
                        toast.error('Failed to save notification settings');
                      }
                    }}
                  >
                    Save Notifications
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'system' && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="enterprise-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-4 w-4 mr-2 text-blue-500" />
                    System Information
                  </CardTitle>
                  <CardDescription>
                    View system status and configuration details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Version:</span>
                      <span className="font-semibold">v2.1.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Uptime:</span>
                      <span className="font-semibold">15 days, 4 hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Database:</span>
                      <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Storage:</span>
                      <span className="font-semibold">2.4 GB / 10 GB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="enterprise-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Globe className="h-4 w-4 mr-2 text-blue-500" />
                    System Maintenance
                  </CardTitle>
                  <CardDescription>
                    Perform system maintenance and updates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await apiClient.post('/api/v1/system/maintenance', { action: 'check_updates' });
                        toast[res?.success ? 'success' : 'error'](res?.message || 'Failed to check updates');
                      } catch (err: any) {
                        const msg = err?.response?.data?.message || err?.message || 'Failed to check updates';
                        toast.error(msg);
                      }
                    }}
                  >
                    Check for Updates
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await apiClient.post('/api/v1/system/maintenance', { action: 'clear_cache' });
                        toast[res?.success ? 'success' : 'error'](res?.message || 'Failed to clear cache');
                      } catch (err: any) {
                        const msg = err?.response?.data?.message || err?.message || 'Failed to clear cache';
                        toast.error(msg);
                      }
                    }}
                  >
                    Clear Cache
                  </Button>
                  <Button
                    className="w-full text-red-600 hover:text-red-700"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await apiClient.post('/api/v1/system/maintenance', { action: 'restart' });
                        toast[res?.success ? 'success' : 'error'](res?.message || 'Failed to restart');
                      } catch (err: any) {
                        const msg = err?.response?.data?.message || err?.message || 'Failed to restart';
                        toast.error(msg);
                      }
                    }}
                  >
                    Restart System
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;