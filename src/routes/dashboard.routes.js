const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/dashboard.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const {
  getDashboardSummary,
  getOnboardingProgress,
  getRiskBrief,
  getPartnerMorningDashboard,
  getComplianceControlRoom,
  updateComplianceState,
  getApprovalQueues,
  remindApproval,
  trackOnboardingEvent,
} = require('../controllers/dashboard.controller');
const {
  listComplianceTemplates,
  createComplianceTemplate,
  updateComplianceTemplate,
  seedSampleComplianceTemplates,
  previewComplianceGeneration,
  runComplianceGeneration,
} = require('../controllers/complianceTemplate.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/summary', userReadLimiter, getDashboardSummary);
router.get('/risk-brief', userReadLimiter, getRiskBrief);
router.get('/partner-morning', userReadLimiter, getPartnerMorningDashboard);
router.get('/compliance-control-room', userReadLimiter, getComplianceControlRoom);
router.patch('/compliance-control-room/:caseId/state', userWriteLimiter, updateComplianceState);
router.get('/approval-queues', userReadLimiter, getApprovalQueues);
router.post('/approval-queues/:caseId/remind', userWriteLimiter, remindApproval);
router.get('/compliance-templates', userReadLimiter, listComplianceTemplates);
router.post('/compliance-templates', userWriteLimiter, createComplianceTemplate);
router.put('/compliance-templates/:templateId', userWriteLimiter, updateComplianceTemplate);
router.post('/compliance-templates/seed-samples', userWriteLimiter, seedSampleComplianceTemplates);
router.post('/compliance-generation/preview', userWriteLimiter, previewComplianceGeneration);
router.post('/compliance-generation/run', userWriteLimiter, runComplianceGeneration);
router.get('/onboarding-progress', userReadLimiter, getOnboardingProgress);
router.post('/onboarding-event', userReadLimiter, trackOnboardingEvent);

module.exports = router;
