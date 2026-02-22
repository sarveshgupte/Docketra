const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const {
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
} = require('../middleware/rateLimiters');
const {
  createCase,
  addComment,
  addAttachment,
  cloneCase,
  unpendCase,
  updateCaseStatus,
  getCaseByCaseId,
  getCases,
  lockCaseEndpoint,
  unlockCaseEndpoint,
  updateCaseActivity,
  pullCases,
  unassignCase,
  viewAttachment,
  downloadAttachment,
  getClientFactSheetForCase,
  viewClientFactSheetFile,
  listClientCFSFilesForCase,
  downloadClientCFSFileForCase,
} = require('../controllers/case.controller');

// PR #44: Import xID ownership validation middleware
const {
  validateCaseCreation,
  validateCaseAssignment,
} = require('../middleware/xidOwnership.middleware');

// Import client access control middleware
const {
  checkClientAccess,
  checkCaseClientAccess,
  applyClientAccessFilter,
} = require('../middleware/clientAccess.middleware');

/**
 * Configure multer for file uploads
 * Store files in uploads/tmp/ directory with unique names
 */

// Ensure uploads/tmp directory exists
const uploadDir = path.join(__dirname, '../../uploads/tmp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(7);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

/**
 * Case Routes
 * RESTful API endpoints for core case management
 */

// GET /api/cases - Get all cases with filtering
// Apply client access filter to exclude restricted clients
router.get('/', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getCases);

// POST /api/cases - Create new case
// PR #44: Apply xID ownership validation guardrails
// Apply client access check to prevent creating cases with restricted clients
router.post('/', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, checkClientAccess, validateCaseCreation, createCase);

// POST /api/cases/pull - Unified pull endpoint for single or multiple cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "pull" as a caseId
// Accepts: { caseIds: ["CASE-20260109-00001"] } or { caseIds: ["CASE-...", "CASE-..."] }
// User identity obtained from req.user (auth middleware), NOT from request body
// PR: Hard Cutover to xID - Removed legacy /cases/:caseId/pull endpoint
router.post('/pull', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, pullCases);

// Case action routes (RESOLVE, PEND, FILE) - PR: Case Lifecycle
const {
  resolveCase,
  pendCase,
  fileCase,
  getMyPendingCases,
  getMyResolvedCases,
  getMyUnassignedCreatedCases,
  triggerAutoReopen,
} = require('../controllers/caseActions.controller');

// GET /api/cases/my-pending - Get my pending cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "my-pending" as a caseId
router.get('/my-pending', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getMyPendingCases);

// GET /api/cases/my-resolved - Get my resolved cases
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching "my-resolved" as a caseId
router.get('/my-resolved', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getMyResolvedCases);

// GET /api/cases/my-unassigned-created - Get unassigned cases created by me
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching as a caseId
// PR: Fix Case Visibility - New endpoint for dashboard accuracy
router.get('/my-unassigned-created', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getMyUnassignedCreatedCases);

// POST /api/cases/auto-reopen-pended - Trigger auto-reopen for pended cases (Admin/System)
router.post('/auto-reopen-pended', authorizeFirmPermission('CASE_ADMIN_VIEW'), triggerAutoReopen);

// Case tracking routes - PR: Comprehensive CaseHistory & Audit Trail
// IMPORTANT: Must come BEFORE /:caseId routes to avoid matching as caseId
const {
  trackCaseOpen,
  trackCaseView,
  trackCaseExit,
  getCaseHistory,
} = require('../controllers/caseTracking.controller');

// POST /api/cases/:caseId/track-open - Track case opened
router.post('/:caseId/track-open', authorizeFirmPermission('CASE_VIEW'), userWriteLimiter, checkCaseClientAccess, trackCaseOpen);

// POST /api/cases/:caseId/track-view - Track case viewed
router.post('/:caseId/track-view', authorizeFirmPermission('CASE_VIEW'), userWriteLimiter, checkCaseClientAccess, trackCaseView);

// POST /api/cases/:caseId/track-exit - Track case exited
router.post('/:caseId/track-exit', authorizeFirmPermission('CASE_VIEW'), userWriteLimiter, checkCaseClientAccess, trackCaseExit);

// GET /api/cases/:caseId/history - Get case audit history
router.get('/:caseId/history', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getCaseHistory);

// GET /api/cases/:caseId - Get case by caseId with comments, attachments, and history
// Check if user can access this case's client
router.get('/:caseId', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getCaseByCaseId);

// POST /api/cases/:caseId/comments - Add comment to case
router.post('/:caseId/comments', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, addComment);

// POST /api/cases/:caseId/attachments - Upload attachment to case
router.post('/:caseId/attachments', upload.single('file'), authorizeFirmPermission('CASE_UPDATE'), attachmentLimiter, checkCaseClientAccess, addAttachment);

// GET /api/cases/:caseId/attachments/:attachmentId/view - View attachment inline
// Note: authenticate middleware accepts xID from query params (req.query.xID)
router.get('/:caseId/attachments/:attachmentId/view', authenticate, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, viewAttachment);

// GET /api/cases/:caseId/attachments/:attachmentId/download - Download attachment
// Note: authenticate middleware accepts xID from query params (req.query.xID)
router.get('/:caseId/attachments/:attachmentId/download', authenticate, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, downloadAttachment);

// POST /api/cases/:caseId/clone - Clone case with comments and attachments
// PR #44: Apply xID validation for assignment fields
router.post('/:caseId/clone', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, checkCaseClientAccess, validateCaseAssignment, cloneCase);

// POST /api/cases/:caseId/unpend - Unpend a case
router.post('/:caseId/unpend', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, checkCaseClientAccess, unpendCase);

// PUT /api/cases/:caseId/status - Update case status
router.put('/:caseId/status', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, updateCaseStatus);

// POST /api/cases/:caseId/lock - Lock a case
router.post('/:caseId/lock', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, lockCaseEndpoint);

// POST /api/cases/:caseId/unlock - Unlock a case
router.post('/:caseId/unlock', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, unlockCaseEndpoint);

// POST /api/cases/:caseId/activity - Update case activity (heartbeat)
router.post('/:caseId/activity', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, updateCaseActivity);

// Workflow state transition routes
const {
  submitCase,
  moveToUnderReview,
  closeCase,
  reopenCase,
} = require('../controllers/caseWorkflow.controller');

// POST /api/cases/:caseId/submit - Submit case for review
router.post('/:caseId/submit', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, submitCase);

// POST /api/cases/:caseId/review - Move case to under review
router.post('/:caseId/review', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, moveToUnderReview);

// POST /api/cases/:caseId/close - Close a case
router.post('/:caseId/close', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, closeCase);

// POST /api/cases/:caseId/reopen - Reopen a case
router.post('/:caseId/reopen', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, reopenCase);

// POST /api/cases/:caseId/resolve - Resolve a case with mandatory comment
router.post('/:caseId/resolve', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, resolveCase);

// POST /api/cases/:caseId/pend - Pend a case with mandatory comment and pendingUntil
router.post('/:caseId/pend', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, pendCase);

// POST /api/cases/:caseId/file - File a case with mandatory comment
router.post('/:caseId/file', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, fileCase);

// POST /api/cases/:caseId/unassign - Move case to global worklist (Admin only)
router.post('/:caseId/unassign', authorizeFirmPermission('CASE_ASSIGN'), userWriteLimiter, unassignCase);

// Client Fact Sheet routes (Read-Only from Case view)
// GET /api/cases/:caseId/client-fact-sheet - Get client fact sheet for a case (read-only)
router.get('/:caseId/client-fact-sheet', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getClientFactSheetForCase);

// GET /api/cases/:caseId/client-fact-sheet/files/:fileId/view - View client fact sheet file (view-only, no download)
router.get('/:caseId/client-fact-sheet/files/:fileId/view', authenticate, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, viewClientFactSheetFile);

// Client CFS access from case context (read-only)
// GET /api/cases/:caseId/client-cfs/files - List client CFS files for this case's client
router.get('/:caseId/client-cfs/files', authenticate, authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, listClientCFSFilesForCase);

// GET /api/cases/:caseId/client-cfs/files/:attachmentId/download - Download client CFS file
router.get('/:caseId/client-cfs/files/:attachmentId/download', authenticate, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, downloadClientCFSFileForCase);

module.exports = router;
