const Firm = require('../models/Firm.model');

const getFirmSetupStatus = async (req, res) => {
  try {
    const firmId = req.user?.firmId;

    if (!firmId) {
      return res.status(403).json({
        success: false,
        message: 'Firm context is required',
      });
    }

    const firm = await Firm.findById(firmId)
      .select('isSetupComplete setupMetadata')
      .lean();

    return res.json({
      success: true,
      data: {
        isSetupComplete: Boolean(firm?.isSetupComplete),
        lastSetup: {
          categories: Number(firm?.setupMetadata?.categories || 0),
          workbaskets: Number(firm?.setupMetadata?.workbaskets || 0),
          templateKey: firm?.setupMetadata?.templateKey || null,
        },
      },
    });
  } catch (_error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch setup status',
    });
  }
};

module.exports = {
  getFirmSetupStatus,
};
