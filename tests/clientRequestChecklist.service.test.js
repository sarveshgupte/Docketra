const assert = require('assert');
const {
  ITEM_STATUSES,
  getChecklistSummary,
  toClientFacingChecklist,
  computeComplianceStateFromChecklist,
} = require('../src/services/clientRequestChecklist.service');
const { COMPLIANCE_STATES } = require('../src/domain/compliance/complianceStateMachine');

(() => {
  const checklist = [
    { id: 'a', title: 'Bank statement', required: true, status: ITEM_STATUSES.REQUESTED, reviewerNotes: 'internal note' },
    { id: 'b', title: 'GST purchase register', required: true, status: ITEM_STATUSES.ACCEPTED },
  ];
  const summary = getChecklistSummary(checklist);
  assert.strictEqual(summary.missingRequiredCount, 1);
  assert.strictEqual(summary.allRequiredAccepted, false);
  assert.strictEqual(
    computeComplianceStateFromChecklist({ checklist, currentState: COMPLIANCE_STATES.IN_PROGRESS }),
    COMPLIANCE_STATES.AWAITING_CLIENT,
  );
})();

(() => {
  const checklist = [
    { id: 'a', title: 'Bank statement', required: true, status: ITEM_STATUSES.ACCEPTED },
    { id: 'b', title: 'GST purchase register', required: true, status: ITEM_STATUSES.WAIVED },
  ];
  const summary = getChecklistSummary(checklist);
  assert.strictEqual(summary.allRequiredAccepted, true);
  assert.strictEqual(summary.missingRequiredCount, 0);
  assert.strictEqual(
    computeComplianceStateFromChecklist({ checklist, currentState: COMPLIANCE_STATES.AWAITING_CLIENT }),
    COMPLIANCE_STATES.IN_PROGRESS,
  );
})();

(() => {
  const projected = toClientFacingChecklist([
    { id: 'a', title: 'Doc', required: true, status: ITEM_STATUSES.REJECTED, reviewerNotes: 'do not expose', dueDate: new Date('2026-05-30') },
  ]);
  assert.strictEqual(projected.length, 1);
  assert.strictEqual(projected[0].status, ITEM_STATUSES.REJECTED);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(projected[0], 'reviewerNotes'), false);
})();

console.log('client request checklist service tests passed');
