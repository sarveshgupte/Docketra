const express = require('express');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { getStorageStatus } = require('../controllers/storage.controller');

const router = express.Router();

router.get('/status', userReadLimiter, getStorageStatus);

module.exports = router;
