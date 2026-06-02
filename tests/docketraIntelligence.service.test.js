const assert = require('assert');
const mongoose = require('mongoose');
const Case = require('../src/models/Case.model');
const DocketEffort = require('../src/models/DocketEffort.model');
const User = require('../src/models/User.model');
const docketraIntelligenceService = require('../src/services/docketraIntelligence.service');

const restore = [];
const stub = (target, key, value) => {
  const original = target[key];
  restore.push(() => { target[key] = original; });
  target[key] = value;
};
const teardown = () => {
  while (restore.length) restore.pop()();
};

const buildUserChain = (rows) => ({
  select() { return this; },
  sort() { return this; },
  lean() { return Promise.resolve(rows); },
});

const buildCaseChain = (rows) => ({
  select() { return this; },
  lean() { return Promise.resolve(rows); },
});

async function run() {
  const firmId = '67e95f7642adf77d7f4e1834';
  const now = Date.now();
  const daysAgo = (days) => new Date(now - (days * 24 * 60 * 60 * 1000));
  const daysFromNow = (days) => new Date(now + (days * 24 * 60 * 60 * 1000));
  const alphaCaseId = new mongoose.Types.ObjectId();
  const betaCaseId = new mongoose.Types.ObjectId();

  const users = [
    { _id: new mongoose.Types.ObjectId(), xID: 'X100001', name: 'Alpha Reviewer', email: 'alpha@example.com', role: 'USER' },
    { _id: new mongoose.Types.ObjectId(), xID: 'X100002', name: 'Beta Available', email: 'beta@example.com', role: 'USER' },
  ];

  const dockets = [
    {
      caseInternalId: alphaCaseId,
      caseId: 'CASE-WL-001',
      title: 'Urgent overdue GST filing',
      assignedToXID: 'X100001',
      reviewer_xid: 'X100001',
      status: 'OPEN',
      priority: 'urgent',
      dueDate: daysAgo(2),
      expectedMinutes: 360,
      approval_stage: { status: 'pending', approver: 'X100001', due_at: daysAgo(1) },
    },
    {
      caseInternalId: betaCaseId,
      caseId: 'CASE-WL-002',
      title: 'Low priority monthly work',
      assignedToXID: 'X100002',
      status: 'IN_PROGRESS',
      priority: 'low',
      dueDate: daysFromNow(10),
      expectedMinutes: 60,
    },
  ];

  stub(User, 'find', (query) => {
    assert.deepStrictEqual(query.role.$in, ['USER', 'MANAGER', 'ADMIN', 'PRIMARY_ADMIN']);
    return buildUserChain(users);
  });
  stub(Case, 'find', (query) => {
    assert.ok(query.$or.some((entry) => entry.assignedToXID), 'workload query should include assigned dockets');
    assert.ok(query.$or.some((entry) => entry.reviewer_xid), 'workload query should include review workload');
    return buildCaseChain(dockets);
  });
  stub(DocketEffort, 'aggregate', async (pipeline) => {
    assert.deepStrictEqual(pipeline[0].$match.userXID.$in.sort(), ['X100001', 'X100002']);
    return [
      { _id: 'X100001', minutes: 540 },
      { _id: 'X100002', minutes: 30 },
    ];
  });

  const result = await docketraIntelligenceService.getWorkloadIntelligence({ firmId });
  const alpha = result.members.find((member) => member.xID === 'X100001');
  const beta = result.members.find((member) => member.xID === 'X100002');

  assert.strictEqual(result.summary.totalMembers, 2);
  assert.strictEqual(alpha.metrics.openDockets, 1);
  assert.strictEqual(alpha.metrics.reviewWorkload, 1);
  assert.ok(alpha.metrics.overdue >= 1);
  assert.strictEqual(alpha.metrics.estimatedHours, 6);
  assert.strictEqual(alpha.metrics.actualHours, 9);
  assert.strictEqual(alpha.metrics.overrunHours, 3);
  assert.ok(alpha.availabilityScore < beta.availabilityScore, 'overdue review work should reduce availability');
  assert.strictEqual(result.recommendations.recommendedAssignee.xID, 'X100002');

  console.log('docketraIntelligence.service.test.js passed');
}

run().catch((error) => {
  console.error('docketraIntelligence.service.test.js failed', error);
  process.exit(1);
}).finally(teardown);
