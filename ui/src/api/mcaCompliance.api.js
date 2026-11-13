import { request } from './apiClient';

const compactParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

export const mcaComplianceApi = {
  /**
   * Search public MCA corporate directory for instant auto-complete
   */
  searchDirectory: async (query, limit = 10) =>
    request(
      (api) => api.get('/compliance/mca/directory/search', { params: compactParams({ q: query, limit }) }),
      'Failed to search corporate directory'
    ),

  /**
   * Fetch company from public MCA corporate directory by CIN
   */
  getDirectoryCompany: async (cin) =>
    request(
      (api) => api.get(`/compliance/mca/directory/${encodeURIComponent(cin)}`),
      'Failed to load company from directory'
    ),

  /**
   * Sync corporate master data by CIN or LLPIN
   */
  syncCompany: async (payload = {}) =>
    request(
      (api) => api.post('/compliance/mca/sync', payload),
      'Failed to sync corporate master data'
    ),

  /**
   * List corporate master records for the firm
   */
  getRecords: async (params = {}) =>
    request(
      (api) => api.get('/compliance/mca/records', { params: compactParams(params) }),
      'Failed to load corporate records'
    ),

  /**
   * Get corporate master record for a single CIN
   */
  getRecordByCin: async (cin) =>
    request(
      (api) => api.get(`/compliance/mca/records/${encodeURIComponent(cin)}`),
      'Failed to load corporate record'
    ),

  /**
   * Scan compliance alerts (expiring DSCs, DIR-3 KYC, upcoming AGMs)
   */
  getAlerts: async (params = {}) =>
    request(
      (api) => api.get('/compliance/mca/alerts', { params: compactParams(params) }),
      'Failed to load compliance alerts'
    ),

  /**
   * Save or validate an annual filing draft (AOC-4 or MGT-7)
   */
  saveFilingDraft: async (payload = {}) =>
    request(
      (api) => api.post('/compliance/mca/filings/draft', payload),
      'Failed to save filing draft'
    ),

  /**
   * Get review payload and audit checklist for filing draft
   */
  getFilingReview: async (id) =>
    request(
      (api) => api.get(`/compliance/mca/filings/${encodeURIComponent(id)}/review`),
      'Failed to load filing draft review'
    ),

  /**
   * Export MCA V3 package for validated filing draft
   */
  exportFilingPackage: async (id) =>
    request(
      (api) => api.post(`/compliance/mca/filings/${encodeURIComponent(id)}/export`),
      'Failed to export MCA filing package'
    ),

  /**
   * Generate statutory document draft (Board Report, AOC-1, AOC-2, MGT-9)
   */
  generateStatutoryDraft: async (payload = {}) =>
    request(
      (api) => api.post('/compliance/mca/statutory/draft', payload),
      'Failed to generate statutory draft'
    ),

  /**
   * Request client sign-off on statutory draft
   */
  requestStatutorySignOff: async (id, payload = {}) =>
    request(
      (api) => api.post(`/compliance/mca/statutory/${encodeURIComponent(id)}/signoff`, payload),
      'Failed to request statutory sign-off'
    ),
};
