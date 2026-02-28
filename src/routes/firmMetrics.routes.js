const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getFirmMetrics } = require('../controllers/firmMetrics.controller');

const router = express.Router({ mergeParams: true });

router.get('/metrics', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getFirmMetrics);

module.exports = router;
