/**
 * Protected Route Component
 * Handles authentication and role-based access
 */

import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { SESSION_KEYS, STORAGE_KEYS } from '../../utils/constants.js';
import { isSuperAdmin } from '../../utils/authUtils.js';
import { resolveFirmLoginPath, sanitizeFirmSlug } from '../../utils/tenantRouting.js';
import { RouteLoadingShell } from '../routing/RouteLoadingShell';
import { ROUTES } from '../../constants/routes.js';
import { AUTH_STATES } from '../../contexts/AuthContext.jsx';
import { appendReturnTo, buildReturnTo } from '../../utils/authRedirect.js';

// Use sessionStorage to persist toasts across redirects in auth guard flows.
const setAccessToast = (message) => {
  sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
    message,
    type: 'warning'
  }));
};

export const ProtectedRoute = ({ children, requireAdmin = false, requireSuperadmin = false }) => {
  const { isAuthenticated, isAuthResolved, user, authState } = useAuth();
  const { isAdmin } = usePermissions();
  const location = useLocation();
  const { firmSlug } = useParams();
  const routeFirmSlug = sanitizeFirmSlug(firmSlug);
  const storedFirmSlug = sanitizeFirmSlug(localStorage.getItem(STORAGE_KEYS.FIRM_SLUG));
  const effectiveFirmSlug = routeFirmSlug || storedFirmSlug;
  const hasInvalidRouteFirmSlug = Boolean(firmSlug && !routeFirmSlug);
  const isSuperAdminUser = isSuperAdmin(user);
  const firmLoginPath = resolveFirmLoginPath({
    firmSlug: routeFirmSlug,
    fallbackFirmSlug: storedFirmSlug,
  });
  const loginPath = requireSuperadmin ? ROUTES.SUPERADMIN_LOGIN : firmLoginPath;

  // Multi-tenancy guard: Detect firm slug mismatches
  if (routeFirmSlug && storedFirmSlug && routeFirmSlug !== storedFirmSlug) {
    console.warn(`[TENANCY] Firm slug mismatch detected. URL firm="${routeFirmSlug}", session firm="${storedFirmSlug}"`);
  }

  if (user?.firmSlug && routeFirmSlug && user.firmSlug !== routeFirmSlug) {
    console.warn(`[TENANCY] Attempted cross-firm access blocked in UI. User firm="${user.firmSlug}", requested firm="${routeFirmSlug}"`);
  }

  // Wait for auth hydration to complete
  if (!isAuthResolved) {
    return <RouteLoadingShell />;
  }

  // 1. Authentication check: User must be authenticated
  if (!isAuthenticated) {
    const loginPathWithReturnTo = appendReturnTo(loginPath, buildReturnTo(location));
    return <Navigate to={loginPathWithReturnTo} replace />;
  }

  if (!requireSuperadmin && routeFirmSlug && isSuperAdminUser) {
    return <Navigate to={ROUTES.SUPERADMIN_DASHBOARD} replace />;
  }

  if (!requireSuperadmin && routeFirmSlug && user?.firmSlug && user.firmSlug !== routeFirmSlug) {
    return <Navigate to={ROUTES.DASHBOARD(user.firmSlug)} replace />;
  }

  if (hasInvalidRouteFirmSlug && !requireSuperadmin) {
    return <Navigate to={ROUTES.PUBLIC_LOGIN} replace />;
  }

  if (authState === AUTH_STATES.ONBOARDING_REQUIRED) {
    return <Navigate to="/complete-profile" replace />;
  }

  // 2. Firm context check: Non-SuperAdmin users must have firm context
  // SuperAdmin users operate without firm context and access all system data
  if (!effectiveFirmSlug && !isSuperAdminUser) {
    return <Navigate to={loginPath} replace />;
  }

  // 3. SuperAdmin route authorization
  if (requireSuperadmin && !isSuperAdminUser) {
    // Non-SuperAdmin users trying to access SuperAdmin routes
    if (effectiveFirmSlug) {
      setAccessToast('SuperAdmin access is required to view that page.');
      return <Navigate to={ROUTES.DASHBOARD(effectiveFirmSlug)} replace />;
    }
    setAccessToast('SuperAdmin access is required to view that page.');
    return <Navigate to="/superadmin" replace />;
  }

  // 4. Firm route authorization: SuperAdmin users cannot access firm routes
  // They use a separate routing namespace (/superadmin)
  if (!requireSuperadmin && isSuperAdminUser) {
    return <Navigate to={ROUTES.SUPERADMIN_DASHBOARD} replace />;
  }

  // 5. Admin-only route authorization
  if (requireAdmin && !isAdmin) {
    setAccessToast('Admin access is required to view that page.');
    return <Navigate to={ROUTES.DASHBOARD(effectiveFirmSlug)} replace />;
  }

  return children;
};
