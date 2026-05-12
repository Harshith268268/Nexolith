import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { FamilyProvider, useFamily } from './lib/FamilyContext';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { FamilyMembers } from './pages/FamilyMembers';
import { ReportsLibrary } from './pages/ReportsLibrary';
import { UploadFlow } from './pages/UploadFlow';
import { ReportDetail } from './pages/ReportDetail';
import { Trends } from './pages/Trends';
import { AIPredictions } from './pages/AIPredictions';
import { AIAssistant } from './pages/AIAssistant';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useFamily();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/family" element={<FamilyMembers />} />
        <Route path="/reports" element={<ReportsLibrary />} />
        <Route path="/reports/upload" element={<UploadFlow />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/predictions" element={<AIPredictions />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <FamilyProvider>
        <Toaster position="top-right" richColors />
        <AppRoutes />
      </FamilyProvider>
    </BrowserRouter>
  );
}