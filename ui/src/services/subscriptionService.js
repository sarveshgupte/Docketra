import api from './api';

export const subscriptionService = {
  getSubscriptionOverview: async () => {
    const response = await api.get('/subscriptions');
    return response.data;
  },

  createSubscriptionOrder: async ({ plan, billingCycle }) => {
    const response = await api.post('/subscriptions/orders', { plan, billingCycle });
    return response.data;
  },

  getOrderStatus: async (orderId) => {
    const response = await api.get(`/subscriptions/orders/${encodeURIComponent(orderId)}`);
    return response.data;
  },

  verifyUtr: async (orderId, utr) => {
    const response = await api.post(`/subscriptions/orders/${encodeURIComponent(orderId)}/verify-utr`, { utr });
    return response.data;
  },
};

export default subscriptionService;
