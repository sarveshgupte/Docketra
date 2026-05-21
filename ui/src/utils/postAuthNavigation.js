import { isSuperAdmin } from './authUtils.js';
import { ROUTES } from '../constants/routes.js';

import { isRoleCompatibleRoute, isSafeReturnToPath } from './returnToSafety.js';
import { hasFirmRoleAtLeast } from './permissions.js';

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
  const candidateRoute = getPostLoginWorkspaceDestination(user, user?.firmSlug, returnTo);

  if (candidateRoute && isRoleCompatibleRoute(candidateRoute, { isSuperAdminUser: isSuperAdmin(user), firmSlug: user?.firmSlug })) {
    return candidateRoute;
  }

  if (isRoleCompatibleRoute(fallbackRoute, { isSuperAdminUser: isSuperAdmin(user), firmSlug: user?.firmSlug })) {
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

const readFirstValidId = (records = []) => {
  if (!Array.isArray(records)) return '';
  for (const record of records) {
    const candidate = String(record?._id || record?.id || record?.workbasketId || '').trim();
    if (candidate) return candidate;
  }
  return '';
};

export const getPostLoginWorkspaceDestination = (user, firmSlug, intendedPath = '') => {
  const normalizedIntendedPath = String(intendedPath || '').trim();
  if (isSafeReturnToPath(normalizedIntendedPath)) return normalizedIntendedPath;

  if (!user || isSuperAdmin(user)) return '';
  if (!firmSlug) return '';

  const assignedWorkbasketId = readFirstValidId(user?.workbaskets);
  if (assignedWorkbasketId) {
    return `${ROUTES.WORKLIST(firmSlug)}?workbasketId=${encodeURIComponent(assignedWorkbasketId)}`;
  }

  const canViewOverview = hasFirmRoleAtLeast(user, 'MANAGER');
  if (canViewOverview) {
    return ROUTES.GLOBAL_WORKLIST(firmSlug);
  }

  const assignedQcWorkbasketId = readFirstValidId(user?.qcWorkbaskets);
  if (assignedQcWorkbasketId) {
    return ROUTES.QC_WORKBASKET_DETAIL(firmSlug, assignedQcWorkbasketId);
  }

  return ROUTES.DASHBOARD(firmSlug);
};
