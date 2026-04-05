const CaseAudit = require('../models/CaseAudit.model');
const { CaseRepository } = require('../repositories');
const { CASE_ACTION_TYPES } = require('../config/constants');
const { logCaseHistory } = require('./auditLog.service');
const { safeLogForensicAudit, computeChangedFields, getRequestIp, getRequestUserAgent } = require('./forensicAudit.service');
const { normalizeStatus } = require('../domain/case/caseStateMachine');
const CaseStatus = require('../domain/case/caseStatus');
const { DocketLifecycle, coerceLifecycleToDocket, deriveLifecycle } = require('../domain/docketLifecycle');
const { transitionDocket } = require('./docketTransition.service');
const caseSlaService = require('./caseSla.service');

/**
 * Compute lifecycle for CaseRepository.updateStatus from workflow status + patch.
 * Terminal and in-flight phases use CaseStatus; falls back to deriveLifecycle with status for edge cases.
 */
function inferLifecycleAfterStatusChange(existingCase, normalizedNewStatus, patch) {
  const assigned = patch.assignedToXID !== undefined ? patch.assignedToXID : existingCase.assignedToXID;
  const explicit = patch.lifecycle;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
    return deriveLifecycle({
      lifecycle: explicit,
      assignedToXID: assigned,
      status: normalizedNewStatus,
    });
  }

  const ns = normalizedNewStatus;
  if (ns === CaseStatus.RESOLVED || ns === CaseStatus.CLOSED) return DocketLifecycle.COMPLETED;
  if (ns === CaseStatus.FILED) return DocketLifecycle.ARCHIVED;

  const prev = coerceLifecycleToDocket(existingCase.lifecycle);
  if (prev === DocketLifecycle.COMPLETED || prev === DocketLifecycle.ARCHIVED) {
    return prev;
  }

  if (!assigned) return DocketLifecycle.CREATED;

  if (ns === CaseStatus.ASSIGNED) return DocketLifecycle.IN_WORKLIST;
  if ([
    CaseStatus.IN_PROGRESS,
    CaseStatus.OPEN,
    CaseStatus.PENDING,
    CaseStatus.QC_PENDING,
    CaseStatus.QC_FAILED,
    CaseStatus.QC_CORRECTED,
  ].includes(ns)) {
    return DocketLifecycle.ACTIVE;
  }

  return deriveLifecycle({
    lifecycle: existingCase.lifecycle,
    assignedToXID: assigned,
    status: normalizedNewStatus,
  });
}

async function updateStatus(caseId, newStatus, context = {}) {
  const tenantId = context.tenantId || context.firmId;
  const normalizedNewStatus = normalizeStatus(newStatus);
  const normalizedCurrentStatus = context.currentStatus ? normalizeStatus(context.currentStatus) : null;

  if (!tenantId) {
    throw new Error('Tenant context required');
  }

  const session = context.session || context.req?.transactionSession?.session || null;
  if (!session) {
    throw new Error('Transaction session required for status transition');
  }

  if (!context.role) {
    throw new Error('Role is required for status transition');
  }

  const existingCase = await CaseRepository.findByCaseId(tenantId, caseId, context.role);
  if (!existingCase) {
    throw new Error('Case not found');
  }

  const fromStatus = normalizedCurrentStatus || normalizeStatus(existingCase.status);

  const slaTransition = caseSlaService.handleStatusTransition(existingCase, normalizedNewStatus, {
    now: new Date(),
    userId: context.userId || context.performedByXID || null,
  });

  await transitionDocket(caseId, normalizedNewStatus, context.userId || context.performedByXID || 'SYSTEM', {
    firmId: tenantId,
    session,
    expectedVersion: Number.isInteger(context.expectedVersion) ? context.expectedVersion : existingCase.version,
    reason: context.reason || context.auditMetadata?.reason || null,
    notes: context.notes || context.auditMetadata?.notes || null,
    metadata: {
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      ...(context.auditMetadata || {}),
    },
  });

  const mergedPatch = { ...(context.statusPatch || {}), ...(slaTransition.patch || {}) };
  mergedPatch.lifecycle = inferLifecycleAfterStatusChange(existingCase, normalizedNewStatus, mergedPatch);

  await CaseRepository.updateStatus(
    caseId,
    tenantId,
    normalizedNewStatus,
    mergedPatch,
    session,
    normalizedNewStatus
  );

  const metadata = {
    oldStatus: fromStatus,
    newStatus: normalizedNewStatus,
    fromStatus,
    toStatus: normalizedNewStatus,
    timestamp: new Date().toISOString(),
    userId: context.userId || context.performedByXID || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    ...(context.auditMetadata || {}),
  };

  await CaseAudit.create([{
    caseId: existingCase.caseId || caseId,
    firmId: tenantId,
    actionType: CASE_ACTION_TYPES.CASE_STATUS_CHANGED,
    description: `Status changed from ${fromStatus} to ${normalizedNewStatus}`,
    performedByXID: context.userId || context.performedByXID || 'SYSTEM',
    metadata,
  }], { session });

  await logCaseHistory({
    caseId: existingCase.caseId || caseId,
    firmId: tenantId,
    actionType: CASE_ACTION_TYPES.CASE_STATUS_CHANGED,
    actionLabel: 'Case status changed',
    description: `Status changed from ${fromStatus} to ${normalizedNewStatus}`,
    performedBy: context.performedBy || 'SYSTEM',
    performedByXID: context.userId || context.performedByXID || 'SYSTEM',
    actorRole: context.actorRole || 'USER',
    metadata,
    req: context.req,
    session,
  });

  const diff = computeChangedFields(
    { status: fromStatus },
    { status: normalizedNewStatus }
  );

  await safeLogForensicAudit({
    tenantId,
    entityType: 'CASE',
    entityId: existingCase.caseId || caseId,
    action: 'CASE_STATUS_CHANGED',
    oldValue: diff.oldValue,
    newValue: diff.newValue,
    performedBy: context.userId || context.performedByXID || 'SYSTEM',
    performedByRole: context.actorRole || context.role || null,
    impersonatedBy: context.req?.context?.isSuperAdmin ? context.req?.user?.xID || null : null,
    ipAddress: context.ipAddress || getRequestIp(context.req),
    userAgent: context.userAgent || getRequestUserAgent(context.req),
    metadata: {
      source: 'case.service.updateStatus',
      caseInternalId: existingCase.caseInternalId || null,
    },
  }, { session });

  if (slaTransition.auditEvent) {
    const slaMetadata = {
      ...slaTransition.auditEvent,
      statusFrom: fromStatus,
      statusTo: normalizedNewStatus,
    };

    await CaseAudit.create([{
      caseId: existingCase.caseId || caseId,
      firmId: tenantId,
      actionType: CASE_ACTION_TYPES.CASE_SYSTEM_EVENT,
      description: `SLA event ${slaTransition.auditEvent.event}`,
      performedByXID: context.userId || context.performedByXID || 'SYSTEM',
      metadata: slaMetadata,
    }], { session });
  }
}

module.exports = {
  updateStatus,
};
