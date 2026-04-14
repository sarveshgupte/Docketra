const express = require('express');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getInsightsOverview } = require('../controllers/insights.controller');

const router = express.Router();

router.get('/overview', userReadLimiter, getInsightsOverview);

module.exports = router;
