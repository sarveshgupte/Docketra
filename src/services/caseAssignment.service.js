const Case = require('../models/Case.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const mongoose = require('mongoose');
const { CaseRepository } = require('../repositories');
const CaseStatus = require('../domain/case/caseStatus');
const CaseService = require('./case.service');

/**
 * Case Assignment Service
 * 
 * Provides centralized case assignment operations with:
 * - Atomic assignment (prevents race conditions)
 * - xID-based ownership
 * - Queue type management (GLOBAL → PERSONAL)
 * - Status transitions (UNASSIGNED → OPEN)
 * - Audit trail creation
 * 
 * All case assignment operations must go through this service to ensure
 * consistency and fix the worklist/dashboard mismatch.
 * 
 * PR: Case Lifecycle & Dashboard Logic
 */

const pullCaseFromWorkbasket = async ({ caseId, tenantId, userId, assigneeObjectId = null, assignerObjectId = null, session = null }) => {
  if (!caseId || !tenantId || !userId) {
    throw new Error('caseId, tenantId, and userId are required');
  }

  const assignedAt = new Date();
  const normalizedUserId = userId.toUpperCase();
  const result = await Case.updateOne(
    {
      caseId,
      firmId: tenantId,
      // Dual check keeps atomic pull safe across legacy assignedTo and canonical assignedToXID migration states.
      assignedToXID: null,
      assignedTo: null,
      status: CaseStatus.UNASSIGNED,
    },
    {
      $set: {
        assignedToXID: normalizedUserId,
        assignedAt,
        assignedTo: assigneeObjectId || null,
        assignedBy: assignerObjectId || assigneeObjectId || null,
        queueType: 'PERSONAL',
      },
    },
    session ? { session } : {}
  );

  if (result.modifiedCount !== 1) {
    console.warn('[AtomicPullConflict]', {
      caseId,
      tenantId,
      reason: 'No row modified',
    });
    return {
      success: false,
      status: 'CONFLICT',
      error: 'Case already assigned',
    };
  }

  await CaseService.updateStatus(caseId, CaseStatus.OPEN, {
    tenantId,
    userId: normalizedUserId,
    performedBy: normalizedUserId,
    performedByXID: normalizedUserId,
    actorRole: 'USER',
    currentStatus: CaseStatus.UNASSIGNED,
    session,
    auditMetadata: {
      reason: 'WORKBASKET_PULL',
    },
    statusPatch: {
      lastActionByXID: normalizedUserId,
      lastActionAt: assignedAt,
    },
  });

  setImmediate(() => {
    CaseAudit.create({
      caseId,
      actionType: 'CASE_ASSIGNED',
      description: `Case assigned to ${normalizedUserId} via workbasket pull`,
      performedByXID: normalizedUserId,
      metadata: {
        previousValue: null,
        newValue: normalizedUserId,
        tenantId,
        timestamp: assignedAt,
      },
    }).catch((error) => {
      console.error('[pullCaseFromWorkbasket] Non-blocking audit write failed:', error?.message || error);
    });
  });

  return {
    success: true,
    status: 'ASSIGNED',
    caseId,
    assignedTo: normalizedUserId,
    assignedAt,
  };
};

/**
 * Assign a case to a user (Pull from Global Worklist)
 * 
 * Atomically assigns a case to a user with:
 * - assignedTo = userXID
 * - queueType = PERSONAL
 * - status = OPEN
 * - assignedAt = now
 * 
 * This is the CANONICAL way to pull cases from the global worklist.
 * After this operation, the case:
 * - Disappears from Global Worklist
 * - Appears in user's My Worklist
 * - Counted in user's "My Open Cases" dashboard
 * 
 * @param {string} firmId - Firm ID from req.user.firmId (SECURITY: MUST be from authenticated user)
 * @param {string} caseId - Case identifier
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case or null if already assigned
 * @throws {Error} If case not found or user invalid
 */
const assignCaseToUser = async (firmId, caseId, user, session = null) => {
  if (!user || !user.xID) {
    throw new Error('Valid user with xID is required for case assignment');
  }

  const assignmentResult = await pullCaseFromWorkbasket({
    caseId,
    tenantId: firmId,
    userId: user.xID,
    session,
  });

  if (!assignmentResult.success) {
    return {
      success: false,
      message: assignmentResult.error,
    };
  }
  const updatedCaseData = await CaseRepository.findByCaseId(firmId, caseId, user.role);
  
  return {
    success: true,
    status: assignmentResult.status,
    caseId: assignmentResult.caseId,
    assignedTo: assignmentResult.assignedTo,
    data: updatedCaseData,
  };
};

/**
 * Bulk assign multiple cases to a user
 * 
 * Atomically assigns multiple cases with race safety.
 * Uses updateMany with atomic filter to prevent double assignment.
 * 
 * @param {string[]} caseIds - Array of case identifiers
 * @param {object} user - User object with xID and email
 * @returns {object} Results with count of assigned cases
 */
const bulkAssignCasesToUser = async (firmId, caseIds, user, assignerObjectId = null, existingSession = null, useTransaction = true) => {
  if (!user || !user.xID) {
    throw new Error('Valid user with xID is required for case assignment');
  }

  if (!user.role) {
    console.warn('[ROLE_MISSING]', {
      userXID: user.xID,
    });
  }
  
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    throw new Error('Case IDs array is required and must not be empty');
  }
  
  const assignedAt = new Date();
  const session = existingSession || await mongoose.startSession();
  const ownsSession = !existingSession;
  try {
    if (ownsSession && useTransaction) {
      session.startTransaction();
    }

    const result = await Case.updateMany(
      {
        firmId,
        caseId: { $in: caseIds },
        status: CaseStatus.UNASSIGNED,
        assignedToXID: null,
        assignedTo: null,
        $or: [
          { 'lockStatus.isLocked': { $ne: true } },
          { lockStatus: { $exists: false } },
        ],
      },
      {
        $set: {
          assignedToXID: user.xID.toUpperCase(), // CANONICAL: Store xID in assignedToXID
          assignedTo: user._id || null,
          assignedBy: assignerObjectId || user._id || null,
          queueType: 'PERSONAL', // Move from GLOBAL to PERSONAL queue
          assignedAt,
        },
      },
      { session }
    );

    console.log('[CASE_PULL_DEBUG]', {
      requested: caseIds,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      user: user.xID,
    });

    if (result.modifiedCount === 0) {
      if (ownsSession && useTransaction) {
        await session.commitTransaction();
      }

      return {
        success: true,
        assigned: 0,
        requested: caseIds.length,
        cases: [],
      };
    }

    const updatedCases = await Case.find({
      firmId,
      caseId: { $in: caseIds },
      assignedToXID: user.xID.toUpperCase(),
      queueType: 'PERSONAL',
      assignedAt,
    }, null, { session });

    const validCases = updatedCases.filter(
      (caseData) => caseData.status === CaseStatus.UNASSIGNED
    );

    if (validCases.length > 0) {
      await Promise.all(validCases.map((caseData) => {
        console.log('[STATUS_TRANSITION_DEBUG]', {
          caseId: caseData.caseId,
          actualStatus: caseData.status,
        });

        return CaseService.updateStatus(caseData.caseId, CaseStatus.OPEN, {
          tenantId: firmId,
          role: user.role || 'Admin',
          userId: user.xID,
          performedBy: user.email?.toLowerCase() || 'SYSTEM',
          actorRole: user.role === 'Admin' ? 'ADMIN' : 'USER',
          session,
          statusPatch: {
            lastActionByXID: user.xID.toUpperCase(),
            lastActionAt: assignedAt,
          },
        });
      }));
    }

    await Promise.all(updatedCases.map((caseData) =>
      CaseHistory.create([{
        caseId: caseData.caseId,
        actionType: 'CASE_PULLED',
        description: `Case pulled from Global Workbasket by ${user.xID.toUpperCase()}`,
        performedBy: user.email?.toLowerCase() || 'system@local',
        performedByXID: user.xID.toUpperCase(),
        firmId,
      }], { session })
    ));

    const transitionedCases = await Case.find({
      firmId,
      caseId: { $in: updatedCases.map((caseData) => caseData.caseId) },
    }, null, { session });

    if (ownsSession && useTransaction) {
      await session.commitTransaction();
    }
    return {
      success: true,
      assigned: result.modifiedCount,
      requested: caseIds.length,
      cases: transitionedCases,
    };
  } catch (error) {
    try {
      if (ownsSession && useTransaction) {
        await session.abortTransaction();
      }
    } catch (_) {
      // noop
    }
    console.error('[CASE_PULL_ERROR]', {
      message: error.message,
      stack: error.stack,
      caseIds,
      user: user.xID,
    });
    const message = error?.message || '';
    if (
      useTransaction && ownsSession && (
        message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
        message.toLowerCase().includes('replica set')
      )
    ) {
      return bulkAssignCasesToUser(firmId, caseIds, user, assignerObjectId, null, false);
    }
    throw error;
  } finally {
    if (ownsSession) {
      await session.endSession();
    }
  }
};

/**
 * Reassign a case to a different user
 * 
 * Changes case assignment from one user to another.
 * Only works if case is currently assigned (not UNASSIGNED).
 * 
 * @param {string} firmId - Firm ID from req.user.firmId (SECURITY: MUST be from authenticated user)
 * @param {string} caseId - Case identifier
 * @param {string} newUserXID - xID of new assignee
 * @param {object} performedBy - User object performing the reassignment
 * @returns {object} Updated case
 * @throws {Error} If case not found or cannot be reassigned
 */
const reassignCase = async (firmId, caseId, newUserXID, performedBy) => {
  if (!newUserXID || !/^X\d{6}$/i.test(newUserXID)) {
    throw new Error('Valid xID is required for reassignment (format: X123456)');
  }
  
  const caseData = await CaseRepository.findByCaseId(firmId, caseId, performedBy.role);
  
  if (!caseData) {
    throw new Error('Case not found');
  }
  
  // Cannot reassign unassigned cases
  if (caseData.status === CaseStatus.UNASSIGNED) {
    throw new Error('Cannot reassign unassigned cases. Use assignment instead.');
  }
  
  // Cannot reassign filed cases
  if (caseData.status === CaseStatus.FILED) {
    throw new Error('Cannot reassign filed cases');
  }
  
  const previousAssignee = caseData.assignedToXID;
  
  // Update assignment
  caseData.assignedToXID = newUserXID.toUpperCase();
  caseData.assignedAt = new Date();
  
  await caseData.save();
  
  // Create audit entry
  await CaseAudit.create({
    caseId,
    actionType: 'CASE_REASSIGNED',
    description: `Case reassigned from ${previousAssignee || 'unassigned'} to ${newUserXID} by ${performedBy.xID}`,
    performedByXID: performedBy.xID,
    metadata: {
      previousAssignee,
      newAssignee: newUserXID,
    },
  });
  
  // Create history entry
  await CaseHistory.create({
    caseId,
    actionType: 'CASE_REASSIGNED',
    description: `Case reassigned from ${previousAssignee || 'unassigned'} to ${newUserXID}`,
    performedBy: performedBy.email.toLowerCase(),
    performedByXID: performedBy.xID.toUpperCase(), // Canonical identifier (uppercase)
  });
  
  return caseData;
};

module.exports = {
  pullCaseFromWorkbasket,
  assignCaseToUser,
  bulkAssignCasesToUser,
  reassignCase,
};
