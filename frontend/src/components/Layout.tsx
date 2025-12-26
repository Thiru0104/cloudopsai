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
  ChevronRight,
  BarChart3,
  Activity,
  LogOut,
  Menu,
  HardDrive
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['NSG']);
  
  const activeProgressItems = progressItems.filter(item => 
    item.status === 'in_progress' || item.status === 'pending'
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(item => item !== menuName)
        : [...prev, menuName]
    );
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Cloud, isGroup: false },
    { name: 'Storage', href: '/storage', icon: HardDrive, isGroup: false },
    { 
      name: 'NSG', 
      icon: Shield,
      isGroup: true,
      children: [
        { name: 'NSGs', href: '/nsgs', icon: Shield },
        { name: 'Backup', href: '/backup', icon: Database },
        { name: 'Restore', href: '/restore', icon: RotateCcw },
        { name: 'Golden Rule', href: '/golden-rule', icon: FileText },
        { name: 'Reports', href: '/reports', icon: BarChart3 },
        { name: 'NSG Validation', href: '/nsg-validation-enhanced', icon: Search },
        { name: 'AI Agents', href: '/agents', icon: Bot },
      ]
    },
    { name: 'Settings', href: '/settings', icon: Settings, isGroup: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out shadow-xl flex flex-col
          ${isSidebarOpen ? 'w-64' : 'w-20'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-800 bg-slate-900">
          <div className="flex items-center space-x-3 px-4 w-full">
            <div className="bg-blue-600 p-2 rounded-lg shrink-0">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            {isSidebarOpen && (
              <span className="text-lg font-bold text-white whitespace-nowrap overflow-hidden">CloudOpsAI</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {navigation.map((item) => (
            <div key={item.name} className="mb-2">
              {item.isGroup ? (
                <div className="space-y-1">
                  <button
                    onClick={() => isSidebarOpen ? toggleMenu(item.name) : setIsSidebarOpen(true)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors duration-200
                      ${expandedMenus.includes(item.name) ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 hover:text-white'}
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="h-5 w-5" />
                      {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                    </div>
                    {isSidebarOpen && (
                      expandedMenus.includes(item.name) 
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  
                  {/* Submenu */}
                  {isSidebarOpen && expandedMenus.includes(item.name) && (
                    <div className="mt-1 space-y-1 pl-4">
                      {item.children?.map((child) => {
                        const isActive = location.pathname === child.href;
                        return (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={`
                              flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
                              ${isActive 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                              }
                            `}
                          >
                            <child.icon className="h-4 w-4" />
                            <span>{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={item.href}
                  className={`
                    flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200
                    ${location.pathname === item.href 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                      : 'hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" />
                  {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className={`flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            <div className="flex items-center space-x-3">
              <div className="bg-slate-700 p-2 rounded-full">
                <User className="h-5 w-5 text-slate-300" />
              </div>
              {isSidebarOpen && (
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.role || 'Admin'}</p>
                </div>
              )}
            </div>
            {isSidebarOpen && (
              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-slate-800">
              {location.pathname === '/' ? 'Dashboard' : 
               location.pathname.substring(1).split('/').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' / ')}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            {/* Progress Sidebar Toggle */}
            <button 
              onClick={toggleProgressSidebar}
              className={`
                relative p-2 rounded-lg transition-colors flex items-center space-x-2
                ${isProgressSidebarOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}
              `}
            >
              <Activity className="h-5 w-5" />
              {activeProgressItems.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {activeProgressItems.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-x-hidden bg-slate-50">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Right Sidebar (Progress) */}
      <ProgressSidebar />
    </div>
  );
};

export default Layout;