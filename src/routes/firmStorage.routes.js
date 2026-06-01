const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/firmStorage.routes.schema');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const { changeFirmStorage } = require('../controllers/storage.controller');
const { getFirmSetupStatus } = require('../controllers/firm.controller');
const { initiateStorageRestore, getRestoreStatus } = require('../controllers/storageRestore.controller');
const { requireAdmin } = require('../middleware/permission.middleware');
const multer = require('multer');
const os = require('os');

const upload = multer({ dest: os.tmpdir() });

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/setup-status', userReadLimiter, getFirmSetupStatus);
router.post('/storage/change', userWriteLimiter, requireAdmin, changeFirmStorage);
router.post('/storage/restore/initiate', userWriteLimiter, requireAdmin, upload.single('file'), initiateStorageRestore);
router.get('/storage/restore/status/:jobId', userReadLimiter, requireAdmin, getRestoreStatus);

module.exports = router;
