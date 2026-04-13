const express = require('express');
const multer = require('multer');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requireCaseAccess } = require('../middleware/authorization.middleware');
const { uploadDocketFile, listDocketAttachments, getDocketFile } = require('../controllers/docketFileStorage.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

router.post(
  '/dockets/:docketId/attachments',
  authorizeFirmPermission('CASE_UPDATE'),
  requireCaseAccess({ source: 'params', field: 'docketId' }),
  upload.single('file'),
  uploadDocketFile
);

router.get(
  '/dockets/:docketId/attachments',
  authorizeFirmPermission('CASE_VIEW'),
  requireCaseAccess({ source: 'params', field: 'docketId' }),
  listDocketAttachments
);

router.get(
  '/attachments/:attachmentId/download',
  authorizeFirmPermission('CASE_VIEW'),
  getDocketFile
);

module.exports = router;
