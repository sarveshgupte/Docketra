const assert = require('assert');
const mongoose = require('mongoose');
const Case = require('../src/models/Case.model');
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

const chain = (rows) => ({
  select() { return this; },
  lean() { return Promise.resolve(rows); },
});

async function run() {
  const firmId = '67e95f7642adf77d7f4e1834';
  const now = Date.now();
  const daysAgo = (days) => new Date(now - (days * 24 * 60 * 60 * 1000));
  const daysFromNow = (days) => new Date(now + (days * 24 * 60 * 60 * 1000));

  const overdueDockets = Array.from({ length: 12 }, (_, index) => ({
    _id: new mongoose.Types.ObjectId(),
    caseInternalId: new mongoose.Types.ObjectId(),
    caseId: `CASE-DR-OD-${index}`,
    title: `Overdue docket ${index}`,
    status: 'OPEN',
    priority: index < 3 ? 'high' : 'medium',
    dueDate: daysAgo(index + 1),
    assignedToXID: 'X100001',
  }));
  const reviewBottlenecks = Array.from({ length: 5 }, (_, index) => ({
    _id: new mongoose.Types.ObjectId(),
    caseInternalId: new mongoose.Types.ObjectId(),
    caseId: `CASE-DR-RV-${index}`,
    title: `Review docket ${index}`,
    status: 'UNDER_REVIEW',
    priority: 'high',
    dueDate: daysFromNow(index + 1),
    approval_stage: { status: 'pending', approver: 'X100002' },
    reviewer_xid: 'X100002',
  }));
  const dueToday = {
    _id: new mongoose.Types.ObjectId(),
    caseInternalId: new mongoose.Types.ObjectId(),
    caseId: 'CASE-DR-TODAY',
    title: 'Due today',
    status: 'IN_PROGRESS',
    priority: 'urgent',
    dueDate: new Date(now),
  };

  stub(Case, 'find', (query) => {
    assert.ok(query.firmId.$in.includes(String(firmId)), 'deadline risk query should be firm-scoped');
    return chain([...overdueDockets, ...reviewBottlenecks, dueToday]);
  });

  const result = await docketraIntelligenceService.getDeadlineRiskIntelligence({ firmId });

  assert.strictEqual(result.counts.overdueDockets, 12);
  assert.strictEqual(result.counts.reviewBottlenecks, 5);
  assert.strictEqual(result.counts.dueToday, 1);
  assert.ok(result.counts.dueThisWeek >= 6);
  assert.strictEqual(result.riskLevel, 'Critical');
  assert.strictEqual(result.recommendedAction, 'Reassign work immediately.');
  assert.strictEqual(result.affectedDocketCount, 18);
  assert.ok(result.radar.some((entry) => entry.label === 'Review Bottlenecks' && entry.value === 5));
  assert.strictEqual(docketraIntelligenceService.getDeadlineRiskLevel({ overdueDockets: 0, dueToday: 0, dueThisWeek: 0, highPriorityDueThisWeek: 0, reviewBottlenecks: 0 }), 'Low Risk');

  console.log('docketraDeadlineRisk.service.test.js passed');
}

run().catch((error) => {
  console.error('docketraDeadlineRisk.service.test.js failed', error);
  process.exit(1);
}).finally(teardown);
