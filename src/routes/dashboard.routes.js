const express = require('express');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getDashboardSummary } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/summary', userReadLimiter, getDashboardSummary);

module.exports = router;
