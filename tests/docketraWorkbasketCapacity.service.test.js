const assert = require('assert');
const mongoose = require('mongoose');
const Case = require('../src/models/Case.model');
const DocketEffort = require('../src/models/DocketEffort.model');
const Team = require('../src/models/Team.model');
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

const chain = (rows) => ({
  select() { return this; },
  sort() { return this; },
  lean() { return Promise.resolve(rows); },
});

const hasWorkbasketId = (query, id) => JSON.stringify(query).includes(String(id));
const hasUserWorkloadQuery = (query) => Boolean(query?.$or?.some((entry) => entry.assignedToXID));

async function run() {
  const firmId = '67e95f7642adf77d7f4e1834';
  const gstId = new mongoose.Types.ObjectId();
  const rocId = new mongoose.Types.ObjectId();
  const now = Date.now();
  const daysAgo = (days) => new Date(now - (days * 24 * 60 * 60 * 1000));
  const daysFromNow = (days) => new Date(now + (days * 24 * 60 * 60 * 1000));
  const gstCaseOne = new mongoose.Types.ObjectId();
  const gstCaseTwo = new mongoose.Types.ObjectId();
  const rocCaseOne = new mongoose.Types.ObjectId();

  const workbaskets = [
    { _id: gstId, name: 'GST Team', type: 'PRIMARY', parentWorkbasketId: null },
    { _id: rocId, name: 'ROC Team', type: 'PRIMARY', parentWorkbasketId: null },
  ];
  const usersByWorkbasket = {
    [String(gstId)]: [
      { _id: new mongoose.Types.ObjectId(), xID: 'X100001', name: 'GST Owner', role: 'USER', teamIds: [gstId] },
    ],
    [String(rocId)]: [
      { _id: new mongoose.Types.ObjectId(), xID: 'X100002', name: 'ROC Owner', role: 'USER', teamIds: [rocId] },
    ],
  };
  const docketsByWorkbasket = {
    [String(gstId)]: [
      { caseInternalId: gstCaseOne, assignedToXID: 'X100001', status: 'OPEN', priority: 'urgent', dueDate: daysAgo(3), expectedMinutes: 2400, workbasketId: gstId },
      { caseInternalId: gstCaseTwo, assignedToXID: 'X100001', status: 'IN_PROGRESS', priority: 'high', dueDate: daysFromNow(1), expectedMinutes: 600, workbasketId: gstId },
    ],
    [String(rocId)]: [
      { caseInternalId: rocCaseOne, assignedToXID: 'X100002', status: 'OPEN', priority: 'low', dueDate: daysFromNow(12), expectedMinutes: 120, workbasketId: rocId },
    ],
  };

  stub(Team, 'find', (query) => {
    assert.strictEqual(query.type, 'PRIMARY');
    assert.strictEqual(query.isActive.$ne, false);
    return chain(workbaskets);
  });
  stub(User, 'find', (query) => {
    const workbasketId = hasWorkbasketId(query, gstId) ? String(gstId) : String(rocId);
    return chain(usersByWorkbasket[workbasketId] || []);
  });
  stub(Case, 'find', (query) => {
    const workbasketId = hasWorkbasketId(query, gstId) ? String(gstId) : String(rocId);
    const rows = docketsByWorkbasket[workbasketId] || [];
    assert.ok(hasUserWorkloadQuery(query) || query.$or.some((entry) => entry.workbasketId || entry.ownerTeamId || entry.routedToTeamId));
    return chain(rows);
  });
  stub(DocketEffort, 'aggregate', async (pipeline) => {
    const match = pipeline[0].$match || {};
    if (match.userXID) {
      return match.userXID.$in.includes('X100001')
        ? [{ _id: 'X100001', minutes: 4200 }]
        : [{ _id: 'X100002', minutes: 60 }];
    }
    return JSON.stringify(match.caseInternalId?.$in || []).includes(String(gstCaseOne))
      ? [{ _id: null, minutes: 4200 }]
      : [{ _id: null, minutes: 60 }];
  });

  const result = await docketraIntelligenceService.getWorkbasketCapacityIntelligence({ firmId });
  const [first, second] = result.workbaskets;

  assert.strictEqual(result.summary.totalWorkbaskets, 2);
  assert.strictEqual(first.name, 'GST Team', 'highest utilization workbasket should sort first');
  assert.strictEqual(first.memberCount, 1);
  assert.strictEqual(first.openDockets, 2);
  assert.strictEqual(first.overdueDockets, 1);
  assert.strictEqual(first.totalEstimatedHours, 50);
  assert.strictEqual(first.totalActualHours, 70);
  assert.ok(first.capacityUtilization > second.capacityUtilization);
  assert.ok(['Busy', 'Overloaded'].includes(first.capacityLabel));
  assert.strictEqual(second.name, 'ROC Team');
  assert.strictEqual(second.capacityLabel, 'Healthy');

  const tunedLabel = docketraIntelligenceService.getWorkbasketCapacityLabel(81, { busy: 66, overloaded: 86 });
  assert.strictEqual(tunedLabel, 'Busy');

  console.log('docketraWorkbasketCapacity.service.test.js passed');
}

run().catch((error) => {
  console.error('docketraWorkbasketCapacity.service.test.js failed', error);
  process.exit(1);
}).finally(teardown);
