const express = require('express');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { userWriteLimiter } = require('../middleware/rateLimiters');
const { previewBulkUpload, confirmBulkUpload } = require('../controllers/bulkUpload.controller');

const router = express.Router();

router.post('/:type', authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, previewBulkUpload);
router.post('/:type/confirm', authorizeFirmPermission('ADMIN_STATS'), userWriteLimiter, confirmBulkUpload);

module.exports = router;
