'use strict';

const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const User = require('../models/User.model');
const { isSuperAdminRole, isAdminRole } = require('../utils/role.utils');

const TENANT_CONTEXT_ERROR = 'Tenant context missing. Request rejected.';

function resolveTenantId(req) {
  return req?.tenant?.id || req?.firm?.id || null;
}

function requireTenant(req, res, next) {
  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: TENANT_CONTEXT_ERROR,
    });
  }

  req.firmId = req.firmId || tenantId;
  return next();
}

async function requireAdmin(req, res, next) {
  try {
    if (!req.user || isSuperAdminRole(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const tenantId = resolveTenantId(req) || req.user?.firmId?.toString?.() || req.user?.firmId || null;
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const userId = req.user?._id || req.user?.id || req.userId || null;
    const query = {
      firmId: tenantId,
      isActive: true,
    };

    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      query._id = userId;
    } else if (req.user?.xID) {
      query.xID = req.user.xID;
    }

    const user = await User.findOne(query);
    if (!user || !isAdminRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    req.userDoc = user;
    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking permissions',
      error: error.message,
    });
  }
}

function requireCaseAccess({
  source = 'params',
  field = 'caseId',
  attachAs = 'caseRecord',
} = {}) {
  return async (req, res, next) => {
    try {
      const tenantId = req.firmId || req.user?.firmId?.toString?.() || req.user?.firmId || resolveTenantId(req);
      const rawCaseRef = source === 'body' ? req.body?.[field] : req.params?.[field];
      const caseRef = String(rawCaseRef || '').trim();

      if (!tenantId || !caseRef) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
        });
      }

      const lookup = {
        firmId: tenantId,
        $or: [{ caseId: caseRef }, { caseNumber: caseRef }],
      };

      if (mongoose.Types.ObjectId.isValid(caseRef)) {
        lookup.$or.unshift({ _id: caseRef });
      }

      const caseRecord = await Case.findOne(lookup);
      if (!caseRecord) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
        });
      }

      req[attachAs] = caseRecord;
      return next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking case access',
        error: error.message,
      });
    }
  };
}

module.exports = {
  TENANT_CONTEXT_ERROR,
  requireTenant,
  requireAdmin,
  requireCaseAccess,
};
