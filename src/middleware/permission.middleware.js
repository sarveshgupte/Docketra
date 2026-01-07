const User = require('../models/User.model');

/**
 * Permission Middleware for Docketra Case Management System
 * 
 * Role-based access control for admin-only operations
 */

/**
 * Require Admin role
 * Must be used after authenticate middleware
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findOne({ xID: req.user.xID });
    
    if (!user || user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }
    
    req.userDoc = user;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking permissions',
      error: error.message,
    });
  }
};

module.exports = { requireAdmin };
