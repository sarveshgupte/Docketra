/**
 * Authentication Middleware for Docketra Case Management System
 * 
 * Mock authentication implementation for development/testing
 * In production, this would validate JWT tokens or session cookies
 */

/**
 * Mock authentication - extract xID from request
 * Checks for xID in body, query, or headers
 */
const authenticate = (req, res, next) => {
  const xID = req.body.xID || req.query.xID || req.headers['x-user-id'];
  
  if (!xID) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide xID.',
    });
  }
  
  // In real implementation, this would validate JWT or session
  // For now, we just attach the xID to the request
  req.user = { xID: xID.toUpperCase() };
  next();
};

module.exports = { authenticate };
