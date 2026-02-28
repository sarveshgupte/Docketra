const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/public.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { getFirmBySlug } = require('../controllers/superadmin.controller');

/**
 * Public API Routes
 */

router.get('/firms/:firmSlug', getFirmBySlug);

router.post('/signup', async (req, res, next) => {
  try {
    return res.status(202).json({
      success: true,
      message: 'Thank you. Our team will review your request and schedule a walkthrough.',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
