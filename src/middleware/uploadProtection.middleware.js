const multer = require('multer');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { randomUUID } = require('crypto');
const config = require('../config/config');

const uploadRoot = path.join(__dirname, '../../uploads/private');
const ensureUploadRoot = () => {
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }
  return uploadRoot;
};
ensureUploadRoot();

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

const CLAMAV_HOST = process.env.CLAMAV_HOST || '';
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT || 3310);
const CLAMAV_TIMEOUT_MS = Number(process.env.CLAMAV_TIMEOUT_MS || 10000);
const enforceScanStrictly = process.env.NODE_ENV === 'production' || process.env.UPLOAD_SCAN_STRICT === 'true';

const buildClamPayload = (inputBuffer) => {
  const chunks = [Buffer.from('zINSTREAM\0')];
  const chunkSize = 1024 * 64;
  for (let offset = 0; offset < inputBuffer.length; offset += chunkSize) {
    const slice = inputBuffer.subarray(offset, offset + chunkSize);
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32BE(slice.length, 0);
    chunks.push(sizeBuffer, slice);
  }
  chunks.push(Buffer.alloc(4));
  return Buffer.concat(chunks);
};

const scanBufferWithClamAv = (inputBuffer) => new Promise((resolve, reject) => {
  const socket = net.createConnection({ host: CLAMAV_HOST, port: CLAMAV_PORT });
  let settled = false;
  let response = '';

  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    if (error) reject(error);
    else resolve(value);
  };

  socket.setTimeout(CLAMAV_TIMEOUT_MS, () => finish(new Error('Virus scan timed out')));
  socket.on('error', (error) => finish(error));
  socket.on('data', (chunk) => {
    response += chunk.toString('utf8');
  });
  socket.on('end', () => {
    const normalized = response.trim();
    if (!normalized) {
      return finish(new Error('Virus scanner returned empty response'));
    }
    const infected = normalized.includes('FOUND');
    return finish(null, { infected, response: normalized });
  });
  socket.on('connect', () => {
    const payload = buildClamPayload(inputBuffer);
    socket.end(payload);
  });
});

const readFileBuffer = async (file) => {
  if (Buffer.isBuffer(file?.buffer)) return file.buffer;
  if (file?.path) return fs.promises.readFile(file.path);
  return null;
};

const virusScanHook = async (file) => {
  if (!CLAMAV_HOST) {
    if (enforceScanStrictly) {
      throw new Error('Malware scanner is not configured');
    }
    console.warn('[uploadProtection] Skipping malware scan because CLAMAV_HOST is not configured');
    return { passed: true, skipped: true, reason: 'scanner_not_configured' };
  }

  const buffer = await readFileBuffer(file);
  if (!buffer) {
    throw new Error('Unable to read uploaded file for malware scanning');
  }

  const scanResult = await scanBufferWithClamAv(buffer);
  if (scanResult.infected) {
    return { passed: false, reason: scanResult.response };
  }

  return { passed: true, reason: scanResult.response };
};

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
  try {
    const result = await virusScanHook(req.file);
    console.info('[uploadProtection] Virus scan completed', {
      fileName: req.file.originalname,
      size: req.file.size,
      passed: result.passed,
      reason: result.reason || null,
      skipped: Boolean(result.skipped),
    });

    if (!result.passed) {
      return res.status(400).json({
        success: false,
        error: 'FILE_UPLOAD_REJECTED',
        message: 'Virus scan failed',
      });
    }
  } catch (error) {
    console.error('[uploadProtection] Virus scan error', {
      fileName: req.file.originalname,
      message: error.message,
    });
    return res.status(503).json({
      success: false,
      error: 'FILE_SCAN_UNAVAILABLE',
      message: 'File scanning service unavailable',
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
  ensureUploadRoot,
};
