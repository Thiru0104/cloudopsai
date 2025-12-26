import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ProgressProvider } from './contexts/ProgressContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NSGsPage from './pages/NSGsPage';
import NSGRuleEditorPage from './pages/NSGRuleEditorPage';
import BackupPage from './pages/BackupPage';
import RestorePage from './pages/RestorePage';
import GoldenRulePage from './pages/GoldenRulePage';
import ReportsPage from './pages/ReportsPage';
import NSGValidationEnhancedPage from './pages/NSGValidationEnhancedPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
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
      <AuthProvider>
        <ProgressProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/nsgs" element={<NSGsPage />} />
                        <Route path="/nsgs/:id/rules" element={<NSGRuleEditorPage />} />
                        <Route path="/backup" element={<BackupPage />} />
                        <Route path="/restore" element={<RestorePage />} />
                        <Route path="/golden-rule" element={<GoldenRulePage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/nsg-validation-enhanced" element={<NSGValidationEnhancedPage />} />
                        <Route path="/agents" element={<AgentsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </ProgressProvider>
      </AuthProvider>
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