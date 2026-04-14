export const ROUTES = {
  SUPERADMIN_LOGIN: '/superadmin',
  SUPERADMIN_DASHBOARD: '/app/superadmin',
  SUPERADMIN_FIRMS: '/app/superadmin/firms',
  FIRM_LOGIN: (firmSlug) => `/${firmSlug}/login`,
  FIRM_BASE: (firmSlug) => `/app/firm/${firmSlug}`,
  DASHBOARD: (firmSlug) => `/app/firm/${firmSlug}/dashboard`,
  NOTIFICATIONS_HISTORY: (firmSlug) => `/app/firm/${firmSlug}/notifications`,
  CASES: (firmSlug) => `/app/firm/${firmSlug}/dockets`,
  CASE_DETAIL: (firmSlug, docketId) => `/app/firm/${firmSlug}/dockets/${docketId}`,
  CREATE_CASE: (firmSlug) => `/app/firm/${firmSlug}/dockets/create`,
  DOCKETS: (firmSlug) => `/app/firm/${firmSlug}/dockets`,
  WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/worklist`,
  MY_WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/my-worklist`,
  GLOBAL_WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/global-worklist`,
  COMPLIANCE_CALENDAR: (firmSlug) => `/app/firm/${firmSlug}/compliance-calendar`,
  PROFILE: (firmSlug) => `/app/firm/${firmSlug}/profile`,
  UPDATES: (firmSlug) => `/app/firm/${firmSlug}/updates`,
  ADMIN: (firmSlug) => `/app/firm/${firmSlug}/admin`,
  HIERARCHY: (firmSlug) => `/app/firm/${firmSlug}/admin/hierarchy`,
  WORK_CATEGORY_MANAGEMENT: (firmSlug) => `/app/firm/${firmSlug}/admin?tab=categories&context=work-settings`,
  FIRM_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/settings/firm`,
  WORK_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/settings/work`,
  STORAGE_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/storage-settings`,
  AI_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/ai-settings`,
};

export const hasValidFirmSlug = (firmSlug) => Boolean(firmSlug && !String(firmSlug).includes('undefined'));

export const safeRoute = (path, fallback = ROUTES.SUPERADMIN_LOGIN) => {
  if (!path || String(path).includes('undefined') || String(path).includes('null')) {
    return fallback;
  }

  return path;
};
