const express = require('express');
const { userReadLimiter, authLimiter } = require('../middleware/rateLimiters');
const { getStorageStatus, googleConnect, googleCallback } = require('../controllers/storage.controller');

const router = express.Router();

router.get('/status', userReadLimiter, getStorageStatus);

// Google OAuth connect flow for BYOS
// Both endpoints are already protected by authenticate + firmContext + invariantGuard
// applied at the /api/storage mount point in server.js.
router.get('/google/connect', authLimiter, googleConnect);
router.get('/google/callback', authLimiter, googleCallback);

module.exports = router;
