import { ROUTES } from '../constants/routes';
import { STORAGE_KEYS, SESSION_KEYS } from './constants';
import { isSuperAdmin } from './authUtils';

const FIRM_APP_ROUTE_PATTERN = /^\/app\/firm\/([^/?#]+)(?:[/?#]|$)/;

const isAllowedAppRoute = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  return trimmed === '/app' || trimmed.startsWith('/app/');
};

export const getDefaultPostAuthRoute = (candidateUser) => {
  if (!candidateUser) return ROUTES.SUPERADMIN_LOGIN;
  if (isSuperAdmin(candidateUser)) return ROUTES.SUPERADMIN_DASHBOARD;
  if (!candidateUser?.firmSlug) return '/complete-profile';
  return ROUTES.DASHBOARD(candidateUser.firmSlug);
};

export const isValidPostLoginDestination = (returnTo, candidateUser) => {
  if (!isAllowedAppRoute(returnTo) || !candidateUser) return false;

  const normalized = returnTo.trim();
  if (isSuperAdmin(candidateUser)) {
    return normalized === ROUTES.SUPERADMIN_DASHBOARD
      || normalized.startsWith(`${ROUTES.SUPERADMIN_DASHBOARD}/`);
  }

  const match = normalized.match(FIRM_APP_ROUTE_PATTERN);
  return Boolean(match && candidateUser.firmSlug && match[1] === candidateUser.firmSlug);
};

export const buildReturnTo = (location) => {
  if (!location) return '';
  const pathname = typeof location.pathname === 'string' ? location.pathname : '';
  const search = typeof location.search === 'string' ? location.search : '';
  const hash = typeof location.hash === 'string' ? location.hash : '';
  return `${pathname}${search}${hash}`;
};

export const appendReturnTo = (targetPath, returnTo) => {
  if (!targetPath) return targetPath;
  if (!isAllowedAppRoute(returnTo)) return targetPath;
  const [basePath, existingSearch = ''] = targetPath.split('?');
  const query = new URLSearchParams(existingSearch);
  query.set('returnTo', returnTo);
  const serialized = query.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
};

export const resolvePostLoginDestination = (returnTo, candidateUser, fallbackPath) => {
  const resolvedFallback = fallbackPath || getDefaultPostAuthRoute(candidateUser);
  if (isValidPostLoginDestination(returnTo, candidateUser)) {
    return returnTo.trim();
  }
  return resolvedFallback;
};

export const clearRoutingAuthStorage = ({ preserveFirmSlug = null } = {}) => {
  try {
    localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);
    localStorage.removeItem(STORAGE_KEYS.X_ID);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_LOGOUT_BROADCAST);
    if (preserveFirmSlug) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, preserveFirmSlug);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    }
  } catch (_error) {
    // Storage cleanup should never block logout or auth recovery.
  }

  try {
    sessionStorage.removeItem(SESSION_KEYS.GLOBAL_TOAST);
    sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN);
    sessionStorage.removeItem(SESSION_KEYS.PENDING_OTP);
    sessionStorage.removeItem(SESSION_KEYS.REDIRECT_TARGET);
  } catch (_error) {
    // Best-effort session cleanup.
  }
};

