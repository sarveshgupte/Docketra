const { COMPLIANCE_STATES } = require('../domain/compliance/complianceStateMachine');

const ITEM_STATUSES = {
  REQUESTED: 'requested',
  SUBMITTED: 'submitted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WAIVED: 'waived',
};

const VALID_ITEM_STATUSES = new Set(Object.values(ITEM_STATUSES));

const toTrimmedString = (value, max = 1000) => {
  const normalized = String(value || '').trim();
  return normalized.slice(0, max);
};

const normalizeChecklistItem = (item = {}, fallbackSortOrder = 0) => {
  const statusCandidate = String(item?.status || '').trim().toLowerCase();
  const status = VALID_ITEM_STATUSES.has(statusCandidate) ? statusCandidate : ITEM_STATUSES.REQUESTED;
  return {
    ...item,
    title: toTrimmedString(item?.title, 200),
    description: toTrimmedString(item?.description, 1000),
    required: Boolean(item?.required),
    dueDate: item?.dueDate ? new Date(item.dueDate) : null,
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : fallbackSortOrder,
    status,
    uploadedAttachmentId: item?.uploadedAttachmentId ? String(item.uploadedAttachmentId) : null,
    uploadedFileName: toTrimmedString(item?.uploadedFileName, 300) || null,
    reviewerNotes: toTrimmedString(item?.reviewerNotes, 1200) || '',
    submittedAt: item?.submittedAt ? new Date(item.submittedAt) : null,
    submittedBy: toTrimmedString(item?.submittedBy, 120) || null,
    reviewedAt: item?.reviewedAt ? new Date(item.reviewedAt) : null,
    reviewedByXID: toTrimmedString(item?.reviewedByXID, 20).toUpperCase() || null,
  };
};

const areRequiredItemsSatisfied = (checklist = []) => checklist
  .filter((item) => item?.required)
  .every((item) => item?.status === ITEM_STATUSES.ACCEPTED || item?.status === ITEM_STATUSES.WAIVED);

const getChecklistSummary = (checklist = []) => {
  const now = Date.now();
  const requestedItems = checklist.filter((item) => item?.status === ITEM_STATUSES.REQUESTED);
  const overdueCount = requestedItems.filter((item) => item?.dueDate && new Date(item.dueDate).getTime() < now).length;
  const missingRequiredCount = checklist.filter((item) => item?.required && ![ITEM_STATUSES.ACCEPTED, ITEM_STATUSES.WAIVED].includes(item?.status)).length;
  return {
    total: checklist.length,
    requested: requestedItems.length,
    submitted: checklist.filter((item) => item?.status === ITEM_STATUSES.SUBMITTED).length,
    accepted: checklist.filter((item) => item?.status === ITEM_STATUSES.ACCEPTED).length,
    rejected: checklist.filter((item) => item?.status === ITEM_STATUSES.REJECTED).length,
    waived: checklist.filter((item) => item?.status === ITEM_STATUSES.WAIVED).length,
    overdueCount,
    missingRequiredCount,
    allRequiredAccepted: areRequiredItemsSatisfied(checklist),
  };
};

const toClientFacingChecklist = (checklist = []) => checklist.map((item) => ({
  id: item?.id || null,
  title: item?.title || '',
  description: item?.description || '',
  required: Boolean(item?.required),
  dueDate: item?.dueDate || null,
  status: item?.status || ITEM_STATUSES.REQUESTED,
  uploadedFileName: item?.uploadedFileName || null,
  submittedAt: item?.submittedAt || null,
  reviewedAt: item?.reviewedAt || null,
}));

const computeComplianceStateFromChecklist = ({ checklist = [], currentState }) => {
  const summary = getChecklistSummary(checklist);
  if (!summary.missingRequiredCount && currentState === COMPLIANCE_STATES.AWAITING_CLIENT) {
    return COMPLIANCE_STATES.IN_PROGRESS;
  }
  if (summary.missingRequiredCount > 0) {
    return COMPLIANCE_STATES.AWAITING_CLIENT;
  }
  return currentState;
};

module.exports = {
  ITEM_STATUSES,
  VALID_ITEM_STATUSES,
  normalizeChecklistItem,
  getChecklistSummary,
  areRequiredItemsSatisfied,
  toClientFacingChecklist,
  computeComplianceStateFromChecklist,
};
