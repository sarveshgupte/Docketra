const express = require('express');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/case.routes.schema.js');
const router = applyRouteValidation(express.Router(), routeSchemas);
const { authorizeFirmPermission } = require('../middleware/permission.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const {
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
  sensitiveLimiter,
  commentLimiter,
  fileUploadLimiter,
} = require('../middleware/rateLimiters');
const { createSecureUpload, enforceUploadSecurity } = require('../middleware/uploadProtection.middleware');
const {
  createCase,
  addComment,
  addAttachment,
  cloneCase,
  unpendCase,
  updateCaseStatus,
  getCaseByCaseId,
  getCaseComments,
  getCases,
  searchCases,
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
  getDocketSummaryPdf,
} = require('../controllers/case.controller');
const {
  generateUploadLink,
  getUploadLinkStatus,
  revokeUploadLink,
} = require('../controllers/uploadSession.controller');

const {
  validateCaseCreation,
  validateCaseAssignment,
} = require('../middleware/xidOwnership.middleware');

const {
  checkClientAccess,
  checkCaseClientAccess,
  applyClientAccessFilter,
} = require('../middleware/clientAccess.middleware');
const { validateCaseCommentPayload } = require('../middleware/commentValidation.middleware');
const { requireDocketAccess } = require('../middleware/docketAccess.middleware');
const { requireStorageConnected } = require('../middleware/requireStorageConnected');

const {
  applyAiRouting,
  createDocketFromAttachment,
  getAiRoutingSuggestion,
  getDocketAiSuggestions,
  rejectAiRouting,
} = require('../controllers/docketAi.controller');

const { getTimeline } = require('../controllers/docketActivity.controller');
const { previewDocketBulkUpload, uploadDocketBulk } = require('../controllers/docketBulkUpload.controller');

const upload = createSecureUpload();

const {
  assignDocket,
  transitionDocket,
  qcAction,
  reassignDocket,
  reopenPendingDocket,
  runPendingReopen,
} = require('../controllers/docketWorkflow.controller');

const {
  routeCaseToTeam,
  acceptRoutedCase,
  returnRoutedCase,
  updateRoutedCaseStatus,
  managerMoveCase,
} = require('../controllers/docketRouting.controller');

// Case action routes (RESOLVE, PEND, FILE)
const {
  resolveCase,
  pendCase,
  fileCase,
  getMyPendingCases,
  getMyResolvedCases,
  getMyUnassignedCreatedCases,
  triggerAutoReopen,
} = require('../controllers/caseActions.controller');

// Case tracking routes
const {
  trackCaseOpen,
  trackCaseView,
  trackCaseExit,
  getCaseHistory,
} = require('../controllers/caseTracking.controller');

// Workflow state transition routes
const {
  submitCase,
  moveToUnderReview,
  closeCase,
  reopenCase,
} = require('../controllers/caseWorkflow.controller');

/**
 * Docket Routes
 *
 * Primary RESTful API endpoints for docket management.
 * Mounted at both /api/dockets (canonical) and /api/cases (backward-compat alias).
 *
 * Note: route parameter names use :caseId internally for controller compatibility.
 */

// ── Bulk upload (must come before /:caseId to avoid param matching) ──────────
router.post('/bulk/preview', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, previewDocketBulkUpload);
router.post('/bulk/upload', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, uploadDocketBulk);

// ── Collection-level reads ────────────────────────────────────────────────────
router.get('/', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getCases);
router.get('/search', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, searchCases);

// ── Collection-level writes ───────────────────────────────────────────────────
// POST /api/dockets — create a new docket
router.post('/', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, checkClientAccess, validateCaseCreation, createCase);
// POST /api/dockets/create — alternate create endpoint (legacy UI compatibility)
router.post('/create', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, checkClientAccess, validateCaseCreation, createCase);

// POST /api/dockets/pull — pull one or more dockets into personal worklist
router.post('/pull', authorizeFirmPermission('CASE_UPDATE'), sensitiveLimiter, userWriteLimiter, pullCases);

// POST /api/dockets/auto-reopen-pended — system trigger for auto-reopen
router.post('/auto-reopen-pended', authorizeFirmPermission('CASE_ADMIN_VIEW'), sensitiveLimiter, triggerAutoReopen);

// ── Worklist views (must come before /:caseId) ────────────────────────────────
router.get('/my-pending', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getMyPendingCases);
router.get('/my-resolved', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getMyResolvedCases);
router.get('/my-unassigned-created', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, applyClientAccessFilter, getMyUnassignedCreatedCases);

// ── AI — must come before /:caseId to avoid param matching ────────────────────
router.get('/ai-suggestions/:attachmentId', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getDocketAiSuggestions);
router.post('/from-attachment/:attachmentId', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, createDocketFromAttachment);

// ── Single docket — tracking events ──────────────────────────────────────────
router.post('/:caseId/track-open', authorizeFirmPermission('CASE_VIEW'), userWriteLimiter, checkCaseClientAccess, trackCaseOpen);
router.post('/:caseId/track-view', authorizeFirmPermission('CASE_VIEW'), userWriteLimiter, checkCaseClientAccess, trackCaseView);
router.post('/:caseId/track-exit', authorizeFirmPermission('CASE_VIEW'), userWriteLimiter, checkCaseClientAccess, trackCaseExit);

// ── Single docket — reads ─────────────────────────────────────────────────────
router.get('/:caseId/history', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getCaseHistory);
router.get('/:caseId/summary-pdf', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getDocketSummaryPdf);
router.get('/:caseId/timeline', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, getTimeline);
router.get('/:caseId/ai-routing', authorizeFirmPermission('CASE_UPDATE'), userReadLimiter, getAiRoutingSuggestion);
router.get('/:caseId', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getCaseByCaseId);

// ── Single docket — comments ──────────────────────────────────────────────────
router.post('/:caseId/comments', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, commentLimiter, checkCaseClientAccess, validateCaseCommentPayload, addComment);
router.post('/:caseId/comment', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, commentLimiter, checkCaseClientAccess, validateCaseCommentPayload, addComment);
router.get('/:caseId/comments', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getCaseComments);

// ── Single docket — upload links ──────────────────────────────────────────────
router.post('/:caseId/upload-link', authorizeFirmPermission('CASE_UPDATE'), sensitiveLimiter, userWriteLimiter, checkCaseClientAccess, generateUploadLink);
router.get('/:caseId/upload-link', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getUploadLinkStatus);
router.post('/:caseId/upload-link/revoke', authorizeFirmPermission('CASE_UPDATE'), sensitiveLimiter, userWriteLimiter, checkCaseClientAccess, revokeUploadLink);

// ── Single docket — attachments ───────────────────────────────────────────────
router.post('/:caseId/attachments', requireStorageConnected, upload.single('file'), enforceUploadSecurity, authorizeFirmPermission('CASE_UPDATE'), sensitiveLimiter, attachmentLimiter, fileUploadLimiter, checkCaseClientAccess, addAttachment);
router.get('/:caseId/attachments/:attachmentId/view', requireStorageConnected, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, viewAttachment);
router.get('/:caseId/attachments/:attachmentId/download', requireStorageConnected, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, downloadAttachment);

// ── Single docket — lifecycle actions ────────────────────────────────────────
router.post('/:caseId/clone', authorizeFirmPermission('CASE_CREATE'), userWriteLimiter, checkCaseClientAccess, validateCaseAssignment, cloneCase);
router.post('/:caseId/unpend', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, checkCaseClientAccess, unpendCase);
router.put('/:caseId/status', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, updateCaseStatus);
router.post('/:caseId/lock', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, lockCaseEndpoint);
router.post('/:caseId/unlock', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, unlockCaseEndpoint);
router.post('/:caseId/activity', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, updateCaseActivity);
router.post('/:caseId/submit', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, submitCase);
router.post('/:caseId/review', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, moveToUnderReview);
router.post('/:caseId/close', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, closeCase);
router.post('/:caseId/reopen', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, reopenCase);
router.post('/:caseId/resolve', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, resolveCase);
router.post('/:caseId/pend', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, pendCase);
router.post('/:caseId/file', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, fileCase);

// ── Single docket — assignment & workflow ─────────────────────────────────────
router.post('/:caseId/assign', authorizeFirmPermission('CASE_ASSIGN'), userWriteLimiter, checkCaseClientAccess, assignDocket);
router.patch('/:caseId/assign', authorizeFirmPermission('CASE_ASSIGN'), userWriteLimiter, checkCaseClientAccess, assignDocket);
router.post('/:caseId/transition', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, transitionDocket);
router.post('/:caseId/reopen-pending', authorizeFirmPermission('CASE_ACTION'), userWriteLimiter, checkCaseClientAccess, reopenPendingDocket);
router.post('/:caseId/qc-action', authorizeFirmPermission('CASE_ASSIGN'), sensitiveLimiter, userWriteLimiter, checkCaseClientAccess, qcAction);
router.post('/:caseId/reassign', authorizeFirmPermission('CASE_ASSIGN'), sensitiveLimiter, userWriteLimiter, checkCaseClientAccess, reassignDocket);
router.post('/:caseId/apply-ai-routing', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, applyAiRouting);
router.post('/:caseId/reject-ai-routing', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, rejectAiRouting);

// ── Single docket — routing ───────────────────────────────────────────────────
router.post('/:caseId/route', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, requireDocketAccess, routeCaseToTeam);
router.post('/:caseId/accept', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, requireDocketAccess, acceptRoutedCase);
router.post('/:caseId/return', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, requireDocketAccess, returnRoutedCase);
router.post('/:caseId/routed-status', authorizeFirmPermission('CASE_UPDATE'), userWriteLimiter, checkCaseClientAccess, requireDocketAccess, updateRoutedCaseStatus);
router.post('/:caseId/manager-move', requireRole(['MANAGER']), userWriteLimiter, checkCaseClientAccess, requireDocketAccess, managerMoveCase);

// ── Single docket — client fact sheet ────────────────────────────────────────
router.get('/:caseId/client-fact-sheet', authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, getClientFactSheetForCase);
router.get('/:caseId/client-fact-sheet/files/:fileId/view', requireStorageConnected, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, viewClientFactSheetFile);
router.get('/:caseId/client-cfs/files', requireStorageConnected, authorizeFirmPermission('CASE_VIEW'), userReadLimiter, checkCaseClientAccess, listClientCFSFilesForCase);
router.get('/:caseId/client-cfs/files/:attachmentId/download', requireStorageConnected, authorizeFirmPermission('CASE_VIEW'), attachmentLimiter, checkCaseClientAccess, downloadClientCFSFileForCase);

module.exports = router;
