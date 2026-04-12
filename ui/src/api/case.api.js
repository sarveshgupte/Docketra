import api from '../services/api';
import { request } from './apiClient';
import {
  clearPendingCasePromise,
  getLatestCaseSnapshot,
  getCachedCase,
  invalidateCaseCache,
  setLatestCaseSnapshot,
  setCachedCase,
  setPendingCasePromise,
} from '../utils/caseCache';
import { buildQueryString } from '../utils/queryParams';

const caseRoute = {
  detail: (caseId) => `/cases/${caseId}`,
  comments: (caseId) => `/cases/${caseId}/comments`,
  attachments: (caseId) => `/cases/${caseId}/attachments`,
};

const withCaseInvalidation = async (caseId, requestFn) => {
  const response = await requestFn();
  invalidateCaseCache(caseId);
  return response;
};

export const caseApi = {
  getCases: (filters = {}) =>
    request((http) => http.get(`/cases${buildQueryString(filters)}`), 'Failed to load cases'),

  getCaseById: async (caseId, params = {}) => {
    const cached = getCachedCase(caseId, params);
    if (cached) {
      if (cached?.data) {
        setLatestCaseSnapshot(caseId, cached);
      }
      return cached;
    }

    const pendingPromise = request(
      (http) => http.get(caseRoute.detail(caseId), { params }),
      'Failed to load case details',
    )
      .then((response) => {
        if (response?.notModified) {
          const latest = getLatestCaseSnapshot(caseId);
          if (latest) {
            setCachedCase(caseId, params, latest);
            return latest;
          }
          // Return undefined data explicitly to avoid overriding with empty
          return { ...response, data: undefined };
        }
        if (response?.data) {
          setLatestCaseSnapshot(caseId, response);
        }
        setCachedCase(caseId, params, response);
        return response;
      })
      .catch((error) => {
        clearPendingCasePromise(caseId, params);
        throw error;
      });

    setPendingCasePromise(caseId, params, pendingPromise);
    return pendingPromise;
  },

  createCase: (caseData, forceCreate = false) =>
    request((http) => http.post('/cases', { ...caseData, forceCreate }), 'Failed to create case'),

  addComment: (caseId, commentText) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(caseRoute.comments(caseId), { text: commentText }), 'Failed to add comment'),
  ),

  addAttachment: async (caseId, file, description, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);

    const response = await withCaseInvalidation(
      caseId,
      () => request(
        () => api.post(caseRoute.attachments(caseId), formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: typeof onProgress === 'function'
            ? (progressEvent) => {
              const total = progressEvent.total || file.size || 0;
              const loaded = progressEvent.loaded || 0;
              const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
              onProgress({ loaded, total, percent });
            }
            : undefined,
        }),
        'Failed to upload attachment',
      ),
    );

    return response;
  },

  updateStatus: (caseId, payload) => withCaseInvalidation(
    caseId,
    () => request((http) => http.put(`/cases/${caseId}/status`, payload), 'Failed to update case status'),
  ),

  cloneCase: (caseId, payload = {}) => request((http) => http.post(`/cases/${caseId}/clone`, payload), 'Failed to clone case'),
  lockCase: (caseId) => request((http) => http.post(`/cases/${caseId}/lock`), 'Failed to lock case'),
  unlockCase: (caseId) => request((http) => http.post(`/cases/${caseId}/unlock`), 'Failed to unlock case'),

  pullCase: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post('/cases/pull', { caseIds: [caseId] }), 'Failed to pull case'),
  ),

  getSummaryPdfUrl: (caseId) => `${window.location.origin}/api/cases/${caseId}/summary-pdf`,

  getClientDockets: (clientId) => request(
    (http) => http.get(`/clients/${clientId}/dockets?sort=createdAt&order=desc&limit=20`),
    'Failed to load client dockets',
  ),

  moveCaseToGlobal: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/unassign`), 'Failed to move case to global worklist'),
  ),

  fileCase: (caseId, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/file`, { comment }), 'Failed to file case'),
  ),

  pendCase: (caseId, comment, reopenDate) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/pend`, { comment, reopenDate }), 'Failed to pend case'),
  ),

  resolveCase: (caseId, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/resolve`, { comment }), 'Failed to resolve case'),
  ),

  unpendCase: (caseId, comment = '') => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/unpend`, { comment }), 'Failed to unpend case'),
  ),

  getMyResolvedCases: () => request((http) => http.get('/cases/my-resolved'), 'Failed to load resolved cases'),
  getMyUnassignedCreatedCases: () => request((http) => http.get('/cases/my-unassigned-created'), 'Failed to load unassigned cases'),

  assignDocket: (caseId, assigneeXID) => withCaseInvalidation(
    caseId,
    () => request((http) => http.patch(`/cases/${caseId}/assign`, { assigneeXID }), 'Failed to assign case'),
  ),

  unassignDocket: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/unassign`), 'Failed to unassign case'),
  ),

  transitionDocket: (caseId, payload) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/transition`, payload), 'Failed to transition case'),
  ),


  routeToTeam: (caseId, toTeamId, note = '') => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/route`, { toTeamId, note }), 'Failed to route case'),
  ),

  acceptRoutedCase: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/accept`, {}), 'Failed to accept routed case'),
  ),

  returnRoutedCase: (caseId, note = '') => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/return`, { note }), 'Failed to return routed case'),
  ),

  updateRoutedStatus: (caseId, status) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/routed-status`, { status }), 'Failed to update routed status'),
  ),

  qcAction: (caseId, decision, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/qc-action`, { decision, comment }), 'Failed to perform QC action'),
  ),

  reassignDocket: (caseId, assigneeXID, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/reassign`, { assigneeXID, comment }), 'Failed to reassign docket'),
  ),

  reopenPendingDocket: (caseId, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/reopen-pending`, { comment }), 'Failed to reopen docket'),
  ),

  getDocketComments: (caseId) => request((http) => http.get(`/cases/${caseId}/comments`), 'Failed to load comments'),
  generateUploadLink: (caseId, payload) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/upload-link`, payload), 'Failed to generate upload link'),
  ),
  getUploadLinkStatus: (caseId) => request((http) => http.get(`/cases/${caseId}/upload-link`), 'Failed to load upload link status'),
  revokeUploadLink: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/cases/${caseId}/upload-link/revoke`, {}), 'Failed to revoke upload link'),
  ),

  viewAttachment: (caseId, attachmentId) => {
    window.open(`${window.location.origin}/api/cases/${caseId}/attachments/${attachmentId}/view`, '_blank');
  },

  downloadAttachment: async (caseId, attachmentId, filename) => {
    const response = await api.get(`/cases/${caseId}/attachments/${attachmentId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  trackCaseOpen: async (caseId) => {
    try { await api.post(`/cases/${caseId}/track-open`); } catch (error) { console.debug('[Tracking] Failed to track case open:', error.message); }
  },
  trackCaseView: async (caseId) => {
    try { await api.post(`/cases/${caseId}/track-view`); } catch (error) { console.debug('[Tracking] Failed to track case view:', error.message); }
  },
  trackCaseExit: async (caseId) => {
    try { await api.post(`/cases/${caseId}/track-exit`); } catch (error) { console.debug('[Tracking] Failed to track case exit:', error.message); }
  },

  getCaseHistory: (caseId) => request((http) => http.get(`/cases/${caseId}/history`), 'Failed to load case history'),

  getMyPendingCases: () => request((http) => http.get('/cases/my-pending'), 'Failed to load pending cases.'),
  getAdminFiledCases: () => request((http) => http.get('/admin/cases/filed'), 'Failed to load filed cases.'),
};
