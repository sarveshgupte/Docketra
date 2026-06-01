const assert = require('assert');
const Case = require('../src/models/Case.model');
const dashboardService = require('../src/services/dashboard.service');

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

const buildChain = (rows, captured) => ({
  select() { return this; },
  sort() { return this; },
  limit() { return this; },
  lean() { return Promise.resolve(rows); },
});

async function run() {
  const now = Date.now();
  const daysAgo = (days) => new Date(now - (days * 24 * 60 * 60 * 1000));
  const daysFromNow = (days) => new Date(now + (days * 24 * 60 * 60 * 1000));

  const rows = [
    {
      caseId: 'CASE-MRN-001',
      title: 'GSTR-3B',
      clientId: 'C001001',
      clientSnapshot: { businessName: 'Alpha Foods Pvt Ltd' },
      assignedToXID: 'X100001',
      compliance_state: 'awaiting_client',
      internal_due_date: daysAgo(1),
      risk_level: 'high',
      priority: 'high',
      obligation_type: 'GST',
      obligation_period: 'May-2026',
      status: 'OPEN',
      pendingReason: 'waiting_client',
      blocked_reason: 'Awaiting invoice set',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(5),
    },
    {
      caseId: 'CASE-MRN-002',
      title: 'TDS 24Q',
      clientId: 'C001002',
      clientSnapshot: { businessName: 'Beacon Labs LLP' },
      assignedToXID: 'X100001',
      compliance_state: 'awaiting_partner',
      internal_due_date: daysFromNow(2),
      risk_level: 'critical',
      priority: 'urgent',
      obligation_type: 'TDS',
      obligation_period: 'Q4 FY 2025-26',
      status: 'IN_PROGRESS',
      approval_stage: {
        status: 'pending',
        approval_type: 'internal_partner',
        approver: 'X900001',
        requested_at: daysAgo(4),
        due_at: daysAgo(1),
      },
      createdAt: daysAgo(9),
      updatedAt: daysAgo(4),
    },
    {
      caseId: 'CASE-MRN-003',
      title: 'MGT-7',
      clientId: 'C001003',
      clientSnapshot: { businessName: 'Citrine Mobility' },
      assignedToXID: 'X100002',
      compliance_state: 'blocked',
      internal_due_date: daysAgo(3),
      risk_level: 'medium',
      priority: 'medium',
      obligation_type: 'ROC',
      obligation_period: 'FY 2025-26',
      status: 'PENDING',
      blockerType: 'portal_error',
      blocked_reason: 'MCA portal is down',
      blockedAt: daysAgo(3),
      createdAt: daysAgo(12),
      updatedAt: daysAgo(2),
    },
  ];

  const capturedQueries = [];
  stub(Case, 'find', (query) => {
    capturedQueries.push(query);
    return buildChain(rows, capturedQueries);
  });

  const result = await dashboardService.getPartnerMorningDashboard('67e95f7642adf77d7f4e1834', {
    assigneeXID: 'x100001',
    approverXID: 'x900001',
    exceptionType: 'portal_issue',
  });

  assert.strictEqual(result.summary.atRiskEntities >= 1, true);
  assert.strictEqual(result.summary.filingsAwaitingApproval, 1);
  assert.strictEqual(result.summary.exceptionBlockedFilings, 1);
  assert.strictEqual(Array.isArray(result.sections.clientBlockers), true);
  assert.strictEqual(Array.isArray(result.sections.approvalBlockers), true);
  assert.strictEqual(Array.isArray(result.sections.teamLoad), true);
  assert.strictEqual(Array.isArray(result.sections.exceptions), true);
  assert.strictEqual(result.sections.exceptions[0].reason, 'portal_issue');
  assert.strictEqual(result.sections.approvalBlockers[0].approver, 'X900001');
  assert.strictEqual(result.sections.teamLoad[0].assigneeXID, 'X100001');

  assert.ok(capturedQueries.length > 0, 'Expected query capture for filter checks');
  assert.strictEqual(capturedQueries[0].$and[0].assignedToXID, 'X100001');
  assert.strictEqual(capturedQueries[0].$and[1]['approval_stage.approver'], 'X900001');

  teardown();
  console.log('dashboardPartnerMorning.service.test.js passed');
}

run().catch((error) => {
  teardown();
  console.error('dashboardPartnerMorning.service.test.js failed', error);
  process.exit(1);
});
