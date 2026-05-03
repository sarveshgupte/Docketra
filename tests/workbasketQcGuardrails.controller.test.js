const assert = require('assert');
const workbasketController = require('../src/controllers/workbasket.controller');
const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');
const mongoose = require('mongoose');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function testAddQcMemberGuards() {
  const originalTeamFindOne = Team.findOne;
  const originalUserFindOne = User.findOne;
  const originalUserUpdateOne = User.updateOne;

  Team.findOne = (query) => ({
    lean: async () => {
      if (query.type === 'QC') return { _id: query._id, firmId: query.firmId, parentWorkbasketId: new mongoose.Types.ObjectId() };
      return { _id: query._id, managerId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011') };
    },
  });
  User.findOne = async () => ({ _id: new mongoose.Types.ObjectId() });
  let updated = false;
  User.updateOne = async () => { updated = true; };

  const req = { params: { workbasketId: '507f1f77bcf86cd799439012' }, body: { userId: '507f1f77bcf86cd799439013' }, user: { _id: '507f1f77bcf86cd799439011', role: 'MANAGER', firmId: '507f1f77bcf86cd799439014' } };
  const res = mockRes();
  await workbasketController.addQcMember(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(updated, true);

  Team.findOne = originalTeamFindOne;
  User.findOne = originalUserFindOne;
  User.updateOne = originalUserUpdateOne;
}

async function testAddQcMemberDeniedForNormalUser() {
  const originalTeamFindOne = Team.findOne;
  Team.findOne = (query) => ({ lean: async () => (query.type === 'QC' ? { _id: query._id, parentWorkbasketId: new mongoose.Types.ObjectId() } : { managerId: new mongoose.Types.ObjectId() }) });

  const req = { params: { workbasketId: '507f1f77bcf86cd799439012' }, body: { userId: '507f1f77bcf86cd799439013' }, user: { _id: '507f1f77bcf86cd799439099', role: 'USER', firmId: '507f1f77bcf86cd799439014' } };
  const res = mockRes();
  await workbasketController.addQcMember(req, res);
  assert.strictEqual(res.statusCode, 403);

  Team.findOne = originalTeamFindOne;
}

async function run() {
  try {
    await testAddQcMemberGuards();
    await testAddQcMemberDeniedForNormalUser();
    console.log('workbasket QC guardrail controller tests passed.');
  } catch (error) {
    console.error('workbasket QC guardrail controller tests failed:', error);
    process.exit(1);
  }
}

run();
