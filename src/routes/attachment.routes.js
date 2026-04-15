const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/attachment.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getAttachmentAiInsights } = require('../controllers/docketAi.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/:attachmentId/ai-insights', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getAttachmentAiInsights);

module.exports = router;
