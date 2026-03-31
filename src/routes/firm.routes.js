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
 */

const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/firm.routes.schema');
const router = applyRouteValidation(express.Router({ mergeParams: true }), routeSchemas);

const tenantResolver = require('../middleware/tenantResolver');
const { authBlockEnforcer, loginLimiter, publicLimiter } = require('../middleware/rateLimiters');
const { login, verifyLoginOtp, resendLoginOtp } = require('../controllers/auth.controller');
const { noFirmNoTransaction } = require('../middleware/noFirmNoTransaction.middleware');
const { isActiveStatus } = require('../utils/status.utils');
const setTenantLoginScope = (req, _res, next) => {
  req.loginScope = 'tenant';
  next();
};

// Keep the temporary auth block check at the router level, but scope login and
// login throttles to POST endpoints so public firm metadata is not needlessly limited.
router.use(authBlockEnforcer);

// Apply tenant resolver to every route in this file
router.use(tenantResolver);

/**
 * GET /api/:firmSlug/login
 * Returns public firm metadata so the login page can display firm details.
 * Returns JSON in all environments for easier API testing and
 * API-only backend deployments.
 * Does NOT require authentication.
 */
router.get('/login', publicLimiter, (req, res) => {
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
      isActive: isActiveStatus(req.firm?.status),
    },
  });
});

/**
 * POST /api/:firmSlug/login
 * Authenticates a firm user.  firmSlug is taken from the URL path rather
 * than the request body, giving a clean, slug-scoped login endpoint.
 */
router.post('/login', loginLimiter, noFirmNoTransaction, setTenantLoginScope, login);
router.post('/verify-otp', loginLimiter, noFirmNoTransaction, setTenantLoginScope, verifyLoginOtp);
router.post('/resend-otp', loginLimiter, noFirmNoTransaction, setTenantLoginScope, resendLoginOtp);

module.exports = router;
