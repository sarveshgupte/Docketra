/**
 * Case Service
 */

import api from './api';
import { normalizeApiResponse } from './apiResponse';

const caseRoute = {
  detail: (caseId) => `/cases/${caseId}`,
  comments: (caseId) => `/cases/${caseId}/comments`,
  attachments: (caseId) => `/cases/${caseId}/attachments`,
};

const CASE_CACHE_TTL_MS = 30 * 1000;
const caseCache = new Map();
const makeCaseCacheKey = (caseId, params = {}) => `${caseId}:${JSON.stringify(params)}`;
const getCached = (key) => {
  const cached = caseCache.get(key);
  if (!cached) return null;
  if (cached.promise) return cached.promise;
  if ((Date.now() - cached.ts) > CASE_CACHE_TTL_MS) {
    caseCache.delete(key);
    return null;
  }
  return cached.value;
};
const setCached = (key, value) => {
  caseCache.set(key, { value, ts: Date.now() });
};
const invalidateCaseCache = (caseId) => {
  const prefix = `${caseId}:`;
  for (const key of caseCache.keys()) {
    if (key.startsWith(prefix)) {
      caseCache.delete(key);
    }
  }
};

export const caseService = {
  /**
   * Get all cases with optional filters
   */
  getCases: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    const response = await api.get(`/cases${queryString ? `?${queryString}` : ''}`);
    return normalizeApiResponse(response);
  },

  /**
   * Get case by caseId
   */
  getCaseById: async (caseId, params = {}) => {
    const cacheKey = makeCaseCacheKey(caseId, params);
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const pendingPromise = api.get(caseRoute.detail(caseId), { params })
      .then((response) => {
        const normalized = normalizeApiResponse(response);
        setCached(cacheKey, normalized);
        return normalized;
      })
      .catch((error) => {
        caseCache.delete(cacheKey);
        throw error;
      });
    caseCache.set(cacheKey, { promise: pendingPromise, ts: Date.now() });
    return pendingPromise;
  },

  /**
   * Create new case
   */
  createCase: async (caseData, forceCreate = false) => {
    const response = await api.post('/cases', {
      ...caseData,
      forceCreate,
    });
    return normalizeApiResponse(response);
  },

  /**
   * Add comment to case
   */
  addComment: async (caseId, commentText) => {
    const response = await api.post(caseRoute.comments(caseId), {
      text: commentText,
    });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Add attachment to case
   */
  addAttachment: async (caseId, file, description, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    
    const response = await api.post(caseRoute.attachments(caseId), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: typeof onProgress === 'function'
        ? (progressEvent) => {
            const total = progressEvent.total || file.size || 0;
            const loaded = progressEvent.loaded || 0;
            const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
            onProgress({ loaded, total, percent });
          }
        : undefined,
    });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Update case status
   */
  updateStatus: async (caseId, payload) => {
    const response = await api.put(`/cases/${caseId}/status`, payload);
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Clone case
   */
  cloneCase: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/clone`);
    return normalizeApiResponse(response);
  },

  /**
   * Unpend case (Admin only)
   */
  unpendCase: async (caseId, comment = '') => {
    const response = await api.post(`/cases/${caseId}/unpend`, {
      comment,
    });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Lock case
   */
  lockCase: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/lock`);
    return normalizeApiResponse(response);
  },

  /**
   * Unlock case
   */
  unlockCase: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/unlock`);
    return normalizeApiResponse(response);
  },

  /**
   * Pull a single case from global worklist
   * Uses the unified pull endpoint with caseIds array
   */
  pullCase: async (caseId) => {
    const response = await api.post('/cases/pull', { caseIds: [caseId] });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  getSummaryPdfUrl: (caseId) => `${window.location.origin}/api/cases/${caseId}/summary-pdf`,


  getClientDockets: async (clientId) => {
    const response = await api.get(`/clients/${clientId}/dockets?sort=createdAt&order=desc&limit=20`);
    return normalizeApiResponse(response);
  },

  /**
   * Move case to global worklist (unassign) - Admin only
   */
  moveCaseToGlobal: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/unassign`);
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * File a case with mandatory comment
   * Changes status to FILED (read-only, archived)
   */
  fileCase: async (caseId, comment) => {
    const response = await api.post(`/cases/${caseId}/file`, {
      comment,
    });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Pend a case with mandatory comment and reopen date
   * Changes status to PENDED (temporarily paused)
   */
  pendCase: async (caseId, comment, reopenDate) => {
    const response = await api.post(`/cases/${caseId}/pend`, {
      comment,
      reopenDate,
    });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Resolve a case with mandatory comment
   * Changes status to RESOLVED (completed)
   */
  resolveCase: async (caseId, comment) => {
    const response = await api.post(`/cases/${caseId}/resolve`, {
      comment,
    });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Unpend a case with mandatory comment
   * Changes status from PENDED back to OPEN (manual unpend)
   */
  unpendCase: async (caseId, comment) => {
    const response = await api.post(`/cases/${caseId}/unpend`, {
      comment,
    });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  /**
   * Get my resolved cases
   * Returns cases with status RESOLVED that were resolved by current user
   */
  getMyResolvedCases: async () => {
    const response = await api.get('/cases/my-resolved');
    return normalizeApiResponse(response);
  },

  /**
   * Get unassigned cases created by me
   * Returns cases with status UNASSIGNED that were created by current user
   * PR: Fix Case Visibility - New endpoint for dashboard accuracy
   */
  getMyUnassignedCreatedCases: async () => {
    const response = await api.get('/cases/my-unassigned-created');
    return normalizeApiResponse(response);
  },


  assignDocket: async (caseId, assigneeXID) => {
    const response = await api.post(`/cases/${caseId}/assign`, { assigneeXID });
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  unassignDocket: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/unassign`);
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  transitionDocket: async (caseId, payload) => {
    const response = await api.post(`/cases/${caseId}/transition`, payload);
    invalidateCaseCache(caseId);
    return normalizeApiResponse(response);
  },

  getDocketComments: async (caseId) => {
    const response = await api.get(`/cases/${caseId}/comments`);
    return normalizeApiResponse(response);
  },

  /**
   * View attachment inline
   * Opens attachment in new tab
   * Note: Authentication is handled by the backend via the token in cookies/headers
   */
  viewAttachment: (caseId, attachmentId) => {
    const apiBaseUrl = window.location.origin;
    const url = `${apiBaseUrl}/api/cases/${caseId}/attachments/${attachmentId}/view`;
    
    // Open in new tab
    window.open(url, '_blank');
  },

  /**
   * Download attachment
   * Forces file download
   */
  downloadAttachment: async (caseId, attachmentId, filename) => {
    const response = await api.get(`/cases/${caseId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Track case opened
   * PR: Comprehensive CaseHistory & Audit Trail
   * Logs when user opens case detail page
   * Fails silently if logging fails
   */
  trackCaseOpen: async (caseId) => {
    try {
      await api.post(`/cases/${caseId}/track-open`);
    } catch (error) {
      // Fail silently - tracking failures should not affect UX
      console.debug('[Tracking] Failed to track case open:', error.message);
    }
  },

  /**
   * Track case viewed
   * PR: Comprehensive CaseHistory & Audit Trail
   * Logs when user actively views case (debounced)
   * Fails silently if logging fails
   */
  trackCaseView: async (caseId) => {
    try {
      await api.post(`/cases/${caseId}/track-view`);
    } catch (error) {
      // Fail silently - tracking failures should not affect UX
      console.debug('[Tracking] Failed to track case view:', error.message);
    }
  },

  /**
   * Track case exit
   * PR: Comprehensive CaseHistory & Audit Trail
   * Logs when user exits case detail page
   * Fails silently if logging fails
   */
  trackCaseExit: async (caseId) => {
    try {
      await api.post(`/cases/${caseId}/track-exit`);
    } catch (error) {
      // Fail silently - tracking failures should not affect UX
      console.debug('[Tracking] Failed to track case exit:', error.message);
    }
  },

  /**
   * Get case history
   * PR: Comprehensive CaseHistory & Audit Trail
   * Returns chronological audit trail for a case
   */
  getCaseHistory: async (caseId) => {
    const response = await api.get(`/cases/${caseId}/history`);
    return normalizeApiResponse(response);
  },
};
