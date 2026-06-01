const assert = require('assert');
const Case = require('../src/models/Case.model');
const approvalService = require('../src/services/docketApproval.service');
const { COMPLIANCE_STATES } = require('../src/domain/compliance/complianceStateMachine');

const restore = [];
const stub = (target, key, value) => {
  const original = target[key];
  restore.push(() => { target[key] = original; });
  target[key] = value;
};
const teardown = () => {
  while (restore.length) {
    const fn = restore.pop();
    fn();
  }
};

async function run() {
  // approval creation -> pending + awaiting_partner
  {
    const docket = {
      caseId: 'CASE-APP-001',
      caseNumber: 'CASE-APP-001',
      compliance_state: COMPLIANCE_STATES.IN_PROGRESS,
      approval_stage: null,
      approval_history: [],
      save: async function save() { return this; },
    };
    stub(Case, 'findOne', async () => docket);

    const updated = await approvalService.requestApproval({
      firmId: 'firm-1',
      caseId: 'CASE-APP-001',
      requestedByXID: 'X000101',
      approvalType: 'internal_partner',
      approverXID: 'X000900',
      dueAt: '2026-06-10',
      comments: 'Please review before filing',
      resumeToState: 'ready_to_file',
    });

    assert.strictEqual(updated.approval_stage.status, 'pending');
    assert.strictEqual(updated.approval_stage.approval_type, 'internal_partner');
    assert.strictEqual(updated.compliance_state, COMPLIANCE_STATES.AWAITING_PARTNER);
    teardown();
  }

  // approve transition -> ready_to_file
  {
    const docket = {
      caseId: 'CASE-APP-002',
      compliance_state: COMPLIANCE_STATES.AWAITING_PARTNER,
      approval_stage: {
        approval_type: 'internal_partner',
        requested_by: 'X000101',
        approver: 'X000900',
        status: 'pending',
        resume_to_state: 'ready_to_file',
      },
      approval_history: [],
      save: async function save() { return this; },
    };
    stub(Case, 'findOne', async () => docket);
    const updated = await approvalService.decideApproval({
      firmId: 'firm-1',
      caseId: 'CASE-APP-002',
      actorXID: 'X000900',
      decision: 'approved',
      comment: 'Looks good',
    });
    assert.strictEqual(updated.approval_stage.status, 'approved');
    assert.strictEqual(updated.compliance_state, COMPLIANCE_STATES.READY_TO_FILE);
    teardown();
  }

  // reject transition -> in_progress
  {
    const docket = {
      caseId: 'CASE-APP-003',
      compliance_state: COMPLIANCE_STATES.AWAITING_CLIENT,
      approval_stage: {
        approval_type: 'client',
        requested_by: 'X000101',
        approver: 'X000555',
        status: 'pending',
        resume_to_state: 'ready_to_file',
      },
      approval_history: [],
      save: async function save() { return this; },
    };
    stub(Case, 'findOne', async () => docket);
    const updated = await approvalService.decideApproval({
      firmId: 'firm-1',
      caseId: 'CASE-APP-003',
      actorXID: 'X000555',
      decision: 'rejected',
      comment: 'Need clarification',
    });
    assert.strictEqual(updated.approval_stage.status, 'rejected');
    assert.strictEqual(updated.compliance_state, COMPLIANCE_STATES.IN_PROGRESS);
    teardown();
  }

  // queue filtering
  {
    const myQueue = approvalService.getApprovalQueueFilter({ view: 'my_approvals', userXID: 'x000111' });
    assert.strictEqual(myQueue['approval_stage.approver'], 'X000111');
    const partnerQueue = approvalService.getApprovalQueueFilter({ view: 'awaiting_partner', userXID: 'x000111' });
    assert.strictEqual(partnerQueue['approval_stage.approval_type'], 'internal_partner');
    const overdueQueue = approvalService.getApprovalQueueFilter({ view: 'overdue' });
    assert.ok(overdueQueue['approval_stage.due_at'].$lt instanceof Date);
  }

  console.log('docket approval service tests passed');
}

run().catch((error) => {
  teardown();
  console.error('docket approval service tests failed', error);
  process.exit(1);
});
