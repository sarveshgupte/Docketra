const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/storage.routes.schema');
const { userReadLimiter, authLimiter } = require('../middleware/rateLimiters');
const { getStorageStatus, googleConnect, googleCallback } = require('../controllers/storage.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/status', userReadLimiter, getStorageStatus);

// Google OAuth connect flow for BYOS
// Both endpoints are already protected by authenticate + firmContext + invariantGuard
// applied at the /api/storage mount point in server.js.
router.get('/google/connect', authLimiter, googleConnect);
router.get('/google/callback', authLimiter, googleCallback);

module.exports = router;
