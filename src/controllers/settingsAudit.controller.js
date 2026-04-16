const settingsAuditService = require('../services/settingsAudit.service');

const getSettingsAudit = async (req, res) => {
  try {
    const firmId = req.user?.firmId;
    if (!firmId) {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }

    const { category, page = 1, limit = 50 } = req.query || {};
    const result = await settingsAuditService.getSettingsAudit({
      firmId,
      category,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch settings audit logs',
      error: error.message,
    });
  }
};

module.exports = {
  getSettingsAudit,
};
