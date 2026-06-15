const mongoose = require('mongoose');
const Case = require('../models/Case.model');
const { COMPLIANCE_STATES } = require('../domain/compliance/complianceStateMachine');
const { createNotification } = require('../domain/notifications');

const APPROVAL_TYPES = new Set(['internal_partner', 'client', 'authorised_signatory', 'other']);
const APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'cancelled']);

const normalizeType = (value) => String(value || '').trim().toLowerCase();
const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeXid = (value) => String(value || '').trim().toUpperCase();
const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getCaseNumberCandidates = (id) => {
  if (!id) return [];
  const normalized = String(id).trim().replace(/[_\s]+/g, '-').toUpperCase();
  const candidates = [String(id)];
  
  const prefixMatch = normalized.match(/^(CASE|DOCKET)-(.+)$/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    const bare = prefixMatch[2];
    const otherPrefix = prefix === 'CASE' ? 'DOCKET' : 'CASE';
    candidates.push(`${prefix}-${bare}`, `${otherPrefix}-${bare}`, bare);
  } else {
    candidates.push(normalized, `CASE-${normalized}`, `DOCKET-${normalized}`);
  }

  return [...new Set(candidates)];
};

const makeDocketQuery = (docketId, firmId) => {
  const candidates = getCaseNumberCandidates(docketId);
  const query = {
    firmId,
    $or: [
      { caseId: { $in: candidates } },
      { caseNumber: { $in: candidates } },
    ],
  };
  if (mongoose.Types.ObjectId.isValid(docketId)) {
    query.$or.push({ caseInternalId: docketId });
    query.$or.push({ _id: docketId });
  }
  return query;
};

const shouldAwaitPartner = (approvalType) => approvalType === 'internal_partner';
const shouldAwaitClient = (approvalType) => ['client', 'authorised_signatory', 'other'].includes(approvalType);

const computePendingComplianceState = (approvalType, currentState) => {
  if (shouldAwaitPartner(approvalType)) return COMPLIANCE_STATES.AWAITING_PARTNER;
  if (shouldAwaitClient(approvalType)) return COMPLIANCE_STATES.AWAITING_CLIENT;
  return currentState || COMPLIANCE_STATES.IN_PROGRESS;
};

const snapshotApprovalStage = (stage = {}) => ({
  approval_type: stage.approval_type || null,
  requested_by: stage.requested_by || null,
  approver: stage.approver || null,
  requested_at: stage.requested_at || null,
  due_at: stage.due_at || null,
  status: stage.status || null,
  comments: stage.comments || '',
  evidence_attachment_id: stage.evidence_attachment_id || null,
  resume_to_state: stage.resume_to_state || null,
  decided_at: stage.decided_at || null,
  decided_by: stage.decided_by || null,
  decision_comment: stage.decision_comment || '',
  snapshot_at: new Date(),
});

const requestApproval = async ({
  firmId,
  caseId,
  requestedByXID,
  approvalType,
  approverXID,
  dueAt,
  comments = '',
  evidenceAttachmentId = null,
  resumeToState = 'ready_to_file',
}) => {
  const normalizedType = normalizeType(approvalType);
  if (!APPROVAL_TYPES.has(normalizedType)) {
    const error = new Error('Invalid approval type');
    error.statusCode = 400;
    throw error;
  }
  const normalizedApprover = normalizeXid(approverXID);
  if (!normalizedApprover) {
    const error = new Error('Approver is required');
    error.statusCode = 400;
    throw error;
  }
  const query = makeDocketQuery(caseId, firmId);
  const docket = await Case.findOne(query);
  if (!docket) {
    const error = new Error('Docket not found');
    error.statusCode = 404;
    throw error;
  }

  if (docket.approval_stage?.status === 'pending') {
    const error = new Error('An approval request is already pending for this docket');
    error.statusCode = 409;
    throw error;
  }

  if (docket.approval_stage?.status) {
    docket.approval_history = Array.isArray(docket.approval_history) ? docket.approval_history : [];
    docket.approval_history.push(snapshotApprovalStage(docket.approval_stage));
  }

  docket.approval_stage = {
    approval_type: normalizedType,
    requested_by: normalizeXid(requestedByXID),
    approver: normalizedApprover,
    requested_at: new Date(),
    due_at: toDateOrNull(dueAt),
    status: 'pending',
    comments: String(comments || '').trim().slice(0, 1200),
    evidence_attachment_id: evidenceAttachmentId ? String(evidenceAttachmentId).trim() : null,
    resume_to_state: ['ready_to_file', 'in_progress'].includes(String(resumeToState || '').trim()) ? String(resumeToState).trim() : 'ready_to_file',
    decided_at: null,
    decided_by: null,
    decision_comment: '',
  };
  docket.compliance_state = computePendingComplianceState(normalizedType, docket.compliance_state);
  await docket.save();

  createNotification({
    firmId: String(firmId),
    userId: normalizedApprover,
    type: 'STATUS_CHANGED',
    docketId: docket.caseId || docket.caseNumber,
    actor: { xID: normalizeXid(requestedByXID), role: 'SYSTEM' },
    metadata: {
      event: 'approval_requested',
      approvalType: normalizedType,
      dueAt: docket.approval_stage.due_at,
    },
    title: 'Approval requested',
    message: `Approval requested for docket ${docket.caseId || docket.caseNumber}.`,
  });

  return docket;
};

const decideApproval = async ({
  firmId,
  caseId,
  actorXID,
  decision,
  comment = '',
}) => {
  const normalizedDecision = normalizeStatus(decision);
  if (!['approved', 'rejected', 'cancelled'].includes(normalizedDecision)) {
    const error = new Error('Decision must be approved, rejected, or cancelled');
    error.statusCode = 400;
    throw error;
  }

  const query = makeDocketQuery(caseId, firmId);
  const docket = await Case.findOne(query);
  if (!docket) {
    const error = new Error('Docket not found');
    error.statusCode = 404;
    throw error;
  }
  const stage = docket.approval_stage || {};
  if (normalizeStatus(stage.status) !== 'pending') {
    const error = new Error('No pending approval exists for this docket');
    error.statusCode = 409;
    throw error;
  }

  const actor = normalizeXid(actorXID);
  const approver = normalizeXid(stage.approver);
  if (normalizedDecision !== 'cancelled' && approver && actor && approver !== actor) {
    const error = new Error('Only the assigned approver can approve/reject');
    error.statusCode = 403;
    throw error;
  }

  stage.status = normalizedDecision;
  stage.decided_at = new Date();
  stage.decided_by = actor || null;
  stage.decision_comment = String(comment || '').trim().slice(0, 1200);
  docket.approval_stage = stage;
  docket.approval_history = Array.isArray(docket.approval_history) ? docket.approval_history : [];
  docket.approval_history.push(snapshotApprovalStage(stage));

  if (normalizedDecision === 'approved') {
    docket.compliance_state = stage.resume_to_state === 'in_progress'
      ? COMPLIANCE_STATES.IN_PROGRESS
      : COMPLIANCE_STATES.READY_TO_FILE;
  } else if (normalizedDecision === 'rejected') {
    docket.compliance_state = COMPLIANCE_STATES.IN_PROGRESS;
  } else if (normalizedDecision === 'cancelled') {
    docket.compliance_state = COMPLIANCE_STATES.IN_PROGRESS;
  }

  await docket.save();

  if (stage.requested_by) {
    createNotification({
      firmId: String(firmId),
      userId: stage.requested_by,
      type: 'STATUS_CHANGED',
      docketId: docket.caseId || docket.caseNumber,
      actor: { xID: actor || approver || 'SYSTEM', role: 'SYSTEM' },
      metadata: {
        event: 'approval_decision',
        decision: normalizedDecision,
        approvalType: stage.approval_type,
      },
      title: `Approval ${normalizedDecision}`,
      message: `Approval ${normalizedDecision} for docket ${docket.caseId || docket.caseNumber}.`,
    });
  }

  return docket;
};

const getApprovalQueueFilter = ({ view = 'my_approvals', userXID = null }) => {
  const normalizedView = String(view || 'my_approvals').trim().toLowerCase();
  const base = {
    'approval_stage.status': 'pending',
  };
  if (normalizedView === 'my_approvals') {
    if (userXID) base['approval_stage.approver'] = normalizeXid(userXID);
    return base;
  }
  if (normalizedView === 'awaiting_partner') {
    base['approval_stage.approval_type'] = 'internal_partner';
    return base;
  }
  if (normalizedView === 'awaiting_client_signatory') {
    base['approval_stage.approval_type'] = { $in: ['client', 'authorised_signatory'] };
    return base;
  }
  if (normalizedView === 'overdue') {
    base['approval_stage.due_at'] = { $lt: new Date() };
    return base;
  }
  return base;
};

const sendApprovalReminderPlaceholder = async ({
  firmId,
  caseId,
  actorXID,
  escalate = false,
}) => {
  const query = makeDocketQuery(caseId, firmId);
  const docket = await Case.findOne(query)
    .select('caseId caseNumber approval_stage')
    .lean();
  if (!docket) {
    const error = new Error('Docket not found');
    error.statusCode = 404;
    throw error;
  }
  const stage = docket.approval_stage || {};
  if (normalizeStatus(stage.status) !== 'pending') {
    const error = new Error('No pending approval to remind');
    error.statusCode = 409;
    throw error;
  }
  const docketId = docket.caseId || docket.caseNumber;
  const recipients = new Set([normalizeXid(stage.approver)]);
  if (escalate && stage.requested_by) recipients.add(normalizeXid(stage.requested_by));

  [...recipients].filter(Boolean).forEach((recipientXID) => {
    createNotification({
      firmId: String(firmId),
      userId: recipientXID,
      type: 'STATUS_CHANGED',
      docketId,
      actor: { xID: normalizeXid(actorXID) || 'SYSTEM', role: 'SYSTEM' },
      metadata: {
        event: 'approval_reminder',
        escalate: Boolean(escalate),
        approvalType: stage.approval_type || null,
      },
      title: escalate ? 'Approval escalation reminder' : 'Approval reminder',
      message: `Reminder: docket ${docketId} is awaiting approval.`,
    });
  });

  return {
    docketId,
    recipients: [...recipients].filter(Boolean),
    escalated: Boolean(escalate),
  };
};

module.exports = {
  APPROVAL_TYPES,
  APPROVAL_STATUSES,
  computePendingComplianceState,
  requestApproval,
  decideApproval,
  getApprovalQueueFilter,
  sendApprovalReminderPlaceholder,
};
