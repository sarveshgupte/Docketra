const CaseAudit = require('../models/CaseAudit.model');
const { CaseRepository } = require('../repositories');
const { CASE_ACTION_TYPES } = require('../config/constants');
const { logCaseHistory } = require('./auditLog.service');
const { canTransition, normalizeStatus } = require('../domain/case/caseStateMachine');
const CaseStatus = require('../domain/case/caseStatus');
const caseSlaService = require('./caseSla.service');

async function updateStatus(caseId, newStatus, context = {}) {
  const tenantId = context.tenantId || context.firmId;
  const normalizedNewStatus = normalizeStatus(newStatus);
  const normalizedCurrentStatus = context.currentStatus ? normalizeStatus(context.currentStatus) : null;

  if (!tenantId) {
    throw new Error('Tenant context required');
  }

  if (!Object.values(CaseStatus).includes(normalizedNewStatus)) {
    throw new Error(`Invalid status value: ${newStatus}`);
  }

  const existingCase = await CaseRepository.findByCaseId(tenantId, caseId, context.role);
  if (!existingCase) {
    throw new Error('Case not found');
  }

  const fromStatus = normalizedCurrentStatus || normalizeStatus(existingCase.status);
  const expectedCurrentStatus = context.currentStatus || existingCase.status;

  if (fromStatus === normalizedNewStatus) {
    throw new Error(`Self-transition not allowed: ${fromStatus}`);
  }

  if (fromStatus === CaseStatus.RESOLVED) {
    throw new Error('Resolved cases cannot be modified');
  }

  if (!canTransition(fromStatus, normalizedNewStatus, context.role || null)) {
    console.warn({
      event: 'ILLEGAL_STATUS_TRANSITION_ATTEMPT',
      caseId,
      from: fromStatus,
      to: normalizedNewStatus,
      userId: context.userId || context.performedByXID || null,
    });
    throw new Error(`Illegal transition: ${fromStatus} → ${normalizedNewStatus}`);
  }

  const session = context.session || context.req?.transactionSession?.session || null;
  const slaTransition = caseSlaService.handleStatusTransition(existingCase, normalizedNewStatus, {
    now: new Date(),
    userId: context.userId || context.performedByXID || null,
  });

  await CaseRepository.updateStatus(
    caseId,
    tenantId,
    normalizedNewStatus,
    { ...(context.statusPatch || {}), ...(slaTransition.patch || {}) },
    session,
    expectedCurrentStatus
  );

  const metadata = {
    oldStatus: fromStatus,
    newStatus: normalizedNewStatus,
    timestamp: new Date().toISOString(),
    userId: context.userId || context.performedByXID || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    ...(context.auditMetadata || {}),
  };

  if (session) {
    await CaseAudit.create([{
      caseId: existingCase.caseId || caseId,
      actionType: CASE_ACTION_TYPES.CASE_STATUS_CHANGED,
      description: `Status changed from ${fromStatus} to ${normalizedNewStatus}`,
      performedByXID: context.userId || context.performedByXID || 'SYSTEM',
      metadata,
    }], { session });
  } else {
    await CaseAudit.create({
      caseId: existingCase.caseId || caseId,
      actionType: CASE_ACTION_TYPES.CASE_STATUS_CHANGED,
      description: `Status changed from ${fromStatus} to ${normalizedNewStatus}`,
      performedByXID: context.userId || context.performedByXID || 'SYSTEM',
      metadata,
    });
  }

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

  if (slaTransition.auditEvent) {
    const slaMetadata = {
      ...slaTransition.auditEvent,
      statusFrom: fromStatus,
      statusTo: normalizedNewStatus,
    };

    if (session) {
      await CaseAudit.create([{
        caseId: existingCase.caseId || caseId,
        actionType: CASE_ACTION_TYPES.CASE_SYSTEM_EVENT,
        description: `SLA event ${slaTransition.auditEvent.event}`,
        performedByXID: context.userId || context.performedByXID || 'SYSTEM',
        metadata: slaMetadata,
      }], { session });
    } else {
      await CaseAudit.create({
        caseId: existingCase.caseId || caseId,
        actionType: CASE_ACTION_TYPES.CASE_SYSTEM_EVENT,
        description: `SLA event ${slaTransition.auditEvent.event}`,
        performedByXID: context.userId || context.performedByXID || 'SYSTEM',
        metadata: slaMetadata,
      });
    }
  }
}

module.exports = {
  updateStatus,
};
