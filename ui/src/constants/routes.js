export const ROUTES = {
  LANDING: '/',
  PUBLIC_LOGIN: '/login',
  SUPERADMIN_LOGIN: '/superadmin/login',
  SUPERADMIN_DASHBOARD: '/app/superadmin',
  SUPERADMIN_FIRMS: '/app/superadmin/firms',
  FIRM_LOGIN: (firmSlug) => `/${firmSlug}/login`,
  FIRM_BASE: (firmSlug) => `/app/firm/${firmSlug}`,
  DASHBOARD: (firmSlug) => `/app/firm/${firmSlug}/dashboard`,
  NOTIFICATIONS: (firmSlug) => `/app/firm/${firmSlug}/notifications`,
  NOTIFICATIONS_HISTORY: (firmSlug) => `/app/firm/${firmSlug}/notifications`, // legacy alias for NOTIFICATIONS
  DOCKETS: (firmSlug) => `/app/firm/${firmSlug}/dockets`,
  DOCKET_DETAIL: (firmSlug, docketId) => `/app/firm/${firmSlug}/dockets/${docketId}`,
  CREATE_DOCKET: (firmSlug) => `/app/firm/${firmSlug}/dockets/create`,
  CASES: (firmSlug) => `/app/firm/${firmSlug}/dockets`, // legacy alias for DOCKETS
  CASE_DETAIL: (firmSlug, docketId) => `/app/firm/${firmSlug}/dockets/${docketId}`, // legacy alias for DOCKET_DETAIL
  CREATE_CASE: (firmSlug) => `/app/firm/${firmSlug}/dockets/create`, // legacy alias for CREATE_DOCKET
  WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/worklist`,
  MY_WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/my-worklist`,
  GLOBAL_WORKLIST: (firmSlug) => `/app/firm/${firmSlug}/global-worklist`,
  WORKBASKET_DETAIL: (firmSlug, workbasketId) => `/app/firm/${firmSlug}/workbaskets/${workbasketId}`,
  DOCKETRA_INTELLIGENCE: (firmSlug) => `/app/firm/${firmSlug}/docketra-intelligence`,
  COMPLIANCE_CALENDAR: (firmSlug) => `/app/firm/${firmSlug}/compliance-calendar`,
  CLIENTS: (firmSlug) => `/app/firm/${firmSlug}/clients`,
  CLIENT_WORKSPACE: (firmSlug, clientId) => `/app/firm/${firmSlug}/clients/${clientId}`,
  PROFILE: (firmSlug) => `/app/firm/${firmSlug}/profile`,
  UPDATES: (firmSlug) => `/app/firm/${firmSlug}/updates`,
  ADMIN: (firmSlug) => `/app/firm/${firmSlug}/admin`,
  HIERARCHY: (firmSlug) => `/app/firm/${firmSlug}/admin/hierarchy`,
  WORK_CATEGORY_MANAGEMENT: (firmSlug) => `/app/firm/${firmSlug}/admin?tab=categories&context=work-settings`,
  FIRM_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/settings/firm`,
  WORK_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/settings/work`,
  STORAGE_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/storage-settings`,
  DATA_STORAGE_MAP: (firmSlug) => `/app/firm/${firmSlug}/data-storage-map`,
  AI_SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/ai-settings`,
  CRM: (firmSlug) => `/app/firm/${firmSlug}/crm`,
  CRM_CLIENTS: (firmSlug) => `/app/firm/${firmSlug}/crm/clients`,
  CRM_CLIENT_DETAIL: (firmSlug, id) => `/app/firm/${firmSlug}/crm/clients/${id}`,
  CRM_LEADS: (firmSlug) => `/app/firm/${firmSlug}/crm/leads`,
  QC_QUEUE: (firmSlug) => `/app/firm/${firmSlug}/qc-queue`,
  QC_WORKBASKET_DETAIL: (firmSlug, workbasketId) => `/app/firm/${firmSlug}/qc-workbaskets/${workbasketId}`,
  ADMIN_REPORTS: (firmSlug) => `/app/firm/${firmSlug}/admin/reports`,
  CMS: (firmSlug) => `/app/firm/${firmSlug}/cms`,
  COMPANY_BRAIN: (firmSlug) => `/app/firm/${firmSlug}/company-brain`,
  KNOWLEDGE_LIBRARY: (firmSlug) => `/app/firm/${firmSlug}/knowledge`,
  TASK_MANAGER: (firmSlug) => `/app/firm/${firmSlug}/task-manager`,
  SETTINGS: (firmSlug) => `/app/firm/${firmSlug}/settings`,
};

export const hasValidFirmSlug = (firmSlug) => Boolean(firmSlug && !String(firmSlug).includes('undefined'));

export const safeRoute = (path, fallback = ROUTES.SUPERADMIN_LOGIN) => {
  if (!path || String(path).includes('undefined') || String(path).includes('null')) {
    return fallback;
  }

  return path;
};
