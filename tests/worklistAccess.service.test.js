const assert = require('assert');
const { canViewUserWorklist } = require('../src/services/worklistAccess.service');

const firmId = 'firm-1';
const ownUser = { _id: 'u-1', xID: 'X100001', role: 'USER', firmId, teamIds: ['t-1'] };
const coworker = { _id: 'u-2', xID: 'X100002', role: 'USER', firmId, managerId: 'mgr-1', teamIds: ['t-1'] };
const unrelated = { _id: 'u-3', xID: 'X100003', role: 'USER', firmId: 'firm-2', teamIds: ['t-9'] };

assert.strictEqual(canViewUserWorklist(ownUser, ownUser), true);
assert.strictEqual(canViewUserWorklist(ownUser, coworker), false);
assert.strictEqual(
  canViewUserWorklist({ _id: 'mgr-1', xID: 'X200001', role: 'MANAGER', firmId, teamIds: ['t-1'] }, coworker),
  true,
);
assert.strictEqual(
  canViewUserWorklist({ _id: 'mgr-1', xID: 'X200001', role: 'MANAGER', firmId, teamIds: ['t-1'] }, { ...coworker, managerId: 'mgr-x', teamIds: ['t-7'] }),
  false,
);
assert.strictEqual(canViewUserWorklist({ xID: 'X300001', role: 'ADMIN', firmId }, coworker), true);
assert.strictEqual(canViewUserWorklist({ xID: 'X300002', role: 'PRIMARY_ADMIN', firmId }, coworker), true);
assert.strictEqual(canViewUserWorklist({ xID: 'X400001', role: 'SUPER_ADMIN', firmId }, coworker), false);
assert.strictEqual(canViewUserWorklist({ xID: 'X300001', role: 'ADMIN', firmId }, unrelated), false);

console.log('worklistAccess.service tests passed');
