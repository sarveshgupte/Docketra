const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/storage.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { oauthLimiter } = require('../services/storage/middleware/oauthLimiter');
const { requirePrimaryAdmin } = require('../middleware/rbac.middleware');
const { requireStorageConnected } = require('../middleware/requireStorageConnected');
const {
  getStorageStatus,
  getStorageHealth,
  googleConnect,
  googleCallback,
  googleConfirmDrive,
  getStorageConfiguration,
  testStorageConnection,
  exportFirmStorage,
  downloadFirmStorageExport,
  disconnectStorage,
  storageHealthCheck,
  storageUsage,
} = require('../controllers/storage.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/status', userReadLimiter, getStorageStatus);
router.get('/health', userReadLimiter, getStorageHealth);

router.get('/google/connect', oauthLimiter, requirePrimaryAdmin, googleConnect);
router.get('/google/callback', oauthLimiter, requirePrimaryAdmin, googleCallback);
router.post('/google/confirm-drive', oauthLimiter, requirePrimaryAdmin, googleConfirmDrive);

router.get('/configuration', userReadLimiter, getStorageConfiguration);
router.post('/test-connection', userReadLimiter, testStorageConnection);
router.get('/health-check', userReadLimiter, storageHealthCheck);
router.get('/usage', userReadLimiter, storageUsage);
router.post('/disconnect', userReadLimiter, requirePrimaryAdmin, disconnectStorage);
router.get('/export', userReadLimiter, requirePrimaryAdmin, requireStorageConnected, exportFirmStorage);
router.get('/export/download/:token', userReadLimiter, requirePrimaryAdmin, requireStorageConnected, downloadFirmStorageExport);

module.exports = router;
