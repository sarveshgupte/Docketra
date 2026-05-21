import { isSuperAdmin } from './authUtils.js';
import { ROUTES } from '../constants/routes.js';
import { getFirstAssignedQcWorklistRoute, getFirstAssignedWorklistRoute } from '../constants/platformNavigation.js';

import { isRoleCompatibleRoute, isSafeReturnToPath } from './returnToSafety.js';

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
  const candidateRoute = isSafeReturnToPath(returnTo) ? returnTo : '';

  if (candidateRoute && isRoleCompatibleRoute(candidateRoute, { isSuperAdminUser: isSuperAdmin(user), firmSlug: user?.firmSlug })) {
    return candidateRoute;
  }

  if (isRoleCompatibleRoute(fallbackRoute, { isSuperAdminUser: isSuperAdmin(user), firmSlug: user?.firmSlug })) {
    return fallbackRoute;
  }

  if (!isSuperAdmin(user) && user?.firmSlug) {
    const firstWorklistRoute = getFirstAssignedWorklistRoute(user.firmSlug, user);
    if (firstWorklistRoute) return firstWorklistRoute;
    const canViewGlobalWorkbaskets = ['MANAGER', 'ADMIN', 'PRIMARY_ADMIN'].includes(String(user?.role || '').toUpperCase());
    if (canViewGlobalWorkbaskets) return ROUTES.GLOBAL_WORKLIST(user.firmSlug);
    const firstQcRoute = getFirstAssignedQcWorklistRoute(user.firmSlug, user);
    if (firstQcRoute) return firstQcRoute;
    return ROUTES.DASHBOARD(user.firmSlug);
  }

  if (isSuperAdmin(user)) {
    return ROUTES.SUPERADMIN_DASHBOARD;
  }

  return '/complete-profile';
};
