import { ROUTES } from './routes.js';

export const TASK_MANAGER_MVP_ENABLED = true;

export const FIRM_PILOT_SURFACE = {
  hideFromNavigation: new Set([
    'crm',
    'cms',
    'company-brain',
    'knowledge-library',
    'ai-settings',
    'reports',
    'updates',
  ]),
  disabledRoutes: new Set([
  ]),
  disabledRoutePrefixes: [
    '/crm',
    '/cms',
    '/company-brain',
    '/knowledge',
    '/ai-settings',
    '/admin/reports',
    '/updates',
  ],
};

export const SUPERADMIN_PILOT_SURFACE = {
  visibleNavPaths: new Set([
    '/app/superadmin',
    '/app/superadmin/firms',
    '/app/superadmin/diagnostics',
    '/app/superadmin/pilot-readiness',
  ]),
};

export const isPilotFirmRouteEnabled = (subPath = '') => {
  if (!TASK_MANAGER_MVP_ENABLED) return true;
  const normalized = `/${String(subPath || '').replace(/^\/+/, '')}`;
  if (FIRM_PILOT_SURFACE.disabledRoutes.has(normalized)) return false;
  return !FIRM_PILOT_SURFACE.disabledRoutePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
};

export const getPilotDisabledRouteFallback = (firmSlug) => ROUTES.WORKLIST(firmSlug);
