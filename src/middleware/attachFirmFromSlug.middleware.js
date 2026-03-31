const Firm = require('../models/Firm.model');
const { normalizeFirmSlug } = require('../utils/slugify');

const attachFirmFromSlug = async (req, res, next) => {
  try {
    const rawFirmSlug = req.params?.firmSlug || req.body?.firmSlug || req.query?.firmSlug;
    const firmSlug = normalizeFirmSlug(rawFirmSlug);

    if (!firmSlug) {
      return res.status(400).json({
        success: false,
        message: 'firmSlug is required',
      });
    }

    const firm = await Firm.findOne({ firmSlug, status: 'active' });
    if (!firm?._id) {
      return res.status(404).json({
        success: false,
        message: 'Invalid workspace URL',
      });
    }

    req.firm = firm;
    req.firmId = firm._id;
    req.firmIdString = String(firm._id);
    req.firmSlug = firm.firmSlug;
    req.firmName = firm.name;
    req.params = {
      ...(req.params || {}),
      firmSlug: firm.firmSlug,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { attachFirmFromSlug };
