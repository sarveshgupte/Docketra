const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const { isSuperAdminRole } = require('../utils/role.utils');

/**
 * Attach firm context to the request.
 * Resolves firm using params (firmId/firmSlug) or JWT firmId.
 * Fails closed if firm is missing, disabled, or mismatched with JWT.
 * SuperAdmin is blocked from firm-scoped routes.
 */
const attachFirmContext = async (req, res, next) => {
  try {
    // Explicitly block SuperAdmin from firm-scoped routes
    if (req.user && isSuperAdminRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Superadmin cannot access firm-scoped routes',
      });
    }

    const paramFirmId = req.params?.firmId;
    const paramFirmSlug = req.params?.firmSlug ? req.params.firmSlug.toLowerCase().trim() : null;
    const jwtFirmId = req.jwt?.firmId;
    const jwtFirmIdValid = jwtFirmId && mongoose.Types.ObjectId.isValid(jwtFirmId);

    const lookup = [];

    if (paramFirmSlug) {
      lookup.push({ firmSlug: paramFirmSlug });
    }

    if (paramFirmId) {
      // Accept canonical firm code format (e.g., FIRM001)
      if (/^FIRM\d{3,}$/i.test(paramFirmId)) {
        lookup.push({ firmId: paramFirmId.toUpperCase() });
      }
      if (mongoose.Types.ObjectId.isValid(paramFirmId)) {
        lookup.push({ _id: paramFirmId });
      }
    }

    if (jwtFirmIdValid) {
      lookup.push({ _id: jwtFirmId });
    }

    if (lookup.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required',
      });
    }

    const firm = await Firm.findOne({ $or: lookup });

    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    if (firm.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Firm is disabled. Please contact support.',
      });
    }

    if (jwtFirmIdValid && firm._id.toString() !== jwtFirmId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Firm mismatch detected for authenticated user',
      });
    }

    req.firm = {
      id: firm._id.toString(),
      slug: firm.firmSlug,
      status: firm.status,
    };
    req.firmId = firm._id.toString();
    req.firmSlug = firm.firmSlug;

    return next();
  } catch (error) {
    console.error('[FIRM_CONTEXT] Error attaching firm context:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve firm context',
      error: error.message,
    });
  }
};

module.exports = {
  attachFirmContext,
};
