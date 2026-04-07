const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { previewBulkUpload, confirmBulkUpload, getBulkUploadJobStatus } = require('../controllers/bulkUpload.controller');

const router = express.Router();

router.post('/:type', authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, previewBulkUpload);
router.post('/:type/confirm', authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, confirmBulkUpload);
router.get('/job/:jobId', authorizeFirmPermission('ADMIN_STATS'), getBulkUploadJobStatus);

module.exports = router;
