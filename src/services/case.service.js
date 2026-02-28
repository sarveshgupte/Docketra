const CaseAudit = require('../models/CaseAudit.model');
const { CaseRepository } = require('../repositories');
const { CASE_ACTION_TYPES } = require('../config/constants');
const { logCaseHistory } = require('./auditLog.service');
const { canTransition, normalizeStatus } = require('../domain/case/caseStateMachine');
const CaseStatus = require('../domain/case/caseStatus');

async function updateStatus(caseId, newStatus, context = {}) {
  const tenantId = context.tenantId || context.firmId;
  const normalizedNewStatus = normalizeStatus(newStatus);
  const normalizedCurrentStatus = normalizeStatus(context.currentStatus);

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

  const fromStatus = normalizeStatus(normalizedCurrentStatus || existingCase.status);

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

  await CaseRepository.updateStatus(caseId, tenantId, normalizedNewStatus, context.statusPatch || {});

  const metadata = {
    oldStatus: fromStatus,
    newStatus: normalizedNewStatus,
    timestamp: new Date().toISOString(),
    userId: context.userId || context.performedByXID || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    ...(context.auditMetadata || {}),
  };

  await CaseAudit.create({
    caseId: existingCase.caseId || caseId,
    actionType: CASE_ACTION_TYPES.CASE_STATUS_CHANGED,
    description: `Status changed from ${fromStatus} to ${normalizedNewStatus}`,
    performedByXID: context.userId || context.performedByXID || 'SYSTEM',
    metadata,
  });

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
  });
}

module.exports = {
  updateStatus,
};
