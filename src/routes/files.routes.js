const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/files.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { storageHealthGuard } = require('../middleware/storageHealthGuard');
const { requireCaseAccess } = require('../middleware/authorization.middleware');
const { requireStorageConnected } = require('../middleware/requireStorageConnected');
const { requestUpload, downloadFile } = require('../controllers/files.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/request-upload', requireStorageConnected, authorizeFirmPermission('CASE_UPDATE'), userReadLimiter, storageHealthGuard, requireCaseAccess({ source: 'body', field: 'caseId' }), requestUpload);
router.get('/:fileId/download', requireStorageConnected, authorizeFirmPermission('CASE_VIEW'), userReadLimiter, downloadFile);

module.exports = router;
