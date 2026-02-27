const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/files.routes.schema');
const { userReadLimiter } = require('../middleware/rateLimiters');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requestUpload, downloadFile } = require('../controllers/files.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/request-upload', authorizeFirmPermission('CASE_UPDATE'), userReadLimiter, requestUpload);
router.get('/:fileId/download', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, downloadFile);

module.exports = router;
