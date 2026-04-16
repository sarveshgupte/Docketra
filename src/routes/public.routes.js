const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/public.routes.schema.js');
const log = require('../utils/log');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { signupLimiter, publicUploadLimiter, formSubmitLimiter } = require('../middleware/rateLimiters');
const { getFirmBySlug } = require('../controllers/superadmin.controller');
const { submitEnterpriseInquiry } = require('../controllers/contact.controller');
const { submitForm } = require('../controllers/form.controller');
const { getPublicLandingPage } = require('../controllers/landingPage.controller');
const EarlyAccessRequest = require('../models/EarlyAccessRequest.model');
const { executeWrite } = require('../utils/executeWrite');
const { createSecureUpload, enforceUploadSecurity } = require('../middleware/uploadProtection.middleware');
const { uploadDocument, getUploadMeta, requestUploadPin } = require('../controllers/uploadSession.controller');

const LOG_LENGTHS = {
  FIRM_NAME: 120,
  PRACTICE_TYPE: 20,
  WORKFLOW_SYSTEM: 200,
  PAIN_POINT: 200,
  TIMELINE: 80,
};

/**
 * Sanitize user-provided strings for structured logging.
 * - replace(/[\r\n\t]+/g, ' '): neutralizes line breaks and tabs to prevent log-forging
 * - replace(/[\u0000-\u001F\u007F]/g, ''): strips remaining control characters while preserving Unicode text
 * - trim() + slice(...): keeps logs concise and bounded for downstream sinks
 */
const sanitizeLogValue = (value, maxLength = 160) =>
  String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);

/**
 * Public API Routes
 */

const upload = createSecureUpload();

router.get('/firms/:firmSlug', getFirmBySlug);

router.get('/pages/:slug', getPublicLandingPage);

router.post('/forms/:id/submit', formSubmitLimiter, submitForm);

router.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const {
      firmName,
      practiceType,
      teamMembers,
      currentWorkflowSystem,
      compliancePainPoint,
      goLiveTimeline,
    } = req.body;

    req.transactionActive = true;

    const request = await executeWrite(req, async (session) => {
      const [createdRequest] = await EarlyAccessRequest.create([{
        firmName,
        practiceType,
        teamMembers,
        currentWorkflowSystem,
        compliancePainPoint,
        goLiveTimeline,
      }], { session });

      return createdRequest;
    });

    log.info('early_access_request_created', {
      req,
      firmName: sanitizeLogValue(request.firmName, LOG_LENGTHS.FIRM_NAME),
      practiceType: sanitizeLogValue(request.practiceType, LOG_LENGTHS.PRACTICE_TYPE),
      teamMembers: request.teamMembers,
      currentWorkflowSystem: sanitizeLogValue(request.currentWorkflowSystem, LOG_LENGTHS.WORKFLOW_SYSTEM),
      compliancePainPoint: sanitizeLogValue(request.compliancePainPoint, LOG_LENGTHS.PAIN_POINT),
      goLiveTimeline: sanitizeLogValue(request.goLiveTimeline, LOG_LENGTHS.TIMELINE),
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

router.post('/contact', submitEnterpriseInquiry);

router.get('/upload/:token/meta', getUploadMeta);
router.post('/upload/:token', publicUploadLimiter, upload.single('file'), enforceUploadSecurity, uploadDocument);
router.post('/upload/:token/request-pin', publicUploadLimiter, requestUploadPin);

module.exports = router;
