const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/public.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { getFirmBySlug } = require('../controllers/superadmin.controller');
const EarlyAccessRequest = require('../models/EarlyAccessRequest.model');
const log = require('../utils/log');

/**
 * Public API Routes
 */

router.get('/firms/:firmSlug', getFirmBySlug);

router.post('/signup', async (req, res, next) => {
  try {
    const {
      firmName,
      practiceType,
      teamMembers,
      currentWorkflowSystem,
      compliancePainPoint,
      goLiveTimeline,
    } = req.body;

    const request = await EarlyAccessRequest.create({
      firmName,
      practiceType,
      teamMembers,
      currentWorkflowSystem,
      compliancePainPoint,
      goLiveTimeline,
    });

    log.info('early_access_request_created', {
      req,
      firmName: request.firmName,
      practiceType: request.practiceType,
      teamMembers: request.teamMembers,
      currentWorkflowSystem: request.currentWorkflowSystem,
      compliancePainPoint: request.compliancePainPoint,
      goLiveTimeline: request.goLiveTimeline,
      status: request.status,
      requestCreatedAt: request.createdAt,
    });

    return res.status(202).json({
      success: true,
      message: 'Thank you. Our team will review your request and schedule a walkthrough.',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
