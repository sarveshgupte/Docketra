/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const log = require('../utils/log');
const { recordError } = require('../utils/operationalMetrics');
const metricsService = require('../services/metrics.service');

const sendError = (res, status, payload) => {
  const { code, message, action, details } = payload;
  const body = {
    success: false,
    code,
    message,
    ...(action && { action }),
    ...(details && { details }),
  };
  return res.status(status).json(body);
};

const errorHandler = (err, req, res, next) => {
  recordError(req, err);
  metricsService.recordError(err.statusCode || 500);
  // Logging sanitization is handled centrally by the global console.error override to avoid double-masking.
  log.error('REQUEST_FAILED', { req, error: err.message, stack: err.stack });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return sendError(res, 400, {
      code: 'VALIDATION_ERROR',
      message: errors.join('; '),
      action: 'fix_request',
      details: errors,
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return sendError(res, 400, {
      code: 'DUPLICATE',
      message: `${field} already exists`,
      action: 'contact_admin',
      details: { field },
    });
  }
  
  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, 400, {
      code: 'INVALID_ID',
      message: 'Invalid resource ID format',
      action: 'fix_request',
    });
  }
  
  // Default error
  sendError(res, err.statusCode || 500, {
    code: err.code || err.name || 'SERVER_ERROR',
    message: err.message || 'Server Error',
    action: err.action || (err.statusCode && err.statusCode < 500 ? 'retry' : 'contact_admin'),
  });
};

module.exports = errorHandler;
