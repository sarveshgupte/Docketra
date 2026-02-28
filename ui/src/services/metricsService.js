import api from './api';

export const metricsService = {
  getFirmMetrics: async (firmId) => {
    const response = await api.get(`/firm/${firmId}/metrics`);
    return response.data;
  },
};
