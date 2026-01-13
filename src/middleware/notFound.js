/**
 * Not Found Handler Middleware
 * Handles 404 errors for undefined routes
 */

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
    action: 'refresh',
  });
};

module.exports = notFound;
