import { request } from './apiClient';

const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

export const complianceApi = {
  /**
   * Fetch statutory due dates (MCA & GST) for given financial year
   * @param {Object} params - Query params (e.g. { fy: 'FY 2025-26', status, formCategory })
   */
  getDueDates: async (params = {}) =>
    request(
      (api) => api.get('/compliance/due-dates', { params: compactParams(params) }),
      'Failed to load compliance due dates'
    ),

  /**
   * Fetch tribunal and regional director cause list hearings
   * @param {Object} params - Query params (e.g. { fy: 'FY 2025-26', bench, stage })
   */
  getCauseList: async (params = {}) =>
    request(
      (api) => api.get('/hearings/cause-list', { params: compactParams(params) }),
      'Failed to load cause list'
    ),

  /**
   * Dispatch batch WhatsApp reminder for statutory bottlenecks
   * @param {Object} payload - { bottlenecks: string[], clientIds: string[], templateId: string, fy: string }
   */
  broadcastReminder: async (payload = {}) =>
    request(
      (api) => api.post('/compliance/due-dates/broadcast-reminder', payload),
      'Failed to broadcast compliance reminder'
    ),

  /**
   * Track MCA V3 SRN
   * @param {Object} payload - { srn: string, form: string, clientName: string, cin: string }
   */
  trackSrn: async (payload = {}) =>
    request(
      (api) => api.post('/compliance/srn-tracker', payload),
      'Failed to track MCA SRN'
    ),

  /**
   * Record bench order and next hearing date for tribunal hearing
   * @param {string} hearingId - ID of hearing
   * @param {Object} payload - { stage: string, nextHearingDate: string, orderNotes: string, certifiedCopyUrl: string }
   */
  logOrder: async (hearingId, payload = {}) =>
    request(
      (api) => api.post(`/hearings/${hearingId}/log-order`, payload),
      'Failed to log hearing order'
    ),

  /**
   * Mark a compliance filing as filed with SRN and date
   * @param {string} filingId - ID of compliance item
   * @param {Object} payload - { srn: string, filingDate: string, mcaFee: string }
   */
  markFiled: async (filingId, payload = {}) =>
    request(
      (api) => api.post(`/compliance/due-dates/${filingId}/mark-filed`, payload),
      'Failed to mark filing as filed'
    ),

  /**
   * Aggregate endpoint for PCS Command Center dashboard data
   * @param {Object} params - Query params (e.g. { fy: 'FY 2025-26' })
   */
  getPcsDashboardData: async (params = {}) =>
    request(
      (api) => api.get('/dashboard/pcs-command-center', { params: compactParams(params) }),
      'Failed to load PCS command center data'
    ),
};
