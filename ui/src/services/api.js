/**
 * Axios API Client Configuration
 * Updated for JWT Bearer token authentication
 */

import axios from 'axios';
import { API_BASE_URL, ERROR_CODES, SESSION_KEYS, STORAGE_KEYS } from '../utils/constants';
import { resolveFirmLoginPath } from '../utils/tenantRouting';
import { emitOnboardingProgressRefresh, shouldRefreshOnboardingProgress } from '../utils/onboardingProgressRefresh';
import { createCorrelationId, emitDiagnosticEvent, shouldEmitWarning } from '../utils/workflowDiagnostics';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let redirecting = false;
let refreshFailureDetected = false;
const inFlightRequestCounts = new Map();
const requestStartedAtById = new Map();
const SLOW_API_THRESHOLD_MS = 900;
const buildRequestSignature = (config) => {
  const method = String(config?.method || 'get').toUpperCase();
  const url = String(config?.url || '');
  const params = config?.params ? JSON.stringify(config.params) : '';
  return `${method} ${url} ${params}`;
};
const buildWorkflowName = (config) => {
  const method = String(config?.method || 'get').toLowerCase();
  const url = String(config?.url || '').replace(/[0-9a-f]{24}/gi, ':id');
  return `${method}:${url || 'unknown'}`.slice(0, 120);
};
const markErrorToasted = (error, message) => {
  if (!error) return;
  error.uiFeedback = {
    ...(error.uiFeedback || {}),
    toasted: true,
    message,
  };
};
const REDIRECT_TIMEOUT_MS = 5000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 4000;
const isPublicAuthFlowRequest = (requestConfig) => {
  const requestUrl = String(requestConfig?.url || '');
  return /\/auth\/(resend-otp|verify-totp|complete-mfa-login|forgot-password|reset-password-with-token|resend-credentials)$/.test(requestUrl)
    || /\/verify-otp$/.test(requestUrl)
    || /\/login$/.test(requestUrl);
};
const isRefreshRequest = (requestConfig) => /\/auth\/refresh$/.test(String(requestConfig?.url || ''));
const isLoginLikePath = (pathname) => /\/login$/.test(pathname) || pathname.includes('/auth/login');

function generateIdempotencyKey() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  if (window.crypto?.getRandomValues) {
    const buffer = new Uint8Array(16);
    window.crypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    const segments = [
      Array.from(buffer.slice(0, 4)),
      Array.from(buffer.slice(4, 6)),
      Array.from(buffer.slice(6, 8)),
      Array.from(buffer.slice(8, 10)),
      Array.from(buffer.slice(10)),
    ].map((segment) => segment.map((b) => b.toString(16).padStart(2, '0')).join(''));
    return segments.join('-');
  }
  return 'idemp-' + Math.random().toString(36).substring(2) + Date.now();
}

// Request interceptor - add idempotency/impersonation headers
api.interceptors.request.use(
  (config) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const signature = buildRequestSignature(config);
    const workflow = buildWorkflowName(config);
    const correlationId = config?.metadata?.correlationId || createCorrelationId(workflow);
    config.metadata = {
      ...(config.metadata || {}),
      requestId,
      signature,
      workflow,
      correlationId,
    };
    config.headers = config.headers || {};
    config.headers['X-Correlation-ID'] = correlationId;
    requestStartedAtById.set(requestId, performance.now());
    const activeCount = (inFlightRequestCounts.get(signature) || 0) + 1;
    inFlightRequestCounts.set(signature, activeCount);
    if (activeCount > 1) {
      const warningKey = `dup:${signature}`;
      if (shouldEmitWarning(warningKey)) {
        emitDiagnosticEvent('warn', 'duplicate_api_request', { signature, activeCount, workflow, correlationId });
      }
    }

    const method = (config.method || '').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const hasIdempotencyKey = typeof config.headers?.has === 'function'
        ? config.headers.has('Idempotency-Key') || config.headers.has('idempotency-key')
        : Object.keys(config.headers || {}).some((headerName) => headerName.toLowerCase() === 'idempotency-key');
      if (!hasIdempotencyKey) {
        if (typeof config.headers?.set === 'function') {
          config.headers.set('Idempotency-Key', generateIdempotencyKey());
        } else {
          config.headers = config.headers || {};
          config.headers['Idempotency-Key'] = generateIdempotencyKey();
        }
      }
    }

    // Add impersonation header if SuperAdmin is impersonating a firm
    const impersonatedFirm = localStorage.getItem(STORAGE_KEYS.IMPERSONATED_FIRM);
    if (impersonatedFirm) {
      try {
        const firmData = JSON.parse(impersonatedFirm);
        if (firmData?.impersonatedFirmId) {
          config.headers['X-Impersonated-Firm-Id'] = firmData.impersonatedFirmId;
        }
        if (firmData?.sessionId) {
          config.headers['X-Impersonation-Session-Id'] = firmData.sessionId;
        }
        if (firmData?.impersonationMode) {
          config.headers['X-Impersonation-Mode'] = firmData.impersonationMode;
        }
      } catch (error) {
        console.error('[API] Failed to parse impersonated firm data from localStorage. Data may be corrupted. Please clear impersonation state and try again.', error);
        // Clear corrupted data
        localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token expiry and refresh
api.interceptors.response.use(
  (response) => {
    const requestId = response?.config?.metadata?.requestId;
    const signature = response?.config?.metadata?.signature;
    const startedAt = requestId ? requestStartedAtById.get(requestId) : null;
    if (requestId) requestStartedAtById.delete(requestId);
    if (signature) {
      const remaining = Math.max(0, (inFlightRequestCounts.get(signature) || 1) - 1);
      if (remaining === 0) inFlightRequestCounts.delete(signature);
      else inFlightRequestCounts.set(signature, remaining);
    }
    if (startedAt) {
      const durationMs = Math.round(performance.now() - startedAt);
      if (durationMs >= SLOW_API_THRESHOLD_MS) {
        emitDiagnosticEvent('warn', 'slow_api_response', { signature, workflow: response?.config?.metadata?.workflow, correlationId: response?.config?.metadata?.correlationId, durationMs, status: response?.status });
      }
      emitDiagnosticEvent('info', 'api_response', { signature, workflow: response?.config?.metadata?.workflow, correlationId: response?.config?.metadata?.correlationId, durationMs, status: response?.status });
    }
    if (/\/auth\/(profile|refresh)$/.test(String(response?.config?.url || ''))) {
      refreshFailureDetected = false;
    }
    if (shouldRefreshOnboardingProgress({ method: response?.config?.method, url: response?.config?.url })) {
      emitOnboardingProgressRefresh({
        method: response?.config?.method,
        url: response?.config?.url,
      });
    }
    if (response?.data?.idempotent === true) {
      window.dispatchEvent(new CustomEvent('app:idempotent'));
    }
    return response;
  },
  async (error) => {
    const requestId = error?.config?.metadata?.requestId;
    const signature = error?.config?.metadata?.signature;
    if (requestId) {
      requestStartedAtById.delete(requestId);
    }
    if (signature) {
      const remaining = Math.max(0, (inFlightRequestCounts.get(signature) || 1) - 1);
      if (remaining === 0) inFlightRequestCounts.delete(signature);
      else inFlightRequestCounts.set(signature, remaining);
    }
    const originalRequest = error.config;
    const status = error.response?.status;
    emitDiagnosticEvent('error', 'api_error', {
      signature,
      workflow: error?.config?.metadata?.workflow,
      correlationId: error?.config?.metadata?.correlationId,
      status,
      code: error?.response?.data?.code || error?.code || null,
      retried: Boolean(originalRequest?._retry),
      networkRetryCount: originalRequest?._networkRetryCount || 0,
    });
    if (redirecting) {
      return Promise.reject(error);
    }
    const hasResponse = !!error.response;
    const firmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
    const redirectToLogin = () => {
      if (redirecting) return;
      redirecting = true;
      const destination = resolveFirmLoginPath({
        fallbackFirmSlug: firmSlug,
      });
      const currentPath = window.location.pathname || '';
      const alreadyOnLoginRoute = currentPath === destination || isLoginLikePath(currentPath);
      if (alreadyOnLoginRoute) {
        console.info('[AUTH] Skipping hard redirect: already on login route.', { currentPath, destination });
        redirecting = false;
        return;
      }
      window.location.assign(destination);
      // Fallback reset in case navigation is blocked
      setTimeout(() => { redirecting = false; }, REDIRECT_TIMEOUT_MS);
    };
    const clearAuthStorage = () => {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    };
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Network errors (no response) - retry with bounded exponential backoff
    if (!hasResponse) {
      const retries = originalRequest?._networkRetryCount || 0;
      if (retries < 2) {
        const backoffMs = Math.min(INITIAL_BACKOFF_MS * 2 ** retries, MAX_BACKOFF_MS);
        originalRequest._networkRetryCount = retries + 1;
        await delay(backoffMs);
        return api(originalRequest);
      }
      const message = 'Network error. Please check your connection and retry.';
      sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
        message,
        type: 'danger'
      }));
      markErrorToasted(error, message);
      return Promise.reject(error);
    }
    
    // Handle token expiry
    if (status === 401 && refreshFailureDetected && !isPublicAuthFlowRequest(originalRequest)) {
      clearAuthStorage();
      redirectToLogin();
      return Promise.reject(error);
    }

    if (
      status === 401
      && !originalRequest._retry
      && !isPublicAuthFlowRequest(originalRequest)
      && !isRefreshRequest(originalRequest)
    ) {
      originalRequest._retry = true;
      
      try {
        await api.post('/auth/refresh');
        refreshFailureDetected = false;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear storage and redirect to login
        refreshFailureDetected = true;
        console.warn('[AUTH] Refresh failed. Resolving session as unauthenticated.', {
          refreshStatus: refreshError?.response?.status || null,
          refreshCode: refreshError?.code || refreshError?.response?.data?.code || null,
        });
        clearAuthStorage();
        const refreshCode = refreshError?.code || refreshError?.response?.data?.code;
        sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
          message: refreshCode === ERROR_CODES.REFRESH_NOT_SUPPORTED
            ? 'Your admin session has expired. Please log in again.'
            : 'Your session expired. Please log in again.',
          type: 'info'
        }));
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other 401 errors (invalid token, etc.)
    if (status === 401) {
      if (isPublicAuthFlowRequest(originalRequest)) {
        return Promise.reject(error);
      }
      clearAuthStorage();
      sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
        message: 'Your session expired. Please log in again.',
        type: 'info'
      }));
      redirectToLogin();
      return Promise.reject(error);
    }

    // Handle authorization failures without force-logging the user out.
    // A 403 typically means "not allowed for this action" (RBAC/tenant guard),
    // not "session is invalid". Keep auth state intact so users can navigate back.
    if (status === 403) {
      sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
        message: 'You are not allowed to perform that action. Your session is still active.',
        type: 'warning'
      }));
      markErrorToasted(error, 'You are not allowed to perform that action.');
      return Promise.reject(error);
    }

    if (status >= 500) {
      const message = 'A server error occurred. Please try again shortly.';
      sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
        message,
        type: 'danger'
      }));
      markErrorToasted(error, message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
