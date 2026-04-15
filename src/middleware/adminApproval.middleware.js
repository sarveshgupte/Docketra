const User = require('../models/User.model');
const { resolveRequestFirmRole } = require('../services/authorization.service');
const { isAdminRole } = require('../utils/role.utils');

/**
 * Admin Approval Middleware
 * 
 * Enforces hierarchy-based client approval permissions
 * Only top-most admins can approve client cases:
 * - managerId = null (no manager above them)
 * - OR canApproveClients = true (explicit permission)
 * 
 * Usage: Apply this middleware to client approval endpoints
 */

/**
 * Check if user has client approval permissions
 * Backend-only enforcement for security
 */
const checkClientApprovalPermission = async (req, res, next) => {
  try {
    const firmId = req.firm?.id || req.user?.firmId?.toString();
    const userId = req.userId || req.user?._id?.toString();

    if (!firmId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Firm context and user identity are required',
      });
    }

    const membership = await resolveRequestFirmRole(req, firmId);

    if (!membership || !isAdminRole(membership.canonicalRole || membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only firm Admin users can approve client cases',
      });
    }

    // Reload user to inspect hierarchy flags (managerId/canApproveClients)
    let user = req.user;
    if (!user) {
      user = await User.findOne({ _id: userId, firmId });
    }
    const isTopMostAdmin = user?.managerId === null || user?.managerId === undefined;
    const hasExplicitPermission = user?.canApproveClients === true;

    if (!isTopMostAdmin && !hasExplicitPermission) {
      return res.status(403).json({
        success: false,
        message: 'Only top-most admins or users with explicit client approval permissions can approve client cases',
      });
    }

    // Store user data for use in controller and align approverEmail with authenticated user
    const approverEmail = (user?.email || '').toLowerCase();
    req.approverUser = user;
    req.approverEmail = approverEmail;
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking approval permissions',
      error: error.message,
    });
  }
};

module.exports = {
  checkClientApprovalPermission,
};
