const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/client.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
  sensitiveLimiter,
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
  createClientCFSUploadIntent,
  finalizeClientCFSUpload,
  deleteFactSheetFile,
  uploadClientCFSFile,
  listClientCFSFiles,
  deleteClientCFSFile,
  downloadClientCFSFile,
  listClientDockets,
  listClientCfsComments,
  addClientCfsComment,
  listClientActivity,
} = require('../controllers/client.controller');


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

// Public/authenticated endpoints
router.get('/', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, getClients);
router.get('/:clientId/dockets', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, listClientDockets);
router.get('/:clientId', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, getClientById);
router.get('/:clientId/activity', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, listClientActivity);
router.get('/:clientId/cfs/comments', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, listClientCfsComments);
router.post('/:clientId/cfs/comments', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, addClientCfsComment);

// Admin-only endpoints
router.post('/', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, createClient);
router.put('/:clientId', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, updateClient);
router.patch('/:clientId/status', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, toggleClientStatus);
router.post('/:clientId/change-name', authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, changeLegalName);

// Client Fact Sheet endpoints (Admin-only)
router.put('/:clientId/fact-sheet', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, updateClientFactSheet);
router.post('/:clientId/fact-sheet/files', authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, uploadFactSheetFile);
router.delete('/:clientId/fact-sheet/files/:fileId', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, deleteFactSheetFile);

// Client CFS endpoints
// Admin-only: Upload and delete
router.post('/:clientId/cfs/files/upload-intent', authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, attachmentLimiter, createClientCFSUploadIntent);
router.post('/:clientId/cfs/files/finalize', authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, attachmentLimiter, finalizeClientCFSUpload);
router.post('/:clientId/cfs/files', authorizeFirmPermission('CLIENT_MANAGE'), sensitiveLimiter, attachmentLimiter, uploadClientCFSFile);
router.delete('/:clientId/cfs/files/:attachmentId', authorizeFirmPermission('CLIENT_MANAGE'), userWriteLimiter, deleteClientCFSFile);
// All authenticated users: List and download (read-only)
router.get('/:clientId/cfs/files', authorizeFirmPermission('CLIENT_VIEW'), userReadLimiter, listClientCFSFiles);
router.get('/:clientId/cfs/files/:attachmentId/download', authorizeFirmPermission('CLIENT_VIEW'), attachmentLimiter, downloadClientCFSFile);

module.exports = router;
