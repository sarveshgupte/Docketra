/**
 * Reports Service
 * API client for reports and MIS endpoints
 */

import api from './api';

export const reportsService = {
  /**
   * Get case metrics aggregated by status, category, client, employee
   * @param {Object} filters - Optional filters (fromDate, toDate, status, category, clientId, assignedTo)
   */
  getCaseMetrics: (filters = {}) => {
    return api.get('/reports/case-metrics', { params: filters });
  },

  /**
   * Get pending cases report with ageing calculation
   * @param {Object} filters - Optional filters (category, assignedTo, ageingBucket)
   */
  getPendingCases: (filters = {}) => {
    return api.get('/reports/pending-cases', { params: filters });
  },

  /**
   * Get cases by date range with pagination
   * @param {Object} filters - Filters (fromDate, toDate, status, category, page, limit)
   */
  getCasesByDate: (filters = {}) => {
    return api.get('/reports/cases-by-date', { params: filters });
  },

  /**
   * Export cases as CSV
   * @param {Object} filters - Filters (fromDate, toDate, status, category)
   */
  exportCSV: (filters = {}) => {
    return api.get('/reports/export/csv', {
      params: filters,
      responseType: 'blob',
    });
  },

  /**
   * Export cases as Excel
   * @param {Object} filters - Filters (fromDate, toDate, status, category)
   */
  exportExcel: (filters = {}) => {
    return api.get('/reports/export/excel', {
      params: filters,
      responseType: 'blob',
    });
  },
};
