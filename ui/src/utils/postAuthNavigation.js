import { isSuperAdmin } from './authUtils.js';
import { ROUTES } from '../constants/routes.js';

const isSafeAppRoute = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(trimmed)) return false;
  return trimmed === '/app' || trimmed.startsWith('/app/');
};

const isRoleCompatibleRoute = (candidatePath, user) => {
  if (!isSafeAppRoute(candidatePath)) return false;

  if (isSuperAdmin(user)) {
    return candidatePath.startsWith('/app/superadmin');
  }

  const firmSlug = String(user?.firmSlug || '').trim();
  if (!firmSlug) return false;
  return candidatePath.startsWith(`/app/firm/${firmSlug}`);
};

const extractReturnTo = (locationSearch = '') => {
  try {
    const rawValue = new URLSearchParams(locationSearch).get('returnTo');
    if (!rawValue) return '';
    return String(rawValue).trim();
  } catch (_error) {
    return '';
  }
};

export const resolvePostAuthNavigation = ({
  locationSearch = '',
  user,
  resolvePostAuthRoute,
}) => {
  const fallbackRoute = resolvePostAuthRoute(user);
  const returnTo = extractReturnTo(locationSearch);
  const candidateRoute = isSafeAppRoute(returnTo) ? returnTo : '';

  if (candidateRoute && isRoleCompatibleRoute(candidateRoute, user)) {
    return candidateRoute;
  }

  if (isRoleCompatibleRoute(fallbackRoute, user)) {
    return fallbackRoute;
  }

  if (!isSuperAdmin(user) && user?.firmSlug) {
    return ROUTES.DASHBOARD(user.firmSlug);
  }

  if (isSuperAdmin(user)) {
    return ROUTES.SUPERADMIN_DASHBOARD;
  }

  return '/complete-profile';
};
