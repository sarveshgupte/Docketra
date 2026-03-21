const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/storage.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { oauthLimiter } = require('../storage/middleware/oauthLimiter');
const {
  getStorageStatus,
  getStorageHealth,
  googleConnect,
  googleCallback,
  googleConfirmDrive,
  getStorageConfiguration,
  testStorageConnection,
} = require('../controllers/storage.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/status', userReadLimiter, getStorageStatus);
router.get('/health', userReadLimiter, getStorageHealth);

router.get('/google/connect', oauthLimiter, googleConnect);
router.get('/google/callback', oauthLimiter, googleCallback);
router.post('/google/confirm-drive', oauthLimiter, googleConfirmDrive);

router.get('/configuration', userReadLimiter, getStorageConfiguration);
router.post('/test-connection', userReadLimiter, testStorageConnection);

module.exports = router;
