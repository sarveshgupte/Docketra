/**
 * Application Constants
 */

export const APP_NAME = 'Docketra';
export const APP_VERSION = '1.1';

/**
 * API Base URL Configuration with Runtime Validation
 * 
 * This app requires VITE_API_BASE_URL to be set in all environments.
 * 
 * ⚠️ DEPLOYMENT REQUIREMENT:
 * Set VITE_API_BASE_URL environment variable in your deployment platform (e.g., Render)
 * 
 * In development:
 * - Set in .env file (e.g., VITE_API_BASE_URL=/api)
 * - The value '/api' is proxied by vite.config.js to localhost:5000
 * 
 * In production:
 * - MUST be explicitly set to your backend API URL
 * - No silent fallbacks - will fail fast with clear error message
 */
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const isProduction = import.meta.env.PROD;

const normalizeApiBaseUrl = (value) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  const withoutTrailingSlashes = trimmedValue.replace(/\/+$/, '');
  return withoutTrailingSlashes.endsWith('/api')
    ? withoutTrailingSlashes
    : `${withoutTrailingSlashes}/api`;
};

const defaultApiBaseUrl = '/api';

// Runtime validation with fallback behavior.
if (!rawApiBaseUrl || rawApiBaseUrl.trim() === '') {
  const warningPrefix = isProduction ? '⚠️ DEPLOYMENT WARNING' : '⚠️ DEVELOPMENT WARNING';
  const warningMessage = `${warningPrefix}: VITE_API_BASE_URL is not defined or empty.
Falling back to same-origin API path: ${defaultApiBaseUrl}

If your API is hosted on another domain, set:
VITE_API_BASE_URL=https://api.example.com/api`;
  console.warn(warningMessage);
}

export const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl || defaultApiBaseUrl);

console.info(`✓ Using API base URL: ${API_BASE_URL}`);

export const CASE_STATUS = {
  // Canonical lifecycle states (NEW - use these)
  UNASSIGNED: 'UNASSIGNED',
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  QC_PENDING: 'QC_PENDING',
  RESOLVED: 'RESOLVED',
  FILED: 'FILED',
  
  // Workflow states
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
  
  // Legacy statuses for backward compatibility (do NOT use for new code)
  OPEN_LEGACY: 'Open',
  REVIEWED: 'Reviewed',
  PENDING_LEGACY: 'Pending',
  FILED_LEGACY: 'Filed',
  ARCHIVED: 'Archived',
};

export const CASE_CATEGORIES = {
  CLIENT_NEW: 'Client - New',
  CLIENT_EDIT: 'Client - Edit',
  CLIENT_DELETE: 'Client - Delete',
  SALES: 'Sales',
  ACCOUNTING: 'Accounting',
  EXPENSES: 'Expenses',
  PAYROLL: 'Payroll',
  HR: 'HR',
  COMPLIANCE: 'Compliance',
  CORE_BUSINESS: 'Core Business',
  MANAGEMENT_REVIEW: 'Management Review',
  INTERNAL: 'Internal',
  OTHER: 'Other',
};

export const DEFAULT_CLIENT_ID = 'C000001';

export const CLIENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

export const USER_ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  PRIMARY_ADMIN: 'PRIMARY_ADMIN',
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
  PARTNER: 'Partner',
};

export const STORAGE_KEYS = {
  FIRM_SLUG: 'firmSlug',
  IMPERSONATED_FIRM: 'impersonatedFirm', // SuperAdmin firm impersonation state
  AUTH_LOGOUT_BROADCAST: 'authLogoutBroadcastAt',
  // @deprecated Will be removed in v2.0. Use AuthContext to get user data from API instead.
  X_ID: 'xID',
  // @deprecated Will be removed in v2.0. Use AuthContext to get user data from API instead.
  USER: 'user',
};

export const SESSION_KEYS = {
  GLOBAL_TOAST: 'GLOBAL_TOAST',
  PENDING_LOGIN_TOKEN: 'PENDING_LOGIN_TOKEN',
  PENDING_LOGIN_FIRM: 'PENDING_LOGIN_FIRM',
  POST_LOGIN_RETURN_TO: 'POST_LOGIN_RETURN_TO',
};

/**
 * Error codes returned by backend API
 * Used to identify specific error conditions and handle them appropriately in the UI
 */
export const ERROR_CODES = {
  /** User must set initial password via email link before they can login */
  PASSWORD_SETUP_REQUIRED: 'PASSWORD_SETUP_REQUIRED',
  /** Refresh token flow is not supported for this session */
  REFRESH_NOT_SUPPORTED: 'REFRESH_NOT_SUPPORTED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  STORAGE_NOT_AVAILABLE: 'STORAGE_NOT_AVAILABLE',
  STORAGE_NOT_CONNECTED: 'STORAGE_NOT_CONNECTED',
  UPLOAD_SESSION_EXPIRED: 'UPLOAD_SESSION_EXPIRED',
  UPLOAD_VERIFICATION_FAILED: 'UPLOAD_VERIFICATION_FAILED',
  UPLOAD_CHECKSUM_MISMATCH: 'UPLOAD_CHECKSUM_MISMATCH',
  UPLOAD_SESSION_BACKEND_UNAVAILABLE: 'UPLOAD_SESSION_BACKEND_UNAVAILABLE',
  TENANT_SCOPE_TAMPERING_DETECTED: 'TENANT_SCOPE_TAMPERING_DETECTED',
  CLIENT_INACTIVE: 'CLIENT_INACTIVE',
  ASSIGNEE_INACTIVE: 'ASSIGNEE_INACTIVE',
  CASE_ACCESS_DENIED: 'CASE_ACCESS_DENIED',
  CLIENT_ACCESS_RESTRICTED: 'CLIENT_ACCESS_RESTRICTED',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};


export const CASE_DETAIL_TABS = {
  OVERVIEW: 'overview',
  ACTIVITY: 'activity',
  ATTACHMENTS: 'attachments',
  HISTORY: 'history',
  COMMENTS_LEGACY: 'comments',
};

export const VALID_CASE_DETAIL_TAB_NAMES = [
  CASE_DETAIL_TABS.OVERVIEW,
  CASE_DETAIL_TABS.ATTACHMENTS,
  CASE_DETAIL_TABS.ACTIVITY,
  CASE_DETAIL_TABS.HISTORY,
  CASE_DETAIL_TABS.COMMENTS_LEGACY,
];
