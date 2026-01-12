const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { attachFirmContext } = require('../middleware/firmContext.middleware');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
} = require('../middleware/rateLimiters');
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  toggleClientStatus,
  changeLegalName,
  updateClientFactSheet,
  uploadFactSheetFile,
  deleteFactSheetFile,
  uploadClientCFSFile,
  listClientCFSFiles,
  deleteClientCFSFile,
  downloadClientCFSFile,
} = require('../controllers/client.controller');

/**
 * Configure multer for client fact sheet and CFS file uploads
 * Uses memory storage for compatibility with ephemeral filesystems (e.g., Render)
 * Files are streamed directly to Google Drive without disk I/O
 */
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

/**
 * Client Management Routes
 * 
 * PR #39: Direct client management for Admin users
 * Admin can create, edit (restricted fields), enable/disable clients
 * No hard deletes allowed - only soft delete via isActive/status flag
 * 
 * PR #49: Client lifecycle governance
 * - Business name changes only via dedicated endpoint with audit trail
 * - PAN/TAN/CIN are immutable
 * - Only email and contact numbers can be updated normally
 * 
 * PR: Client Fact Sheet Foundation
 * - Admin can manage client fact sheet (description, notes, files)
 * - All changes are audited
 */

// Block SuperAdmin from accessing client routes
router.use(authenticate);
router.use(attachFirmContext);

// Public/authenticated endpoints
router.get('/', authorizeFirmPermission('CLIENT_VIEW'), getClients);
router.get('/:clientId', authorizeFirmPermission('CLIENT_VIEW'), getClientById);

// Admin-only endpoints
router.post('/', authorizeFirmPermission('CLIENT_MANAGE'), createClient);
router.put('/:clientId', authorizeFirmPermission('CLIENT_MANAGE'), updateClient);
router.patch('/:clientId/status', authorizeFirmPermission('CLIENT_MANAGE'), toggleClientStatus);
router.post('/:clientId/change-name', authorizeFirmPermission('CLIENT_MANAGE'), changeLegalName);

// Client Fact Sheet endpoints (Admin-only)
router.put('/:clientId/fact-sheet', authorizeFirmPermission('CLIENT_MANAGE'), updateClientFactSheet);
router.post('/:clientId/fact-sheet/files', authorizeFirmPermission('CLIENT_MANAGE'), upload.single('file'), uploadFactSheetFile);
router.delete('/:clientId/fact-sheet/files/:fileId', authorizeFirmPermission('CLIENT_MANAGE'), deleteFactSheetFile);

// Client CFS endpoints
// Admin-only: Upload and delete
router.post('/:clientId/cfs/files', authorizeFirmPermission('CLIENT_MANAGE'), attachmentLimiter, upload.single('file'), uploadClientCFSFile);
router.delete('/:clientId/cfs/files/:attachmentId', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, deleteClientCFSFile);
// All authenticated users: List and download (read-only)
router.get('/:clientId/cfs/files', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, listClientCFSFiles);
router.get('/:clientId/cfs/files/:attachmentId/download', authorizeFirmPermission('CLIENT_VIEW'), attachmentLimiter, downloadClientCFSFile);

module.exports = router;
