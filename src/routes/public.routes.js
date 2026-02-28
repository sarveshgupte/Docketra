const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/public.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { getFirmBySlug } = require('../controllers/superadmin.controller');
const { createFirmWithAdmin } = require('../modules/onboarding/onboarding.service');

/**
 * Public API Routes
 * 
 * These routes are publicly accessible (no authentication required)
 * Used for login page and other public-facing functionality
 */

// Get firm metadata by slug (for firm-scoped login page)
router.get('/firms/:firmSlug', getFirmBySlug);

router.post('/signup', async (req, res, next) => {
  try {
    const { adminName, adminEmail, firmName, planId } = req.body;
    await createFirmWithAdmin({ adminName, adminEmail, firmName, planId });
    return res.json({ success: true, message: 'Signup received. Please check your email for setup instructions.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
