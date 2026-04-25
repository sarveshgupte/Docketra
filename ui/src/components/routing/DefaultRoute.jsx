/**
 * Default Route Handler
 * Redirects users to appropriate dashboard based on role
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { STORAGE_KEYS } from '../../utils/constants';
import { RouteLoadingShell } from './RouteLoadingShell';
import { ROUTES } from '../../constants/routes';
import { getDefaultPostAuthRoute } from '../../utils/authRedirect';

export const DefaultRoute = () => {
  const { isAuthenticated, loading, user, isHydrating } = useAuth();
  const { isSuperadmin } = usePermissions();
  const location = useLocation();
  const storedFirmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);

  if (loading || isHydrating) {
    return <RouteLoadingShell />;
  }

  if (!isAuthenticated) {
    if (storedFirmSlug && location.pathname.startsWith('/app/firm/')) {
      return <Navigate to={ROUTES.FIRM_LOGIN(storedFirmSlug)} replace />;
    }
    return <Navigate to={ROUTES.SUPERADMIN_LOGIN} replace />;
  }

  // Redirect SuperAdmin to platform dashboard
  if (isSuperadmin) {
    return <Navigate to={getDefaultPostAuthRoute(user)} replace />;
  }

  // Redirect regular users to their firm dashboard
  if (user?.firmSlug) {
    return <Navigate to={getDefaultPostAuthRoute(user)} replace />;
  }

  // Fallback to generic login if no firm context
  return <Navigate to={ROUTES.SUPERADMIN_LOGIN} replace />;
};
