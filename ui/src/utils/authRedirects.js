import { resolveFirmLoginPath, extractFirmSlugFromPath } from './tenantRouting.js';

export const isPublicAuthPagePath = (pathname) => {
  const value = String(pathname || '').trim();
  if (!value) return false;
  if (value === '/' || value === '/login' || value === '/superadmin' || value === '/superadmin/login') return true;
  if (value === '/forgot-password' || value === '/reset-password' || value === '/change-password' || value === '/auth/otp') return true;
  if (value === '/signup' || value === '/auth/setup-account' || value === '/setup-password') return true;
  if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*\/forgot-password$/i.test(value)) return true;
  if (/^\/app\/[a-z0-9]+(?:-[a-z0-9]+)*\/forgot-password$/i.test(value)) return true;
  if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*\/login$/i.test(value)) return true;
  return false;
};

export const resolveAuthRedirectDestination = ({ pathname, storedFirmSlug }) => {
  const currentPath = String(pathname || '');
  const pathFirmSlug = extractFirmSlugFromPath(currentPath);
  if (currentPath.startsWith('/app/superadmin') || currentPath.startsWith('/superadmin')) {
    return '/superadmin/login';
  }
  return resolveFirmLoginPath({ firmSlug: pathFirmSlug, fallbackFirmSlug: storedFirmSlug });
};

export const isPublicAuth401Suppressed = ({ pathname, isAuthStateRequest }) => (
  Boolean(isAuthStateRequest) && isPublicAuthPagePath(pathname)
);
