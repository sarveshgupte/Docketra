const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/public.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { getFirmBySlug } = require('../controllers/superadmin.controller');
const { createStarterWorkspace } = require('../modules/onboarding/onboarding.service');

/**
 * Public API Routes
 */

router.get('/firms/:firmSlug', getFirmBySlug);

router.post('/signup', async (req, res, next) => {
  try {
    const { fullName, email, phoneNumber, companyName } = req.body;
    await createStarterWorkspace({ fullName, email, phoneNumber, companyName });
    return res.status(201).json({
      success: true,
      message: 'Workspace created. Please check your email to set up your admin account.',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
