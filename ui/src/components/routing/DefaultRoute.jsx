/**
 * Default Route Handler
 * Redirects users to appropriate dashboard based on role
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { STORAGE_KEYS } from '../../utils/constants';
import { RouteLoadingShell } from './RouteLoadingShell';
import { ROUTES } from '../../constants/routes';

export const DefaultRoute = () => {
  const { isAuthenticated, loading, user, isHydrating } = useAuth();
  const { isSuperadmin } = usePermissions();
  const storedFirmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);

  if (loading || isHydrating) {
    return <RouteLoadingShell />;
  }

  if (!isAuthenticated) {
    if (storedFirmSlug) {
      return <Navigate to={ROUTES.FIRM_LOGIN(storedFirmSlug)} replace />;
    }
    return <Navigate to={ROUTES.SUPERADMIN_LOGIN} replace />;
  }

  // Redirect SuperAdmin to platform dashboard
  if (isSuperadmin) {
    return <Navigate to={ROUTES.SUPERADMIN_DASHBOARD} replace />;
  }

  // Redirect regular users to their firm dashboard
  if (user?.firmSlug) {
    return <Navigate to={ROUTES.DASHBOARD(user.firmSlug)} replace />;
  }

  if (storedFirmSlug) {
    return <Navigate to={ROUTES.DASHBOARD(storedFirmSlug)} replace />;
  }

  // Fallback to generic login if no firm context
  return <Navigate to={ROUTES.SUPERADMIN_LOGIN} replace />;
};
