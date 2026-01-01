import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Cloud, 
  Shield, 
  Database, 
  RotateCcw, 
  FileText, 
  Bot,
  Settings,
  X,
  HardDrive
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Cloud },
  { name: 'NSGs', href: '/nsgs', icon: Shield },
  { name: 'Storage', href: '/storage', icon: HardDrive },
  { name: 'Backup', href: '/backup', icon: Database },
  { name: 'Restore', href: '/restore', icon: RotateCcw },
  { name: 'Golden Rules', href: '/golden-rule', icon: FileText },
  { name: 'AI Agents', href: '/agents', icon: Bot },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-6 overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6 pb-4 shadow-2xl">
          <div className="flex h-20 shrink-0 items-center group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-xl">
                <Cloud className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="ml-3">
              <span className="text-xl font-bold text-white">CloudOpsAI</span>
              <div className="text-xs text-slate-400 font-medium tracking-wide">Enterprise Security</div>
            </div>
          </div>
          
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <div className="text-xs font-semibold leading-6 text-slate-400 uppercase tracking-wider mb-4">Navigation</div>
                <ul role="list" className="-mx-2 space-y-2">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          className={`group relative flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-semibold transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                              : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                          }`}
                        >
                          <item.icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`} aria-hidden="true" />
                          {item.name}
                          {isActive && (
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-25 -z-10"></div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
              
              <li className="mt-auto">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">AU</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">Admin User</div>
                      <div className="text-xs text-slate-400">System Admin</div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex h-full flex-col gap-y-6 overflow-y-auto px-6 pb-4">
          <div className="flex h-20 shrink-0 items-center justify-between">
            <div className="flex items-center group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-xl">
                  <Cloud className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <span className="text-xl font-bold text-white">CloudOpsAI</span>
                <div className="text-xs text-slate-400 font-medium tracking-wide">Enterprise Security</div>
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200"
              onClick={onClose}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <div className="text-xs font-semibold leading-6 text-slate-400 uppercase tracking-wider mb-4">Navigation</div>
                <ul role="list" className="-mx-2 space-y-2">
                  {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          className={`group relative flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-semibold transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                              : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                          }`}
                          onClick={onClose}
                        >
                          <item.icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`} aria-hidden="true" />
                          {item.name}
                          {isActive && (
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur opacity-25 -z-10"></div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
              
              <li className="mt-auto">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">AU</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">Admin User</div>
                      <div className="text-xs text-slate-400">System Admin</div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>
      
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
};

export default Sidebar;
