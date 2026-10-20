'use strict';

const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const { isStaffRole, isFirmManagerOrAbove, isSuperAdminRole } = require('../utils/role.utils');
const log = require('../utils/log');

/**
 * Trainee Laptop Shield Middleware
 *
 * Enforces firm-level endpoint file download restrictions for junior staff / article assistants (USER / STAFF / EMPLOYEE role).
 * When restrictTraineeDownloads (or traineeLaptopShield) is enabled on the firm:
 * - Junior staff are blocked from downloading raw client binaries to local personal devices (returns 403 TRAINEE_DOWNLOAD_RESTRICTED).
 * - Inline document viewing / previewing in-app is NEVER blocked so compliance and audit workflows proceed unimpeded.
 * - Partners (PRIMARY_ADMIN, ADMIN) and managers (MANAGER) retain full download access regardless of setting.
 */
async function resolveFirmTraineeShieldSetting(req) {
  // 1. Direct explicit override on req.firm or req
  if (req.firm?.settings?.firm?.restrictTraineeDownloads !== undefined) {
    return Boolean(req.firm.settings.firm.restrictTraineeDownloads);
  }
  if (req.firmSettings?.restrictTraineeDownloads !== undefined) {
    return Boolean(req.firmSettings.restrictTraineeDownloads);
  }

  // 2. Identify ownership firm ID
  const firmId = req.firm?.ownershipFirmId || req.ownershipFirmId || req.firm?.id || req.firmId || req.user?.firmId;
  if (!firmId) return false;

  // 3. Query firm settings if mongoose is connected
  if (mongoose.connection.readyState === 0) return false;

  try {
    let firm = null;
    if (mongoose.Types.ObjectId.isValid(String(firmId))) {
      firm = await Firm.findById(firmId).select('settings.firm').lean();
    }
    if (!firm) {
      firm = await Firm.findOne({ firmId: String(firmId) }).select('settings.firm').lean();
    }
    return Boolean(firm?.settings?.firm?.restrictTraineeDownloads);
  } catch (err) {
    log.warn('[DOWNLOAD_SHIELD] Failed to fetch firm settings for download shield check:', {
      error: err.message,
      firmId,
    });
    return false;
  }
}

async function restrictTraineeDownload(req, res, next) {
  // If user is not authenticated or is superadmin, proceed to standard guards
  if (!req.user || isSuperAdminRole(req.user.role)) {
    return next();
  }

  // Partners and managers are NEVER restricted by the trainee laptop shield
  if (isFirmManagerOrAbove(req.user)) {
    return next();
  }

  // Check if user is junior staff / article assistant
  if (!isStaffRole(req.user.role)) {
    return next();
  }

  // 1. Check user-level setting override first (configured by Primary Admin)
  let isRestricted;
  if (req.user?.traineeLaptopShield === true) {
    isRestricted = true;
  } else if (req.user?.traineeLaptopShield === false) {
    isRestricted = false;
  } else {
    // 2. User has no specific override (null/undefined) - fallback to firm default
    isRestricted = await resolveFirmTraineeShieldSetting(req);
  }

  if (!isRestricted) {
    return next();
  }

  const firmId = req.firm?.ownershipFirmId || req.ownershipFirmId || req.firm?.id || req.firmId || req.user?.firmId;

  log.warn('[TRAINEE_SHIELD] Blocked raw file download attempt by junior staff member due to active Trainee Laptop Shield', {
    xID: req.user?.xID,
    userId: req.user?._id || req.user?.id,
    firmId,
    role: req.user?.role,
    route: req.originalUrl || req.path,
  });

  return res.status(403).json({
    success: false,
    code: 'TRAINEE_DOWNLOAD_RESTRICTED',
    message: 'Trainee Laptop Shield is active for your firm: file downloads are restricted for article assistants to prevent local data leakage. Please use the in-app document preview.',
  });
}

module.exports = {
  restrictTraineeDownload,
  resolveFirmTraineeShieldSetting,
};
