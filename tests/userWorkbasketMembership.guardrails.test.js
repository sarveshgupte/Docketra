const assert = require('assert');
const mongoose = require('mongoose');
const workbasketController = require('../src/controllers/workbasket.controller');
const { normalizeMembership } = require('../src/services/userWorkbasketMembership.service');
const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');

function res(){return{statusCode:200,body:null,status(c){this.statusCode=c;return this;},json(p){this.body=p;return this;}}}

async function testActiveCannotHaveZeroPrimary() {
  assert.throws(() => normalizeMembership({ role: 'USER', teams: [], requirePrimary: true }), /PRIMARY workbasket/);
  assert.throws(() => normalizeMembership({ role: 'MANAGER', teams: [{ _id: new mongoose.Types.ObjectId(), type: 'QC' }], requirePrimary: true }), /PRIMARY workbasket/);
}

async function testMembershipDedupAndTeamIdFirstPrimary() {
  const p1 = new mongoose.Types.ObjectId();
  const p2 = new mongoose.Types.ObjectId();
  const q1 = new mongoose.Types.ObjectId();
  const m = normalizeMembership({ role: 'USER', teams: [{ _id: p1, type: 'PRIMARY' }, { _id: p2, type: 'PRIMARY' }, { _id: q1, type: 'QC' }], qcExplicitTeamIds: [q1, q1], requirePrimary: true });
  assert.strictEqual(m.teamId, String(p1));
  assert.deepStrictEqual(m.teamIds, [String(p1), String(p2), String(q1)]);
  assert.deepStrictEqual(m.qcExplicitTeamIds, [String(q1)]);
}

async function testListVisibilityByRole() {
  const originalFind = Team.find;
  const originalAggregate = User.aggregate;
  const calls = [];
  Team.find = (query) => { calls.push(query); return { sort: () => ({ lean: async () => [] }) }; };
  User.aggregate = async () => [];

  await workbasketController.listWorkbaskets({ query: {}, user: { role: 'PRIMARY_ADMIN', firmId: 'F1' } }, res());
  assert.ok(!calls[0].$or);

  await workbasketController.listWorkbaskets({ query: {}, user: { role: 'USER', firmId: 'F1', teamIds: ['T1'] } }, res());
  assert.deepStrictEqual(calls[1].$or, [{ _id: { $in: ['T1'] } }]);

  await workbasketController.listWorkbaskets({ query: {}, user: { role: 'MANAGER', _id: 'U1', firmId: 'F1', teamIds: ['T2'] } }, res());
  assert.strictEqual(calls[2].$or.length, 2);

  const sr = res();
  await workbasketController.listWorkbaskets({ query: {}, user: { role: 'SUPER_ADMIN', firmId: null } }, sr);
  assert.deepStrictEqual(sr.body.data, []);

  Team.find = originalFind;
  User.aggregate = originalAggregate;
}

async function testUpdateWorkbasketsValidationMapsTo400() {
  const originalUserFindOne = User.findOne;
  const originalTeamFind = Team.find;

  User.findOne = async () => ({ _id: 'U1', role: 'USER', status: 'active', qcExplicitTeamIds: [], save: async () => {} });
  Team.find = (query) => {
    if (query.type === 'QC') return { select: () => ({ lean: async () => [] }) };
    return { select: () => ({ lean: async () => [] }) };
  };

  const badId = res();
  await workbasketController.updateUserWorkbaskets({ params: { xID: 'x000001' }, body: { teamIds: ['not-id'] }, user: { firmId: 'F1' } }, badId);
  assert.strictEqual(badId.statusCode, 400);

  const qcOnly = new mongoose.Types.ObjectId();
  Team.find = (query) => {
    if (query.type === 'QC') return { select: () => ({ lean: async () => [] }) };
    return { select: () => ({ lean: async () => [{ _id: qcOnly, type: 'QC' }] }) };
  };
  const qcOnlyRes = res();
  await workbasketController.updateUserWorkbaskets({ params: { xID: 'x000001' }, body: { teamIds: [String(qcOnly)] }, user: { firmId: 'F1' } }, qcOnlyRes);
  assert.strictEqual(qcOnlyRes.statusCode, 400);

  User.findOne = originalUserFindOne;
  Team.find = originalTeamFind;
}

async function testPrimaryUpdatePreservesExplicitQcMembership() {
  const originalUserFindOne = User.findOne;
  const originalTeamFind = Team.find;

  const primary = new mongoose.Types.ObjectId();
  const explicitQc = new mongoose.Types.ObjectId();
  const userDoc = {
    _id: 'U1',
    role: 'USER',
    status: 'active',
    qcExplicitTeamIds: [explicitQc],
    teamIds: [],
    teamId: null,
    save: async () => {},
  };
  User.findOne = async () => userDoc;
  Team.find = (query) => {
    if (query.type === 'QC') return { select: () => ({ lean: async () => [{ _id: explicitQc, type: 'QC' }] }) };
    return { select: () => ({ lean: async () => [{ _id: primary, type: 'PRIMARY' }] }) };
  };

  const rr = res();
  await workbasketController.updateUserWorkbaskets({ params: { xID: 'x000001' }, body: { teamIds: [String(primary)] }, user: { firmId: 'F1' } }, rr);
  assert.strictEqual(rr.statusCode, 200);
  assert.deepStrictEqual(userDoc.qcExplicitTeamIds, [String(explicitQc)]);
  assert.deepStrictEqual(userDoc.teamIds, [String(primary), String(explicitQc)]);

  User.findOne = originalUserFindOne;
  Team.find = originalTeamFind;
}

async function run(){
  await testActiveCannotHaveZeroPrimary();
  await testMembershipDedupAndTeamIdFirstPrimary();
  await testListVisibilityByRole();
  await testUpdateWorkbasketsValidationMapsTo400();
  await testPrimaryUpdatePreservesExplicitQcMembership();
  console.log('userWorkbasketMembership.guardrails tests passed');
}

run().catch((e)=>{console.error(e);process.exit(1);});
