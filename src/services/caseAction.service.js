const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const mongoose = require('mongoose');
const { CaseRepository } = require('../repositories');
const { CASE_ACTION_TYPES } = require('../config/constants');
const CaseStatus = require('../domain/case/caseStatus');
const CaseService = require('./case.service');
const { DateTime } = require('luxon');
const { logCaseHistory } = require('./auditLog.service');
const { getCanonicalDocketState } = require('../utils/docketStateMapper');
const { canResolve, canFile } = require('../utils/docketStateTransitions');

const LIFECYCLE_TRANSITIONS = Object.freeze({
  OPEN: Object.freeze([CaseStatus.PENDING, CaseStatus.QC_PENDING, CaseStatus.RESOLVED, CaseStatus.FILED]),
  ACTIVE: Object.freeze([CaseStatus.PENDING, CaseStatus.QC_PENDING, CaseStatus.RESOLVED, CaseStatus.FILED]),
  IN_PROGRESS: Object.freeze([CaseStatus.PENDING, CaseStatus.QC_PENDING, CaseStatus.RESOLVED, CaseStatus.FILED]),
  PENDING: Object.freeze([CaseStatus.OPEN]),
  QC_PENDING: Object.freeze([CaseStatus.RESOLVED, CaseStatus.OPEN]),
  RESOLVED: Object.freeze([]),
  FILED: Object.freeze([]),
});

const normalizeActorRole = (role) => {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN' || normalized === 'SUPERADMIN') return 'ADMIN';
  return 'USER';
};

const assertLifecycleTransitionAllowed = ({ currentStatus, nextStatus, actorRole }) => {
  const current = String(currentStatus || '').toUpperCase();
  const next = String(nextStatus || '').toUpperCase();
  const role = normalizeActorRole(actorRole);

  // User hard stop for QC and terminal states.
  if (role === 'USER' && ['QC_PENDING', 'RESOLVED', 'FILED'].includes(current)) {
    throw new Error('Permission denied');
  }

  const allowed = LIFECYCLE_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error('Invalid lifecycle transition');
  }
};

/**
 * Case Action Service
 * 
 * Provides centralized case action operations with:
 * - Mandatory comment enforcement
 * - Audit trail creation
 * - Status transition validation
 * - xID-based attribution
 * 
 * All case actions (RESOLVE, PEND, FILE) must go through this service
 * to ensure consistency and auditability.
 * 
 * PR: Case Lifecycle & Dashboard Logic
 */

/**
 * Validate that a comment is provided and not empty
 * @param {string} comment - The comment text
 * @throws {Error} If comment is missing or empty
 */
const validateComment = (comment) => {
  if (!comment || comment.trim() === '') {
    throw new Error('Comment is mandatory for this action');
  }
};

/**
 * Record case action in audit trail
 * Creates entries in both CaseHistory (enhanced) and CaseAudit (xID-based)
 * 
 * PR: Comprehensive CaseHistory & Audit Trail - Enhanced with full audit fields
 * 
 * @param {string} caseId - Case identifier
 * @param {string} firmId - Firm identifier (for tenant scoping)
 * @param {string} actionType - Type of action (from CASE_ACTION_TYPES)
 * @param {string} description - Action description
 * @param {string} performedByXID - xID of user performing action
 * @param {string} performedByEmail - Email of user
 * @param {string} actorRole - Role of actor (ADMIN, USER, SYSTEM)
 * @param {object} metadata - Additional metadata for audit log
 * @param {object} req - Express request object (optional, for IP/user agent)
 */
const recordAction = async (caseId, firmId, actionType, description, performedByXID, performedByEmail, actorRole = 'USER', metadata = {}, req = null, session = null) => {
  // Create CaseAudit entry (xID-based)
  if (session) {
    await CaseAudit.create([{
      caseId,
      actionType,
      description,
      performedByXID,
      metadata,
    }], { session });
  } else {
    await CaseAudit.create({
      caseId,
      actionType,
      description,
      performedByXID,
      metadata,
    });
  }
  
  // Create CaseHistory entry with enhanced fields
  await logCaseHistory({
    caseId,
    firmId,
    actionType,
    actionLabel: description,
    description,
    performedBy: performedByEmail,
    performedByXID,
    actorRole,
    metadata,
    req,
    session,
  });
};

/**
 * Resolve a case
 * 
 * Changes case status to RESOLVED with mandatory comment.
 * 
 * @param {string} firmId - Firm ID from req.user.firmId (SECURITY: MUST be from authenticated user)
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory resolution comment
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment is missing or case not found
 */
const resolveCase = async (firmId, caseId, comment, user, req = null) => {
  validateComment(comment);
  
  let caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  if (!caseData) {
    throw new Error('Case not found');
  }

  const currentDocketState = getCanonicalDocketState(caseData);
  if (!canResolve(currentDocketState)) {
    throw new Error(`Resolve is allowed only from IN_PROGRESS or IN_QC. Current state: ${currentDocketState}`);
  }

  const targetStatus = CaseStatus.RESOLVED;
  assertLifecycleTransitionAllowed({
    currentStatus: caseData.status,
    nextStatus: targetStatus,
    actorRole: user?.role,
  });

  const previousStatus = caseData.status;

  await CaseService.updateStatus(caseId, targetStatus, {
    tenantId: firmId,
    role: user.role,
    userId: user.xID,
    performedByXID: user.xID,
    performedBy: user.email,
    actorRole: user.role === 'Admin' ? 'ADMIN' : 'USER',
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
    req,
    notes: comment,
    statusPatch: targetStatus === CaseStatus.QC_PENDING
      ? {
        pendingUntil: null,
        reopenAt: null,
        qcStatus: 'REQUESTED',
        qcBy: user.xID,
        qcAt: new Date(),
        lastActionByXID: user.xID,
        lastActionAt: new Date(),
      }
      : {
        pendingUntil: null,
        reopenAt: null,
        resolvedAt: new Date(),
        lastActionByXID: user.xID,
        lastActionAt: new Date(),
      },
    auditMetadata: {
      commentLength: comment.length,
    },
  });

  caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  // Add comment
  await Comment.create({
    caseId,
    firmId,
    text: comment,
    createdBy: user.email.toLowerCase(),
    createdByXID: user.xID,
    createdByName: user.name,
    note: 'Case resolution comment',
  });
  
  // Record action in audit trail
  await recordAction(
    caseId,
    caseData.firmId,
    targetStatus === CaseStatus.QC_PENDING ? CASE_ACTION_TYPES.CASE_STATUS_CHANGED : CASE_ACTION_TYPES.CASE_RESOLVED,
    targetStatus === CaseStatus.QC_PENDING
      ? `Case moved to QC_PENDING by ${user.xID}. Previous status: ${previousStatus}`
      : `Case resolved by ${user.xID}. Previous status: ${previousStatus}`,
    user.xID,
    user.email,
    user.role === 'Admin' ? 'ADMIN' : 'USER',
    {
      previousStatus,
      newStatus: targetStatus,
      fromStatus: previousStatus,
      toStatus: targetStatus,
      timestamp: new Date(),
      commentLength: comment.length,
    }
  );
  
  return caseData;
};

/**
 * Pend a case
 * 
 * Changes case status to PENDING with mandatory comment and reopenDate.
 * Case disappears from My Worklist but appears in My Pending Cases dashboard.
 * 
 * Backend normalizes reopenDate to 8:00 AM IST regardless of input time.
 * 
 * @param {string} firmId - Firm ID from req.user.firmId (SECURITY: MUST be from authenticated user)
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory pending comment
 * @param {string} reopenDate - Date (YYYY-MM-DD format) when case should auto-reopen
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment or reopenDate is missing, or case not found
 */
const pendCase = async (firmId, caseId, comment, reopenDate, user, req = null) => {
  validateComment(comment);
  
  if (!reopenDate) {
    throw new Error('Reopen date is required');
  }
  
  let caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  if (!caseData) {
    throw new Error('Case not found');
  }

  assertLifecycleTransitionAllowed({
    currentStatus: caseData.status,
    nextStatus: CaseStatus.PENDING,
    actorRole: user?.role,
  });
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  
  // Convert reopenDate to 8:00 AM IST and then to UTC
  const pendingUntil = DateTime
    .fromISO(reopenDate, { zone: 'Asia/Kolkata' })
    .set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
  
  await CaseService.updateStatus(caseId, CaseStatus.PENDING, {
    tenantId: firmId,
    role: user.role,
    userId: user.xID,
    performedByXID: user.xID,
    performedBy: user.email,
    actorRole: user.role === 'Admin' ? 'ADMIN' : 'USER',
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
    req,
    reason: comment,
    statusPatch: {
      pendedByXID: user.xID,
      pendingUntil,
      reopenAt: pendingUntil,
      lastActionByXID: user.xID,
      lastActionAt: new Date(),
    },
    auditMetadata: {
      pendingUntil,
      reopenAt: pendingUntil,
      commentLength: comment.length,
    },
  });

  caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  // Add comment
  await Comment.create({
    caseId,
    firmId,
    text: comment,
    createdBy: user.email.toLowerCase(),
    createdByXID: user.xID,
    createdByName: user.name,
    note: 'Case pending comment',
  });
  
  // Record action in audit trail
  await recordAction(
    caseId,
    caseData.firmId,
    CASE_ACTION_TYPES.CASE_PENDED,
    `Case pended by ${user.xID} until ${pendingUntil}. Previous status: ${previousStatus}`,
    user.xID,
    user.email,
    user.role === 'Admin' ? 'ADMIN' : 'USER',
    {
      previousStatus,
      newStatus: CaseStatus.PENDING,
      pendingUntil,
      reopenAt: pendingUntil,
      commentLength: comment.length,
    }
  );
  
  return caseData;
};

/**
 * File a case
 * 
 * Changes case status to FILED with mandatory comment.
 * Case becomes read-only and is hidden from employee dashboards/worklists.
 * Only admins can see filed cases.
 * 
 * @param {string} firmId - Firm ID from req.user.firmId (SECURITY: MUST be from authenticated user)
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory filing comment
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment is missing or case not found
 */
const fileCase = async (firmId, caseId, comment, user, req = null) => {
  validateComment(comment);
  
  let caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  if (!caseData) {
    throw new Error('Case not found');
  }

  const currentDocketState = getCanonicalDocketState(caseData);
  if (!canFile(currentDocketState)) {
    throw new Error(`Cannot file docket from current state: ${currentDocketState}`);
  }

  // Store previous status for audit
  const previousStatus = caseData.status;

  await CaseService.updateStatus(caseId, CaseStatus.FILED, {
    tenantId: firmId,
    role: user.role,
    userId: user.xID,
    performedByXID: user.xID,
    performedBy: user.email,
    actorRole: user.role === 'Admin' ? 'ADMIN' : 'USER',
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
    req,
    statusPatch: {
      pendingUntil: null,
      reopenAt: null,
      lastActionByXID: user.xID,
      lastActionAt: new Date(),
    },
    auditMetadata: {
      commentLength: comment.length,
    },
  });

  caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  // Add comment
  await Comment.create({
    caseId,
    firmId,
    text: comment,
    createdBy: user.email.toLowerCase(),
    createdByXID: user.xID,
    createdByName: user.name,
    note: 'Case filing comment',
  });
  
  // Record action in audit trail
  await recordAction(
    caseId,
    caseData.firmId,
    CASE_ACTION_TYPES.CASE_FILED,
    `Case filed by ${user.xID}. Previous status: ${previousStatus}`,
    user.xID,
    user.email,
    user.role === 'Admin' ? 'ADMIN' : 'USER',
    {
      previousStatus,
      newStatus: CaseStatus.FILED,
      commentLength: comment.length,
    }
  );
  
  return caseData;
};

/**
 * Unpend a case (manual unpend)
 * 
 * Changes case status from PENDED/PENDING back to OPEN with mandatory comment.
 * Allows users to manually unpend a case before the auto-reopen date.
 * 
 * @param {string} firmId - Firm ID from req.user.firmId (SECURITY: MUST be from authenticated user)
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory unpend comment
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment is missing or case not found
 */
const unpendCase = async (firmId, caseId, comment, user, req = null) => {
  validateComment(comment);
  
  let caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  if (!caseData) {
    throw new Error('Case not found');
  }

  assertLifecycleTransitionAllowed({
    currentStatus: caseData.status,
    nextStatus: CaseStatus.OPEN,
    actorRole: user?.role,
  });
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  const previousPendingUntil = caseData.pendingUntil;

  await CaseService.updateStatus(caseId, CaseStatus.OPEN, {
    tenantId: firmId,
    role: user.role,
    userId: user.xID,
    performedByXID: user.xID,
    performedBy: user.email,
    actorRole: user.role === 'Admin' ? 'ADMIN' : 'USER',
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
    req,
    statusPatch: {
      pendingUntil: null,
      reopenAt: null,
      pendedByXID: null,
      lastActionByXID: user.xID,
      lastActionAt: new Date(),
    },
    auditMetadata: {
      previousPendingUntil,
      manualUnpend: true,
      commentLength: comment.length,
    },
  });

  caseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  // Add comment
  await Comment.create({
    caseId,
    firmId,
    text: comment,
    createdBy: user.email.toLowerCase(),
    createdByXID: user.xID,
    createdByName: user.name,
    note: 'Case unpend comment',
  });
  
  // Record action in audit trail
  await recordAction(
    caseId,
    caseData.firmId,
    CASE_ACTION_TYPES.CASE_UNPENDED,
    `Case manually unpended by ${user.xID}. Previous status: ${previousStatus}. Was pended until: ${previousPendingUntil || 'N/A'}`,
    user.xID,
    user.email,
    user.role === 'Admin' ? 'ADMIN' : 'USER',
    {
      previousStatus,
      newStatus: CaseStatus.OPEN,
      previousPendingUntil,
      manualUnpend: true,
      commentLength: comment.length,
    }
  );
  
  return caseData;
};

/**
 * Helper function to perform auto-reopen logic on a single case
 * 
 * @param {object} caseData - Case document to reopen
 * @private
 */
const performAutoReopen = async (caseData) => {
  const previousStatus = caseData.status;
  const previousPendingUntil = caseData.pendingUntil;
  const now = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await CaseService.updateStatus(caseData.caseId, CaseStatus.OPEN, {
        tenantId: caseData.firmId,
        role: 'Admin',
        userId: 'SYSTEM',
        performedByXID: 'SYSTEM',
        performedBy: 'SYSTEM',
        actorRole: 'SYSTEM',
        session,
        statusPatch: {
          pendingUntil: null,
          reopenAt: null,
          lastActionByXID: 'SYSTEM',
          lastActionAt: now,
        },
        auditMetadata: {
          pendingUntil: previousPendingUntil,
          autoReopened: true,
          reason: 'pending_until elapsed',
          reopened_at: now.toISOString(),
        },
      });

      // Add system comment
      await Comment.create([{
        caseId: caseData.caseId,
        firmId: caseData.firmId,
        text: `Case automatically reopened after pending period expired (was pended until: ${previousPendingUntil})`,
        createdBy: 'SYSTEM', // Use uppercase for consistency
        createdByXID: 'SYSTEM',
        note: 'Auto-reopen system action',
      }], { session });

      // Record action in audit trail
      await recordAction(
        caseData.caseId,
        caseData.firmId,
        CASE_ACTION_TYPES.CASE_AUTO_REOPENED,
        `Case automatically reopened by system. Previous status: ${previousStatus}. Was pended until: ${previousPendingUntil}`,
        'SYSTEM',
        'SYSTEM',
        'SYSTEM',
        {
          previousStatus,
          newStatus: CaseStatus.OPEN,
          pendingUntil: previousPendingUntil,
          autoReopened: true,
          reason: 'pending_until elapsed',
          reopened_at: now.toISOString(),
        },
        null,
        session
      );
    });
  } finally {
    await session.endSession();
  }
};

/**
 * Auto-reopen expired pending cases for a specific user
 * 
 * Finds all cases assigned to userXid with status PENDING where pendingUntil <= now
 * and changes their status back to OPEN.
 * 
 * This is called at read time (worklist, dashboard) to ensure data correctness
 * even without a background job scheduler.
 * 
 * @param {string} userXid - User's xID to scope the auto-reopen
 * @returns {object} Results with count of reopened cases
 */
const autoReopenExpiredPendingCases = async (userXid, firmId = null) => {
  const now = new Date();
  
  // Find all pended cases for this user where pendingUntil has passed
  const pendedCases = await Case.find({
    status: CaseStatus.PENDING,
    pendingUntil: { $lte: now },
    assignedToXID: userXid,
    ...(firmId ? { firmId } : {}),
  });
  
  const reopenedCases = [];
  
  await Promise.all(pendedCases.map(async (caseData) => {
    // Intentionally run concurrently to prevent N+1 sequencing overhead
    await performAutoReopen(caseData);
    reopenedCases.push(caseData.caseId);
  }));
  
  return {
    success: true,
    count: reopenedCases.length,
    cases: reopenedCases,
  };
};

/**
 * Auto-reopen pended cases (global)
 * 
 * Finds all cases with status PENDING where pendingUntil <= now
 * and changes their status back to OPEN.
 * 
 * This should be called by a scheduler (cron job) periodically.
 * 
 * @returns {object} Results with count of reopened cases
 */
const autoReopenPendedCases = async (firmId = null) => {
  const now = new Date();
  
  // Find all pended cases where pendingUntil has passed
  const pendedCases = await Case.find({
    status: CaseStatus.PENDING,
    pendingUntil: { $lte: now },
    ...(firmId ? { firmId } : {}),
  });
  
  const reopenedCases = [];
  
  await Promise.all(pendedCases.map(async (caseData) => {
    // Intentionally run concurrently to prevent N+1 sequencing overhead
    await performAutoReopen(caseData);
    reopenedCases.push(caseData.caseId);
  }));
  
  return {
    success: true,
    count: reopenedCases.length,
    cases: reopenedCases,
  };
};

module.exports = {
  resolveCase,
  pendCase,
  fileCase,
  unpendCase,
  autoReopenPendedCases,
  autoReopenExpiredPendingCases,
  validateComment,
  recordAction,
};
