const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { createDocketFromAttachment } = require('../controllers/docketAi.controller');

const router = express.Router();

router.post('/from-attachment/:attachmentId', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, createDocketFromAttachment);

module.exports = router;
