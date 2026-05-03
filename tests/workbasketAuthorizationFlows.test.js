const assert = require('assert');

const {
  canPullFromWorkbasket,
  canAssignFromWorkbasket,
  canMoveBetweenWorklists,
} = require('../src/services/workbasketAuthorization.service');

const wb = 'wb-1';
const docket = { state: 'IN_WB', status: 'UNASSIGNED', assignedToXID: null, ownerTeamId: wb };

const user = { role: 'USER', teamIds: [wb], isActive: true };
const otherUser = { role: 'USER', teamIds: ['wb-2'], isActive: true };
const manager = { role: 'MANAGER', teamIds: [wb], isActive: true };
const primaryAdmin = { role: 'PRIMARY_ADMIN', teamIds: [], isActive: true };

assert.strictEqual(canPullFromWorkbasket({ user, docket }), true, 'linked user can pull');
assert.strictEqual(canPullFromWorkbasket({ user: otherUser, docket }), false, 'unlinked user cannot pull');
assert.strictEqual(canPullFromWorkbasket({ user: primaryAdmin, docket }), true, 'primary admin can pull any');

assert.strictEqual(canAssignFromWorkbasket({ actor: manager, docket, assignee: user }), true, 'manager can assign in linked wb');
assert.strictEqual(canAssignFromWorkbasket({ actor: manager, docket: { ...docket, ownerTeamId: 'wb-x' }, assignee: user }), false, 'manager cannot assign unrelated wb');
assert.strictEqual(canAssignFromWorkbasket({ actor: primaryAdmin, docket, assignee: otherUser }), true, 'primary admin can assign');
assert.strictEqual(canAssignFromWorkbasket({ actor: user, docket, assignee: otherUser }), false, 'normal user cannot assign others');

assert.strictEqual(canMoveBetweenWorklists({ actor: manager, docket: { ...docket, state: 'IN_PROGRESS', assignedToXID: 'X000001' }, toUser: user }), true, 'manager can move between linked users');
assert.strictEqual(canMoveBetweenWorklists({ actor: primaryAdmin, docket: { ...docket, state: 'IN_PROGRESS', assignedToXID: 'X000001' }, toUser: otherUser }), true, 'primary admin can move');

assert.strictEqual(canPullFromWorkbasket({ user, docket: { ...docket, ownerTeamId: null, workbasketId: wb } }), true, 'workbasketId fallback works when ownerTeamId missing');
assert.strictEqual(canPullFromWorkbasket({ user, docket: { ...docket, status: 'FILED' } }), false, 'filed blocked');
assert.strictEqual(canPullFromWorkbasket({ user, docket: { ...docket, status: 'RESOLVED' } }), false, 'resolved blocked');

console.log('workbasket authorization flow tests passed');
