/**
 * Superadmin Service
 * API calls for Superadmin platform management
 */

import api from './api';

export const superadminService = {
  /**
   * Get platform statistics
   */
  getPlatformStats: async () => {
    const response = await api.get('/superadmin/stats');
    return response.data;
  },

  /**
   * Create a new firm
   */
  createFirm: async (name, adminName, adminEmail) => {
    const response = await api.post('/superadmin/firms', { name, adminName, adminEmail });
    return response.data;
  },

  /**
   * List all firms
   */
  listFirms: async () => {
    const response = await api.get('/superadmin/firms');
    const responseData = response.data;
    const isArrayResponse = Array.isArray(responseData);
    const isSuccessfulStatus = response.status >= 200 && response.status < 300;
    const payload = isArrayResponse
      ? { success: isSuccessfulStatus, data: responseData }
      : responseData || {};
    const isNotModified = response.status === 304;
    // Treat 304 (Not Modified) as success so cached firm lists remain in place.
    const success = isNotModified || isSuccessfulStatus || payload.success === true;
    return {
      ...payload,
      status: response.status,
      success,
    };
  },

  /**
   * Update firm status (activate/suspend)
   */
  updateFirmStatus: async (firmId, status) => {
    const response = await api.patch(`/superadmin/firms/${firmId}`, { status });
    return response.data;
  },

  /**
   * Create firm admin
   */
  createFirmAdmin: async (firmId, adminData) => {
    const response = await api.post(`/superadmin/firms/${firmId}/admin`, adminData);
    return response.data;
  },

  /**
   * Switch into a firm context (impersonation)
   * @param {string} firmId - Firm ID to impersonate
   * @param {string} mode - Impersonation mode: 'READ_ONLY' or 'FULL_ACCESS' (default: 'READ_ONLY')
   */
  switchFirm: async (firmId, mode = 'READ_ONLY') => {
    const response = await api.post('/superadmin/switch-firm', { firmId, mode });
    return response.data;
  },

  /**
   * Resend admin access email (invite or password reset)
   * @param {string} firmId - Firm MongoDB _id
   */
  resendAdminAccess: async (firmId) => {
    const response = await api.post(`/superadmin/firms/${firmId}/admin/resend-access`);
    return response.data;
  },

  /**
   * Get firm default admin details
   * @param {string} firmId - Firm MongoDB _id
   */
  getFirmAdmin: async (firmId) => {
    const response = await api.get(`/superadmin/firms/${firmId}/admin`);
    return response.data;
  },

  /**
   * Update firm default admin status
   * @param {string} firmId - Firm MongoDB _id
   * @param {string} status - ACTIVE | DISABLED
   */
  updateFirmAdminStatus: async (firmId, status) => {
    const response = await api.patch(`/superadmin/firms/${firmId}/admin/status`, { status });
    return response.data;
  },

  /**
   * Force reset firm default admin password
   * @param {string} firmId - Firm MongoDB _id
   */
  forceResetFirmAdmin: async (firmId) => {
    const response = await api.post(`/superadmin/firms/${firmId}/admin/force-reset`);
    return response.data;
  },

  /**
   * Exit firm context and return to GLOBAL scope
   */
  exitFirm: async (sessionId) => {
    const response = await api.post('/superadmin/exit-firm', { sessionId });
    return response.data;
  },
};
