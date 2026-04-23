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
  detail: (caseId) => `/dockets/${caseId}`,
  comments: (caseId) => `/dockets/${caseId}/comments`,
  attachments: (caseId) => `/dockets/${caseId}/attachments`,
  attachmentIntent: (caseId) => `/dockets/${caseId}/attachments/upload-intent`,
  attachmentFinalize: (caseId) => `/dockets/${caseId}/attachments/finalize`,
};

const uploadViaSignedUrl = ({ uploadUrl, uploadMethod = 'PUT', uploadHeaders = {}, file, onProgress }) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open(uploadMethod, uploadUrl);
  Object.entries(uploadHeaders || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) xhr.setRequestHeader(key, value);
  });
  xhr.upload.onprogress = (event) => {
    if (!onProgress || !event.lengthComputable) return;
    const total = event.total || file.size || 0;
    const loaded = event.loaded || 0;
    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
    onProgress({ loaded, total, percent });
  };
  xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
    ? resolve()
    : reject(new Error(`Direct upload failed with status ${xhr.status}`)));
  xhr.onerror = () => reject(new Error('Direct upload failed due to network error'));
  xhr.send(file);
});

const withCaseInvalidation = async (caseId, requestFn) => {
  const response = await requestFn();
  invalidateCaseCache(caseId);
  return response;
};

const trackingThrottleMap = new Map();
const TRACKING_THROTTLE_MS = 10_000;
const shouldThrottleTracking = (action, caseId) => {
  const key = `${action}:${caseId}`;
  const now = Date.now();
  const previous = trackingThrottleMap.get(key);
  if (previous && (now - previous) < TRACKING_THROTTLE_MS) {
    return true;
  }
  trackingThrottleMap.set(key, now);
  return false;
};

export const caseApi = {
  getCases: (filters = {}) =>
    request((http) => http.get(`/dockets${buildQueryString(filters)}`), 'Failed to load dockets'),

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
          return response;
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

  createDocket: async (docketData, forceCreate = false) => {
    return request((http) => http.post('/dockets', { ...docketData, forceCreate }), 'Failed to create docket');
  },

  createCase: (caseData, forceCreate = false) => caseApi.createDocket(caseData, forceCreate),

  addComment: (caseId, commentText) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(caseRoute.comments(caseId), { text: commentText }), 'Failed to add comment'),
  ),

  addAttachment: async (caseId, file, description, onProgress) => {
    const intentResponse = await request(
      (http) => http.post(caseRoute.attachmentIntent(caseId), {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        description,
      }),
      'Failed to create attachment upload intent',
    );
    const intent = intentResponse?.data;
    await uploadViaSignedUrl({
      uploadUrl: intent?.uploadUrl,
      uploadMethod: intent?.uploadMethod,
      uploadHeaders: intent?.uploadHeaders,
      file,
      onProgress,
    });

    const response = await withCaseInvalidation(
      caseId,
      () => request(
        (http) => http.post(caseRoute.attachmentFinalize(caseId), {
          uploadId: intent.uploadId,
          completion: {
            ...(intent.providerFileId ? { providerFileId: intent.providerFileId } : {}),
            ...(intent.objectKey ? { objectKey: intent.objectKey } : {}),
          },
        }),
        'Failed to finalize attachment upload',
      ),
    );

    return response;
  },

  updateStatus: (caseId, payload) => withCaseInvalidation(
    caseId,
    () => request((http) => http.put(`/dockets/${caseId}/status`, payload), 'Failed to update docket status'),
  ),

  cloneCase: (caseId, payload = {}) => request((http) => http.post(`/dockets/${caseId}/clone`, payload), 'Failed to clone docket'),
  lockCase: (caseId) => request((http) => http.post(`/dockets/${caseId}/lock`), 'Failed to lock docket'),
  unlockCase: (caseId) => request((http) => http.post(`/dockets/${caseId}/unlock`), 'Failed to unlock docket'),

  pullCase: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post('/dockets/pull', { caseIds: [caseId] }), 'Failed to pull docket'),
  ),

  getSummaryPdfUrl: (caseId) => `${window.location.origin}/api/dockets/${caseId}/summary-pdf`,

  getClientDockets: (clientId) => request(
    (http) => http.get(`/clients/${clientId}/dockets?sort=createdAt&order=desc&limit=20`),
    'Failed to load client dockets',
  ),

  moveCaseToGlobal: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/unassign`), 'Failed to move docket to global worklist'),
  ),

  fileCase: (caseId, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/file`, { comment }), 'Failed to file docket'),
  ),

  pendCase: (caseId, comment, reopenDate) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/pend`, { comment, reopenDate }), 'Failed to pend docket'),
  ),

  resolveCase: (caseId, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/resolve`, { comment }), 'Failed to resolve docket'),
  ),

  unpendCase: (caseId, comment = '') => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/unpend`, { comment }), 'Failed to unpend docket'),
  ),

  getMyResolvedCases: () => request((http) => http.get('/dockets/my-resolved'), 'Failed to load resolved dockets'),
  getMyUnassignedCreatedCases: () => request((http) => http.get('/dockets/my-unassigned-created'), 'Failed to load unassigned dockets'),

  assignDocket: (caseId, assigneeXID) => withCaseInvalidation(
    caseId,
    () => request((http) => http.patch(`/dockets/${caseId}/assign`, { assigneeXID }), 'Failed to assign docket'),
  ),

  unassignDocket: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/unassign`), 'Failed to unassign docket'),
  ),

  transitionDocket: (caseId, payload) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/transition`, payload), 'Failed to transition docket'),
  ),


  routeToTeam: (caseId, toTeamId, note = '') => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/route`, { toTeamId, note }), 'Failed to route docket'),
  ),

  acceptRoutedCase: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/accept`, {}), 'Failed to accept routed docket'),
  ),

  returnRoutedCase: (caseId, note = '') => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/return`, { note }), 'Failed to return routed docket'),
  ),

  updateRoutedStatus: (caseId, status) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/routed-status`, { status }), 'Failed to update routed status'),
  ),

  qcAction: (caseId, decision, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/qc-action`, { decision, comment }), 'Failed to perform QC action'),
  ),

  reassignDocket: (caseId, assigneeXID, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/reassign`, { assigneeXID, comment }), 'Failed to reassign docket'),
  ),

  reopenPendingDocket: (caseId, comment) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/reopen-pending`, { comment }), 'Failed to reopen docket'),
  ),

  getDocketComments: (caseId, params = {}) => request(
    (http) => http.get(`/dockets/${caseId}/comments`, { params }),
    'Failed to load comments',
  ),
  generateUploadLink: (caseId, payload) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/upload-link`, payload), 'Failed to generate upload link'),
  ),
  getUploadLinkStatus: (caseId) => request((http) => http.get(`/dockets/${caseId}/upload-link`), 'Failed to load upload link status'),
  revokeUploadLink: (caseId) => withCaseInvalidation(
    caseId,
    () => request((http) => http.post(`/dockets/${caseId}/upload-link/revoke`, {}), 'Failed to revoke upload link'),
  ),

  viewAttachment: (caseId, attachmentId) => {
    window.open(`${window.location.origin}/api/dockets/${caseId}/attachments/${attachmentId}/view`, '_blank');
  },

  downloadAttachment: async (caseId, attachmentId, filename) => {
    const response = await api.get(`/dockets/${caseId}/attachments/${attachmentId}/download`, { responseType: 'blob' });
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
    if (shouldThrottleTracking('open', caseId)) return;
    try { await api.post(`/dockets/${caseId}/track-open`); } catch (error) { console.debug('[Tracking] Failed to track docket open:', error.message); }
  },
  trackCaseView: async (caseId) => {
    try { await api.post(`/dockets/${caseId}/track-view`); } catch (error) { console.debug('[Tracking] Failed to track docket view:', error.message); }
  },
  trackCaseExit: async (caseId) => {
    if (shouldThrottleTracking('exit', caseId)) return;
    try { await api.post(`/dockets/${caseId}/track-exit`); } catch (error) { console.debug('[Tracking] Failed to track docket exit:', error.message); }
  },

  getCaseHistory: (caseId) => request((http) => http.get(`/dockets/${caseId}/history`), 'Failed to load docket history'),

  getDocketTimeline: (caseId, params = {}) => request((http) => http.get(`/dockets/${caseId}/timeline`, { params }), 'Failed to load docket timeline'),

  getMyPendingCases: () => request((http) => http.get('/dockets/my-pending'), 'Failed to load pending dockets.'),
  getAdminFiledCases: () => request((http) => http.get('/admin/cases/filed'), 'Failed to load filed dockets.'),
};
