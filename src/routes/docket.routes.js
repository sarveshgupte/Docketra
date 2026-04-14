const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { createDocketFromAttachment, getDocketAiSuggestions } = require('../controllers/docketAi.controller');

const router = express.Router();

router.get('/ai-suggestions/:attachmentId', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getDocketAiSuggestions);
router.post('/from-attachment/:attachmentId', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, createDocketFromAttachment);

module.exports = router;
