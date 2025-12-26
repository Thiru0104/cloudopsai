import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
                ✅ System Online - All Services Running
              </div>
            </div>
          </div>

          {/* Simple Card Test */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-slide-up">
            <div className="enterprise-card card-hover p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Test Card 1</h3>
              <div className="text-3xl font-bold text-slate-800">2,847</div>
              <p className="text-sm text-slate-500 mt-2">Sample metric</p>
            </div>
            
            <div className="enterprise-card card-hover p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-4">Test Card 2</h3>
              <div className="text-3xl font-bold text-slate-800">156</div>
              <p className="text-sm text-slate-500 mt-2">Another metric</p>
            </div>
          </div>
        </div>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;