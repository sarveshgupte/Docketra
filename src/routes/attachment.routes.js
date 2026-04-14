const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getAttachmentAiInsights } = require('../controllers/docketAi.controller');

const router = express.Router();

router.get('/:attachmentId/ai-insights', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getAttachmentAiInsights);

module.exports = router;
