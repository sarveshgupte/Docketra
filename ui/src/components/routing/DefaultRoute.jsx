/**
 * Default Route Handler
 * Redirects users to appropriate dashboard based on role
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { RouteLoadingShell } from './RouteLoadingShell';
import { ROUTES } from '../../constants/routes';
import { AUTH_STATES } from '../../contexts/AuthContext';

export const DefaultRoute = () => {
  const { isAuthenticated, loading, user, isHydrating, authState } = useAuth();
  const { isSuperadmin } = usePermissions();

  if (loading || isHydrating) {
    return <RouteLoadingShell />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LANDING} replace />;
  }

  // Redirect SuperAdmin to platform dashboard
  if (isSuperadmin) {
    return <Navigate to={ROUTES.SUPERADMIN_DASHBOARD} replace />;
  }

  // Redirect regular users to their firm dashboard
  if (user?.firmSlug) {
    return <Navigate to={ROUTES.DASHBOARD(user.firmSlug)} replace />;
  }

  if (authState === AUTH_STATES.ONBOARDING_REQUIRED) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <Navigate to="/complete-profile" replace />;
};
