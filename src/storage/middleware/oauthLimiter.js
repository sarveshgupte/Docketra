const rateLimit = require('express-rate-limit');

/**
 * Stricter OAuth limiter for storage provider connect/callback endpoints.
 * Policy: 10 requests per hour per IP.
 */
const oauthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many OAuth requests. Please wait and try again.',
  },
});

module.exports = { oauthLimiter };
