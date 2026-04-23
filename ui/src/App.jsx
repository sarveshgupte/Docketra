/**
 * Main App Component
 */

import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ActiveDocketProvider } from './contexts/ActiveDocketContext';
import { Router } from './Router';
import { ScrollToTop } from './components/routing/ScrollToTop';
import { RoutePerformanceTracker } from './components/routing/RoutePerformanceTracker';
import { FirstLoginExperience } from './components/onboarding/FirstLoginExperience';
import { useAuth } from './hooks/useAuth';
import { bootstrapAuth } from './auth/authBootstrap';
import { DiagnosticsPanel } from './components/common/DiagnosticsPanel';

const AppBootstrap = () => {
  const { fetchProfile } = useAuth();

  useEffect(() => {
    bootstrapAuth(fetchProfile).catch((error) => {
      console.error('[AUTH] bootstrap failed', error);
    });
  }, [fetchProfile]);

  return (
      <ToastProvider>
        <ScrollToTop />
        <RoutePerformanceTracker />
        <Router />
        <FirstLoginExperience />
        <DiagnosticsPanel />
      </ToastProvider>
  );
};

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <BrowserRouter>
        <AuthProvider>
          <ActiveDocketProvider>
            <AppBootstrap />
          </ActiveDocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
