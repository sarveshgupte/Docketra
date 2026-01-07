/**
 * Not Found Handler Middleware
 * Handles 404 errors for undefined routes
 */

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
};

module.exports = notFound;
