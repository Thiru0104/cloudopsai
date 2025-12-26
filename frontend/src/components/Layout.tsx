import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Cloud, 
  Shield, 
  Database, 
  RotateCcw, 
  FileText, 
  Bot,
  Settings,
  Search,
  Bell,
  User,
  ChevronDown,
  BarChart3,
  Activity,
  LogOut
} from 'lucide-react';
import { useProgress } from '../contexts/ProgressContext';
import { useAuth } from '../contexts/AuthContext';
import ProgressSidebar from './ProgressSidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isProgressSidebarOpen, toggleProgressSidebar, progressItems } = useProgress();
  const { logout, user } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const activeProgressItems = progressItems.filter(item => 
    item.status === 'in_progress' || item.status === 'pending'
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const navigation = [
    { name: 'Dashboard', href: '/', icon: Cloud },
    { name: 'NSGs', href: '/nsgs', icon: Shield },
    { name: 'Backup', href: '/backup', icon: Database },
    { name: 'Restore', href: '/restore', icon: RotateCcw },
    { name: 'Golden Rule', href: '/golden-rule', icon: FileText },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'NSG Validation', href: '/nsg-validation-enhanced', icon: Search },
    { name: 'AI Agents', href: '/agents', icon: Bot },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl shadow-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="w-full px-4">
          <div className="flex items-center h-20">
            {/* Logo and Navigation */}
            <div className="flex items-center shrink-0">
              <div className="flex items-center group">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
                    <Cloud className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-3 hidden lg:block">
                  <span className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">CloudOpsAI</span>
                </div>
              </div>
            </div>
              
            <nav className="ml-4 flex items-center space-x-1 overflow-x-auto no-scrollbar">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      relative px-3 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center space-x-1 group whitespace-nowrap
                      ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 hover:shadow-lg'
                      }
                    `}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-30 -z-10 animate-pulse"></div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side - User and Actions */}
            <div className="flex items-center space-x-2 ml-4">
              {/* Progress Monitor */}
              <button 
                onClick={toggleProgressSidebar}
                className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-white/70 rounded-xl transition-all duration-300 hover:scale-110 group"
              >
                <Activity className="h-5 w-5" />
                {activeProgressItems.length > 0 && (
                  <span className="absolute top-2 right-2 flex h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </span>
                )}
                <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>

              {/* Notifications */}
              <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-white/70 rounded-xl transition-all duration-300 hover:scale-110 group">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></span>
                <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-xl hover:bg-white/70 transition-all duration-300 hover:scale-105 group"
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="text-sm font-semibold text-slate-900">{user?.full_name || 'Admin User'}</div>
                    <div className="text-xs text-slate-500">{user?.role || 'System Administrator'}</div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />

                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 animate-fade-in z-50">
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setIsUserMenuOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-all duration-300 ${
        isProgressSidebarOpen ? 'mr-96' : ''
      }`}>
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
      
      {/* Progress Sidebar */}
      <ProgressSidebar 
        isOpen={isProgressSidebarOpen} 
        onClose={() => toggleProgressSidebar()} 
      />
    </div>
  );
};

export default Layout;
