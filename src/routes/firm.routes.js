/**
 * Firm-scoped routes
 *
 * All routes here are mounted under the `/api/:firmSlug` path prefix.
 * The `tenantResolver` middleware runs first on every request, ensuring
 * `req.firm`, `req.firmId`, and `req.firmSlug` are set before any handler.
 *
 * Route structure:
 *   GET  /api/:firmSlug/login        — return firm metadata for the login page
 *   POST /api/:firmSlug/login       — authenticate a firm user (firmSlug from URL)
 *   POST /api/:firmSlug/verify-otp  — verify login OTP and issue tokens
 */

const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/firm.routes.schema');
const router = applyRouteValidation(express.Router({ mergeParams: true }), routeSchemas);

const tenantResolver = require('../middleware/tenantResolver');
const { authBlockEnforcer, loginLimiter } = require('../middleware/rateLimiters');
const { login, verifyLoginOtp } = require('../controllers/auth.controller');
const { noFirmNoTransaction } = require('../middleware/noFirmNoTransaction.middleware');
const setTenantLoginScope = (req, _res, next) => {
  req.loginScope = 'tenant';
  next();
};

// Apply rate limiting to all routes before tenant resolution to prevent
// DB enumeration attacks via slug scanning
router.use(authBlockEnforcer);
router.use(loginLimiter);

// Apply tenant resolver to every route in this file
router.use(tenantResolver);

/**
 * GET /api/:firmSlug/login
 * Returns public firm metadata so the login page can display firm details.
 * Returns JSON in all environments for easier API testing and
 * API-only backend deployments.
 * Does NOT require authentication.
 */
router.get('/login', (req, res) => {
  // Debug log: confirms route resolution with firmSlug params (Step 1 requirement)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Firm login route hit:', req.params);
  }
  return res.json({
    success: true,
    data: {
      firmId: req.firmIdString,
      firmSlug: req.firmSlug,
      name: req.firmName,
      status: req.firm.status,
      isActive: req.firm.status === 'active',
    },
  });
});

/**
 * POST /api/:firmSlug/login
 * Authenticates a firm user.  firmSlug is taken from the URL path rather
 * than the request body, giving a clean, slug-scoped login endpoint.
 */
router.post('/login', noFirmNoTransaction, setTenantLoginScope, login);
router.post('/verify-otp', noFirmNoTransaction, setTenantLoginScope, verifyLoginOtp);

module.exports = router;
