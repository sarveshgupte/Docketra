const CaseAudit = require('../models/CaseAudit.model');
const { CaseRepository } = require('../repositories');
const { CASE_ACTION_TYPES } = require('../config/constants');
const { logCaseHistory } = require('./auditLog.service');
const { canTransition } = require('../domain/case/caseStateMachine');
const CaseStatus = require('../domain/case/caseStatus');

async function updateStatus(caseId, newStatus, context = {}) {
  const tenantId = context.tenantId || context.firmId;

  if (!tenantId) {
    throw new Error('Tenant context required');
  }

  const existingCase = await CaseRepository.findByCaseId(tenantId, caseId, context.role);
  if (!existingCase) {
    throw new Error('Case not found');
  }

  if (existingCase.status === CaseStatus.RESOLVED) {
    throw new Error('Resolved cases cannot be modified');
  }

  if (!canTransition(existingCase.status, newStatus)) {
    throw new Error(`Illegal transition: ${existingCase.status} → ${newStatus}`);
  }

  await CaseRepository.updateStatus(caseId, tenantId, newStatus, context.statusPatch || {});

  const metadata = {
    oldStatus: existingCase.status,
    newStatus,
    timestamp: new Date().toISOString(),
    userId: context.userId || context.performedByXID || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    ...(context.auditMetadata || {}),
  };

  await CaseAudit.create({
    caseId: existingCase.caseId || caseId,
    actionType: CASE_ACTION_TYPES.CASE_STATUS_CHANGED,
    description: `Status changed from ${existingCase.status} to ${newStatus}`,
    performedByXID: context.userId || context.performedByXID || 'SYSTEM',
    metadata,
  });

  await logCaseHistory({
    caseId: existingCase.caseId || caseId,
    firmId: tenantId,
    actionType: CASE_ACTION_TYPES.CASE_STATUS_CHANGED,
    actionLabel: 'Case status changed',
    description: `Status changed from ${existingCase.status} to ${newStatus}`,
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
