import { request } from './apiClient';

export const calendarApi = {
  listEntries: async () =>
    request((api) => api.get('/compliance-calendar'), 'Failed to load calendar entries'),
  createEntry: async (payload) =>
    request((api) => api.post('/compliance-calendar', payload), 'Failed to create calendar entry'),
  updateEntry: async (entryId, payload) =>
    request((api) => api.put(`/compliance-calendar/${entryId}`, payload), 'Failed to update calendar entry'),
  deleteEntry: async (entryId) =>
    request((api) => api.delete(`/compliance-calendar/${entryId}`), 'Failed to delete calendar entry'),
};
