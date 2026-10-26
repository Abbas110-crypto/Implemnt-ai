import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import RiskKeywords from './pages/RiskKeywords';

import ClientPortal from './pages/ClientPortal';
import ChurnRisk from './pages/ChurnRisk';
import Integrations from './pages/Integrations';
import Templates from './pages/Templates';
import ExecutiveSummary from './pages/ExecutiveSummary';
import CalendarBots from './pages/CalendarBots';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ActionItems from './pages/ActionItems';
import CallInsights from './pages/CallInsights';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/clientportal" element={<ClientPortal />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace state={{ from: location }} />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clientdetail" element={<ClientDetail />} />
        <Route path="/riskkeywords" element={<RiskKeywords />} />
        <Route path="/churnrisk" element={<ChurnRisk />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/executivesummary" element={<ExecutiveSummary />} />
        <Route path="/calendarbots" element={<CalendarBots />} />
        <Route path="/actionitems" element={<ActionItems />} />
        <Route path="/callinsights" element={<CallInsights />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App
