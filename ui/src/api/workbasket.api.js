import { request } from './apiClient';

export const workbasketApi = {
  listVisibleWorkbaskets: () => request((http) => http.get('/teams'), 'Failed to load workbaskets'),
};
