const { randomUUID } = require('crypto');
const Case = require('../models/Case.model');
const { resolveCaseIdentifier } = require('../utils/caseIdentifier');
const { ITEM_STATUSES, normalizeChecklistItem, getChecklistSummary, computeComplianceStateFromChecklist } = require('../services/clientRequestChecklist.service');

const loadCaseDoc = async ({ firmId, caseId, role }) => {
  const internalId = await resolveCaseIdentifier(firmId, caseId, role);
  const doc = await Case.findOne({
    firmId,
    caseInternalId: internalId,
  });
  return doc;
};

const getRequestChecklist = async (req, res) => {
  try {
    const caseDoc = await loadCaseDoc({
      firmId: req.user.firmId,
      caseId: req.params.caseId,
      role: req.user.role,
    });
    if (!caseDoc) return res.status(404).json({ success: false, message: 'Docket not found' });
    const checklist = Array.isArray(caseDoc.checklist) ? caseDoc.checklist.map((item, idx) => normalizeChecklistItem(item, idx)) : [];
    return res.json({ success: true, data: { checklist, summary: getChecklistSummary(checklist) } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const saveRequestChecklist = async (req, res) => {
  try {
    const caseDoc = await loadCaseDoc({
      firmId: req.user.firmId,
      caseId: req.params.caseId,
      role: req.user.role,
    });
    if (!caseDoc) return res.status(404).json({ success: false, message: 'Docket not found' });

    const nextItems = Array.isArray(req.body?.items) ? req.body.items : [];
    caseDoc.checklist = nextItems.map((item, idx) => normalizeChecklistItem({
      id: item?.id || randomUUID(),
      ...item,
    }, idx));
    caseDoc.compliance_state = computeComplianceStateFromChecklist({
      checklist: caseDoc.checklist,
      currentState: caseDoc.compliance_state,
    });
    await caseDoc.save();
    return res.json({ success: true, data: { checklist: caseDoc.checklist, summary: getChecklistSummary(caseDoc.checklist) } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const reviewChecklistItem = async (req, res) => {
  try {
    const caseDoc = await loadCaseDoc({
      firmId: req.user.firmId,
      caseId: req.params.caseId,
      role: req.user.role,
    });
    if (!caseDoc) return res.status(404).json({ success: false, message: 'Docket not found' });
    const targetId = String(req.params.itemId || '');
    const checklist = Array.isArray(caseDoc.checklist) ? caseDoc.checklist : [];
    const index = checklist.findIndex((item) => String(item?.id || '') === targetId);
    if (index < 0) return res.status(404).json({ success: false, message: 'Checklist item not found' });

    const currentItem = normalizeChecklistItem(checklist[index], index);
    const nextStatus = String(req.body?.status || '').trim().toLowerCase();
    if (![ITEM_STATUSES.ACCEPTED, ITEM_STATUSES.REJECTED, ITEM_STATUSES.WAIVED, ITEM_STATUSES.REQUESTED].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status transition' });
    }
    const reviewerNotes = typeof req.body?.reviewerNotes === 'string' ? req.body.reviewerNotes : currentItem.reviewerNotes;
    checklist[index] = normalizeChecklistItem({
      ...currentItem,
      status: nextStatus,
      reviewerNotes,
      reviewedAt: new Date(),
      reviewedByXID: req.user?.xID || null,
    }, index);
    caseDoc.checklist = checklist;
    caseDoc.compliance_state = computeComplianceStateFromChecklist({
      checklist: caseDoc.checklist,
      currentState: caseDoc.compliance_state,
    });
    await caseDoc.save();
    return res.json({ success: true, data: { item: checklist[index], summary: getChecklistSummary(checklist) } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRequestChecklist,
  saveRequestChecklist,
  reviewChecklistItem,
};
