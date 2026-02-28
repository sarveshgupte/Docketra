const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const config = require('../config/config');

const uploadRoot = path.join(__dirname, '../../uploads/private');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const extensionMap = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const normalizeExtension = (name) => path.extname(String(name || '')).toLowerCase();

const isMimeAndExtensionValid = (file) => {
  const allowed = config.security.upload.allowedMimeTypes;
  if (!allowed.includes(file.mimetype)) return false;
  return extensionMap[file.mimetype] === normalizeExtension(file.originalname);
};

const virusScanHook = async () => true;

const createSecureUpload = ({ memory = false } = {}) => {
  const storage = memory ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadRoot),
    filename: (req, file, cb) => cb(null, `${randomUUID()}${extensionMap[file.mimetype] || ''}`),
  });

  return multer({
    storage,
    limits: { fileSize: config.security.upload.maxSizeMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!isMimeAndExtensionValid(file)) {
        const error = new Error('Invalid upload MIME type or extension');
        error.statusCode = 400;
        error.code = 'INVALID_FILE_TYPE';
        return cb(error);
      }
      return cb(null, true);
    },
  });
};

const enforceUploadSecurity = async (req, res, next) => {
  if (!req.file) return next();
  const passed = await virusScanHook(req.file);
  if (!passed) {
    return res.status(400).json({
      success: false,
      error: 'FILE_UPLOAD_REJECTED',
      message: 'Virus scan failed',
    });
  }
  return next();
};

const uploadErrorHandler = (error, req, res, next) => {
  if (!error) return next();
  if (error instanceof multer.MulterError || error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: 'FILE_UPLOAD_REJECTED',
      message: error.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Max ${config.security.upload.maxSizeMB}MB`
        : 'Invalid file upload',
    });
  }
  return next(error);
};

module.exports = {
  createSecureUpload,
  enforceUploadSecurity,
  uploadErrorHandler,
};
