import { request } from './apiClient';
import { buildQueryString } from '../utils/queryParams';

export const worklistApi = {
  getEmployeeWorklist: (filters = {}) =>
    request((http) => http.get(`/worklists/employee/me${buildQueryString({
      page: filters.page,
      limit: filters.limit,
      assigneeXID: filters.assigneeXID,
      status: filters.status,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: filters.search,
      category: filters.category,
      subcategory: filters.subcategory,
      workbasketId: filters.workbasketId,
    })}`), 'Failed to load employee worklist'),

  getGlobalWorklist: (filters = {}) =>
    request((http) => http.get(`/worklists/global${buildQueryString(filters)}`), 'Failed to load global worklist'),

  pullCases: (caseIds, assignTo = null) => {
    const normalizedCaseIds = (Array.isArray(caseIds) ? caseIds : [caseIds]).filter(Boolean);
    const payload = { caseIds: normalizedCaseIds };
    if (assignTo) payload.assignTo = assignTo;
    return request((http) => http.post('/cases/pull', payload), 'Failed to pull selected dockets');
  },

  /**
   * Move a single docket to a user's worklist or a workbasket.
   * Used by managers/admins to reassign dockets across queues.
   * @param {string} caseId - The docket ID
   * @param {{ destinationType: 'USER_WORKLIST'|'WORKBASKET', assigneeXID?: string, destinationId?: string, note?: string }} params
   */
  moveDocket: (caseId, { destinationType, assigneeXID, destinationId, note } = {}) =>
    request(
      (http) => http.post(`/worklists/employee/${encodeURIComponent(caseId)}/move`, {
        destinationType,
        assigneeXID,
        destinationId,
        note,
      }),
      'Failed to move docket',
    ),

  getCategoryWorklist: (categoryId) =>
    request((http) => http.get(`/worklists/category/${categoryId}`), 'Failed to load category worklist'),

  searchCases: (query) =>
    request((http) => http.get(`/search?q=${encodeURIComponent(query)}`), 'Failed to search dockets'),
};
