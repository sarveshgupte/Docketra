const express = require('express');
const { getDashboardSummary } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/summary', getDashboardSummary);

module.exports = router;
