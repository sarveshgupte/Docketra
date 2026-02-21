/**
 * Firm-scoped routes
 *
 * All routes here are mounted under the `/f/:firmSlug` path prefix.
 * The `tenantResolver` middleware runs first on every request, ensuring
 * `req.firm`, `req.firmId`, and `req.firmSlug` are set before any handler.
 *
 * Route structure:
 *   GET  /f/:firmSlug/login  — return firm metadata for the login page
 *   POST /f/:firmSlug/login  — authenticate a firm user (firmSlug from URL)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });

const tenantResolver = require('../middleware/tenantResolver');
const { authLimiter } = require('../middleware/rateLimiters');
const { login } = require('../controllers/auth.controller');
const { noFirmNoTransaction } = require('../middleware/noFirmNoTransaction.middleware');

// Apply rate limiting to all routes before tenant resolution to prevent
// DB enumeration attacks via slug scanning
router.use(authLimiter);

// Apply tenant resolver to every route in this file
router.use(tenantResolver);

/**
 * GET /f/:firmSlug/login
 * Returns public firm metadata so the login page can display firm details.
 * In production the SPA serves the page; in development this returns JSON
 * for easier API testing.
 * Does NOT require authentication.
 */
router.get('/login', (req, res, next) => {
  // Debug log: confirms route resolution with firmSlug params (Step 1 requirement)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Firm login route hit:', req.params);
  }
  // In production the SPA fallback handles browser navigation.
  // Fall through so index.html is served for direct browser visits.
  if (process.env.NODE_ENV === 'production') {
    return next();
  }
  return res.json({
    success: true,
    data: {
      firmId: req.firmIdString,
      firmSlug: req.firmSlug,
      name: req.firmName,
      status: req.firm.status,
      isActive: req.firm.status === 'ACTIVE',
    },
  });
});

/**
 * POST /f/:firmSlug/login
 * Authenticates a firm user.  firmSlug is taken from the URL path rather
 * than the request body, giving a clean, slug-scoped login endpoint.
 */
router.post('/login', noFirmNoTransaction, login);

module.exports = router;
