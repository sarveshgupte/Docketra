const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');

const resolveFirmId = (req) => {
  const candidate = req.ownershipFirmId || req.tenant?.ownershipFirmId || req.firm?.id || req.user?.firmId || req.firmId;
  return candidate ? String(candidate).trim() : null;
};

const findFirmByAnyIdentifier = async (identifier) => {
  if (!identifier) return null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await Firm.findById(identifier);
    if (byId) return byId;
  }
  return await Firm.findOne({
    $or: [
      { firmId: identifier },
      { firmSlug: identifier },
      { slug: identifier },
    ],
  });
};

const getFirmSetupStatus = async (req, res) => {
  try {
    const rawFirmId = resolveFirmId(req);

    if (!rawFirmId) {
      return res.status(403).json({
        success: false,
        message: 'Firm context is required',
      });
    }

    const firm = await findFirmByAnyIdentifier(rawFirmId);

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

const completeFirmSetup = async (req, res) => {
  try {
    const rawFirmId = resolveFirmId(req);

    if (!rawFirmId) {
      return res.status(403).json({
        success: false,
        message: 'Firm context is required',
      });
    }

    const firm = await findFirmByAnyIdentifier(rawFirmId);
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    firm.isSetupComplete = true;
    if (!firm.setupMetadata) {
      firm.setupMetadata = {};
    }
    firm.setupMetadata.completedAt = new Date();

    if (req.body?.name && typeof req.body.name === 'string' && req.body.name.trim()) {
      firm.name = req.body.name.trim();
    }
    if (req.body?.practiceType && typeof req.body.practiceType === 'string') {
      if (!firm.settings) firm.settings = {};
      if (!firm.settings.firm) firm.settings.firm = {};
      firm.settings.firm.practiceType = req.body.practiceType.trim();
    }

    await firm.save();

    return res.json({
      success: true,
      message: 'Firm setup completed successfully',
      data: {
        isSetupComplete: true,
        firmName: firm.name,
        firmSlug: firm.firmSlug,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to complete firm setup',
      error: error.message,
    });
  }
};

module.exports = {
  getFirmSetupStatus,
  completeFirmSetup,
};


