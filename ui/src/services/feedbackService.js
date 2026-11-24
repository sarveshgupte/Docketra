import api from './api';

export const feedbackService = {
  /**
   * Submit bug report, error or user feedback
   * @param {{ type: 'BUG'|'FEEDBACK'|'ERROR'|'OTHER', message: string, pageUrl?: string, screenshot?: string }} payload
   */
  submitFeedback: async (payload) => {
    const response = await api.post('/feedback', payload);
    return response.data;
  },

  /**
   * Superadmin: List feedback submissions with pagination & filters
   */
  getFeedbackList: async (params = {}) => {
    const response = await api.get('/superadmin/feedback', { params });
    return response.data;
  },

  /**
   * Superadmin: Get feedback statistics
   */
  getFeedbackStats: async () => {
    const response = await api.get('/superadmin/feedback/stats');
    return response.data;
  },

  /**
   * Superadmin: Reply to feedback and trigger user email notification
   */
  replyFeedback: async (id, responseText) => {
    const response = await api.post(`/superadmin/feedback/${id}/reply`, { response: responseText });
    return response.data;
  },
};

export default feedbackService;
