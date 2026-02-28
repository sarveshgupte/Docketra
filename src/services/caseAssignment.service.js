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

const pullCaseFromWorkbasket = async ({ caseId, tenantId, userId }) => {
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
        assignedTo: normalizedUserId,
        assignedAt,
        queueType: 'PERSONAL',
        status: CaseStatus.OPEN,
        lastActionByXID: normalizedUserId,
        lastActionAt: assignedAt,
      },
    }
  );

  if (result.modifiedCount !== 1) {
    return {
      success: false,
      status: 'CONFLICT',
      error: 'Case already assigned',
    };
  }

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
const assignCaseToUser = async (firmId, caseId, user) => {
  if (!user || !user.xID) {
    throw new Error('Valid user with xID is required for case assignment');
  }

  const assignmentResult = await pullCaseFromWorkbasket({
    caseId,
    tenantId: firmId,
    userId: user.xID,
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
const bulkAssignCasesToUser = async (firmId, caseIds, user) => {
  if (!user || !user.xID) {
    throw new Error('Valid user with xID is required for case assignment');
  }
  
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    throw new Error('Case IDs array is required and must not be empty');
  }
  
  const assignedAt = new Date();
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const result = await Case.updateMany(
      {
        firmId,
        caseId: { $in: caseIds },
        status: CaseStatus.UNASSIGNED,
      },
      {
        $set: {
          assignedToXID: user.xID.toUpperCase(), // CANONICAL: Store xID in assignedToXID
          queueType: 'PERSONAL', // Move from GLOBAL to PERSONAL queue
          assignedAt,
        },
      },
      { session }
    );

    const updatedCases = await Case.find({
      firmId,
      caseId: { $in: caseIds },
      assignedToXID: user.xID.toUpperCase(),
      queueType: 'PERSONAL',
      assignedAt,
    }, null, { session });

    await Promise.all(updatedCases.map((caseData) =>
      CaseService.updateStatus(caseData.caseId, CaseStatus.OPEN, {
        tenantId: firmId,
        role: user.role,
        userId: user.xID,
        performedBy: user.email?.toLowerCase() || 'SYSTEM',
        actorRole: user.role === 'Admin' ? 'ADMIN' : 'USER',
        currentStatus: CaseStatus.UNASSIGNED,
        session,
        statusPatch: {
          lastActionByXID: user.xID.toUpperCase(),
          lastActionAt: assignedAt,
        },
      })
    ));

    const transitionedCases = await Case.find({
      firmId,
      caseId: { $in: updatedCases.map((caseData) => caseData.caseId) },
    }, null, { session });

    await session.commitTransaction();
    return {
      success: true,
      assigned: result.modifiedCount,
      requested: caseIds.length,
      cases: transitionedCases,
    };
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_) {
      // noop
    }
    const message = error?.message || '';
    if (
      message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
      message.toLowerCase().includes('replica set')
    ) {
      throw new Error('MongoDB transactions require replica set');
    }
    throw error;
  } finally {
    await session.endSession();
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
