const feedbackService = require('../services/feedback.service');

const submitFeedback = async (req, res) => {
  try {
    const { type, message, pageUrl, screenshot } = req.body || {};
    const result = await feedbackService.createFeedback({
      user: req.user,
      firm: req.firm || null,
      type,
      message,
      pageUrl,
      screenshot,
    });

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully. Thank you for helping us improve Docketra!',
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to submit feedback',
    });
  }
};

const getSuperadminFeedbackList = async (req, res) => {
  try {
    const { status, type, search, page, limit } = req.query || {};
    const result = await feedbackService.listFeedback({
      status,
      type,
      search,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result.feedback,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to fetch feedback list',
    });
  }
};

const getSuperadminFeedbackStats = async (_req, res) => {
  try {
    const stats = await feedbackService.getFeedbackStats();
    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to fetch feedback statistics',
    });
  }
};

const replySuperadminFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body || {};
    const result = await feedbackService.replyToFeedback({
      feedbackId: id,
      response,
      responder: req.user,
    });

    return res.json({
      success: true,
      message: 'Reply sent successfully and emailed to the user',
      data: result.feedback,
    });
  } catch (error) {
    const statusCode = error.message === 'Feedback not found' ? 404 : 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Unable to reply to feedback',
    });
  }
};

module.exports = {
  submitFeedback,
  getSuperadminFeedbackList,
  getSuperadminFeedbackStats,
  replySuperadminFeedback,
};
