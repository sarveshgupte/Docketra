const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/bulkUpload.routes.schema');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { previewBulkUpload, confirmBulkUpload, getBulkUploadJobStatus } = require('../controllers/bulkUpload.controller');

const router = applyRouteValidation(express.Router(), routeSchemas);

router.post('/:type', authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, previewBulkUpload);
router.post('/:type/confirm', authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, confirmBulkUpload);
router.get('/job/:jobId', authorizeFirmPermission('ADMIN_STATS'), getBulkUploadJobStatus);

module.exports = router;
