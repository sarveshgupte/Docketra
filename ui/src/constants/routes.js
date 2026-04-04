export const ROUTES = {
  SUPERADMIN_LOGIN: '/superadmin',
  SUPERADMIN_DASHBOARD: '/app/superadmin',
  SUPERADMIN_FIRMS: '/app/superadmin/firms',
  FIRM_LOGIN: (firmSlug) => `/${firmSlug}/login`,
  FIRM_BASE: (firmSlug) => `/app/firm/${firmSlug}`,
  DASHBOARD: (firmSlug) => `/app/firm/${firmSlug}/dashboard`,
  CASES: (firmSlug) => `/app/firm/${firmSlug}/cases`,
  CASE_DETAIL: (firmSlug, caseId) => `/app/firm/${firmSlug}/cases/${caseId}`,
  CREATE_CASE: (firmSlug) => `/app/firm/${firmSlug}/cases/create`,
  DOCKETS: (firmSlug) => `/app/firm/${firmSlug}/cases`,
  WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/worklist`,
  MY_WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/my-worklist`,
  GLOBAL_WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/global-worklist`,
  PROFILE: (firmSlug) => `/app/firm/${firmSlug}/profile`,
  ADMIN: (firmSlug) => `/app/firm/${firmSlug}/admin`,
  FIRM_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/settings/firm`,
  FAQ: (firmSlug) => `/app/firm/${firmSlug}/faq`,
};

export const hasValidFirmSlug = (firmSlug) => Boolean(firmSlug && !String(firmSlug).includes('undefined'));

export const safeRoute = (path, fallback = ROUTES.SUPERADMIN_LOGIN) => {
  if (!path || String(path).includes('undefined') || String(path).includes('null')) {
    return fallback;
  }

  return path;
};
