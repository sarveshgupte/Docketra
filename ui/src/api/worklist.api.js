import { request } from './apiClient';
import { buildQueryString } from '../utils/queryParams';

export const worklistApi = {
  getEmployeeWorklist: (filters = {}) =>
    request((http) => http.get(`/worklists/employee/me${buildQueryString({ limit: filters.limit, assigneeXID: filters.assigneeXID })}`), 'Failed to load employee worklist'),

  getGlobalWorklist: (filters = {}) =>
    request((http) => http.get(`/worklists/global${buildQueryString(filters)}`), 'Failed to load global worklist'),

  pullCases: (caseIds, assignTo = null) => {
    const normalizedCaseIds = (Array.isArray(caseIds) ? caseIds : [caseIds]).filter(Boolean);
    const payload = { caseIds: normalizedCaseIds };
    if (assignTo) payload.assignTo = assignTo;
    return request((http) => http.post('/cases/pull', payload), 'Failed to pull selected cases');
  },

  getCategoryWorklist: (categoryId) =>
    request((http) => http.get(`/worklists/category/${categoryId}`), 'Failed to load category worklist'),

  searchCases: (query) =>
    request((http) => http.get(`/search?q=${encodeURIComponent(query)}`), 'Failed to search cases'),
};
