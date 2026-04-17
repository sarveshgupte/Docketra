/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const { recordError } = require('../utils/operationalMetrics');
const metricsService = require('../services/metrics.service');
const log = require('../utils/log');

const sendError = (req, res, status, payload) => {
  const { code, message, action, details } = payload;
  const body = {
    success: false,
    code,
    message,
    requestId: req?.requestId || null,
    ...(action && { action }),
    ...(details && { details }),
  };
  return res.status(status).json(body);
};

const errorHandler = (err, req, res, next) => {
  recordError(req, err);
  metricsService.recordError(err.statusCode || 500);
  // Logging sanitization is handled centrally by the structured logger utility.
  log.error('API_ERROR', { req, error: err.message, stack: err.stack });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return sendError(req, res, 400, {
      code: 'VALIDATION_ERROR',
      message: errors.join('; '),
      action: 'retry',
      details: errors,
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return sendError(req, res, 400, {
      code: 'DUPLICATE',
      message: `${field} already exists`,
      action: 'contact_admin',
      details: { field },
    });
  }
  
  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(req, res, 400, {
      code: 'INVALID_ID',
      message: 'Invalid resource ID format',
      action: 'retry',
    });
  }
  
  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode >= 500 ? 'Internal server error' : (err.message || 'Server Error');
  return sendError(req, res, statusCode, {
    code: err.code || err.name || 'SERVER_ERROR',
    message,
    action: err.action || (statusCode < 500 ? 'retry' : 'contact_admin'),
  });
};

module.exports = errorHandler;
