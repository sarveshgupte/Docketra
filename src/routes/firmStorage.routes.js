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

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB maximum backup archive size to prevent disk exhaustion
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const isZip = (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.mimetype === 'application/octet-stream' ||
      file.originalname.toLowerCase().endsWith('.zip') ||
      file.originalname.toLowerCase().endsWith('.zip.enc')
    );
    if (!isZip) {
      const err = new Error('Invalid file type. Only ZIP or encrypted backup archives are accepted.');
      err.code = 'INVALID_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

const handleUploadError = (err, req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError || err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum allowed backup size is 50MB.'
        : (err.message || 'Invalid backup file uploaded.'),
    });
  }
  return next(err);
};

const router = applyRouteValidation(express.Router(), routeSchemas);

router.get('/setup-status', userReadLimiter, getFirmSetupStatus);
router.post('/storage/change', userWriteLimiter, requireAdmin, changeFirmStorage);
router.post('/storage/restore/initiate', userWriteLimiter, requireAdmin, upload.single('file'), handleUploadError, initiateStorageRestore);
router.get('/storage/restore/status/:jobId', userReadLimiter, requireAdmin, getRestoreStatus);

module.exports = router;
