const storageService = require('../services/docketFileStorage.service');
const { sanitizeFilename } = require('../utils/fileUtils');

function mapStorageError(error, res) {
  if (error?.code === 'STORAGE_NOT_CONNECTED') {
    return res.status(400).json({ code: 'STORAGE_NOT_CONNECTED', message: 'Cloud storage must be connected' });
  }
  if (error?.code === 'TOKEN_EXPIRED') {
    return res.status(401).json({ success: false, code: error.code, message: 'Storage authentication expired. Please reconnect storage.' });
  }
  if (error?.code === 'STORAGE_QUOTA_EXCEEDED') {
    return res.status(403).json({ success: false, code: error.code, message: 'Storage quota exceeded for this firm.' });
  }

  const status = error?.status || 500;
  const code = error?.code || 'STORAGE_ERROR';
  return res.status(status).json({ success: false, code, message: error.message || 'Storage operation failed' });
}

async function uploadDocketFile(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    const docketId = req.params.docketId || req.body.docketId || req.caseRecord?.caseId;
    const firmId = req.firmId || req.user?.firmId;
    const uploadedBy = req.user?.xID || req.user?.email || 'unknown';
    const uploadedByName = req.user?.name || req.user?.xID || 'Unknown';

    const metadata = await storageService.uploadFile({
      file: req.file.buffer,
      fileName: req.file.originalname,
      fileType: req.file.mimetype || 'application/octet-stream',
      docketId,
      firmId,
      uploadedBy,
      uploadedByName,
    });

    return res.status(201).json({ success: true, data: metadata });
  } catch (error) {
    return mapStorageError(error, res);
  }
}

async function listDocketAttachments(req, res) {
  try {
    const docketId = req.params.docketId;
    const firmId = req.firmId || req.user?.firmId;
    const items = await storageService.listAttachments({ docketId, firmId });
    return res.json({ success: true, data: items });
  } catch (error) {
    return mapStorageError(error, res);
  }
}

async function getDocketFile(req, res) {
  try {
    const { attachmentId } = req.params;
    const firmId = req.firmId || req.user?.firmId;

    const result = await storageService.getFile({ attachmentId, firmId });

    res.setHeader('Content-Type', result.metadata.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(sanitizeFilename(result.metadata.fileName || 'file'))}"`);

    result.stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream file' });
      }
    });

    return result.stream.pipe(res);
  } catch (error) {
    return mapStorageError(error, res);
  }
}

module.exports = {
  uploadDocketFile,
  listDocketAttachments,
  getDocketFile,
};
