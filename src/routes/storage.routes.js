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
  getStorageOwnershipSummary,
  testStorageConnection,
  exportFirmStorage,
  downloadFirmStorageExport,
  listBackupRuns,
  disconnectStorage,
  storageHealthCheck,
  storageUsage,
} = require('../controllers/storage.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/status', userReadLimiter, getStorageStatus);
router.get('/health', userReadLimiter, getStorageHealth);

router.get('/google/connect', oauthLimiter, requirePrimaryAdmin, googleConnect);
// requirePrimaryAdmin is intentionally omitted here: the callback arrives via Google's browser
// redirect, so JSON 403 would be shown as raw text. Role enforcement is inside googleCallback
// (redirect to error page on failure) and CSRF protection is via the state cookie/param pair.
router.get('/google/callback', oauthLimiter, googleCallback);
router.post('/google/confirm-drive', oauthLimiter, requirePrimaryAdmin, googleConfirmDrive);

router.get('/configuration', userReadLimiter, getStorageConfiguration);
router.get('/ownership-summary', userReadLimiter, getStorageOwnershipSummary);
router.post('/test-connection', userReadLimiter, requirePrimaryAdmin, testStorageConnection);
router.get('/health-check', userReadLimiter, storageHealthCheck);
router.get('/usage', userReadLimiter, storageUsage);
router.post('/disconnect', userReadLimiter, requirePrimaryAdmin, disconnectStorage);
router.get('/export', userReadLimiter, requirePrimaryAdmin, requireStorageConnected, exportFirmStorage);
router.get('/exports', userReadLimiter, requirePrimaryAdmin, requireStorageConnected, listBackupRuns);
router.get('/export/download/:token', userReadLimiter, requirePrimaryAdmin, requireStorageConnected, downloadFirmStorageExport);

module.exports = router;
