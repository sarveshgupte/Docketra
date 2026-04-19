import api from './api';

export const productUpdatesService = {
  getLatest: async () => {
    const response = await api.get('/product-updates/latest');
    return response.data;
  },

  list: async () => {
    const response = await api.get('/product-updates');
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post('/product-updates', payload);
    return response.data;
  },

  markSeen: async (updateId) => {
    const response = await api.patch('/users/mark-update-seen', { updateId });
    return response.data;
  },

  completeTutorial: async (payload = {}) => {
    const response = await api.patch('/users/tutorial/complete', payload);
    return response.data;
  },
};
