const CaseAudit = require('../models/CaseAudit.model');
const { CaseRepository } = require('../repositories');
const { CASE_ACTION_TYPES } = require('../config/constants');
const { logCaseHistory } = require('./auditLog.service');
const { safeLogForensicAudit, computeChangedFields, getRequestIp, getRequestUserAgent } = require('./forensicAudit.service');
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

  const session = context.session || context.req?.transactionSession?.session || null;
  if (!session) {
    throw new Error('Transaction session required for status transition');
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
    expectedCurrentStatus,
    existingCase.tatLastStartedAt || null
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

  await CaseAudit.create([{
    caseId: existingCase.caseId || caseId,
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
