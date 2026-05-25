const assert = require('node:assert/strict');

const Team = require('../src/models/Team.model');
const User = require('../src/models/User.model');
const Case = require('../src/models/Case.model');
const caseActionService = require('../src/services/caseAction.service');
const { employeeWorklist } = require('../src/controllers/search.controller');

const mkRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

const original = {
  userFindOne: User.findOne,
  teamFindOne: Team.findOne,
  caseFind: Case.find,
  autoReopen: caseActionService.autoReopenExpiredPendingCases,
};

const mkQueryChain = (result) => ({
  select() { return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  lean: async () => result,
});

(async () => {
  try {
    caseActionService.autoReopenExpiredPendingCases = async () => {};

    const baseUser = { _id: 'u1', xID: 'X100', role: 'USER', firmId: '507f1f77bcf86cd799439011', teamId: '507f1f77bcf86cd799439012', teamIds: ['507f1f77bcf86cd799439012'] };
    User.findOne = () => ({ select: () => ({ lean: async () => ({ _id: 'u1', xID: 'X100', role: 'USER', firmId: baseUser.firmId }) }) });
    Team.findOne = () => ({ select: () => ({ lean: async () => ({ _id: '507f1f77bcf86cd799439012', parentWorkbasketId: null }) }) });

    let capturedQuery = null;
    Case.find = (query) => { capturedQuery = query; return mkQueryChain([]); };

    const req = {
      query: { workbasketId: '507f1f77bcf86cd799439012', category: 'Tax', subcategory: 'Appeal', search: 'C-100' },
      user: baseUser,
    };
    const res = mkRes();
    await employeeWorklist(req, res);

    assert.equal(res.statusCode, 200, 'expected successful response');
    assert.ok(capturedQuery, 'query should be initialized and passed to Case.find');
    assert.equal(capturedQuery.assignedToXID, 'X100', 'base assignedToXID filter should exist');
    assert.equal(capturedQuery.category, 'Tax', 'category filter should exist');
    assert.ok(Array.isArray(capturedQuery.$and) && capturedQuery.$and.length >= 3, 'subcategory, workbasket, and search filters should coexist in $and');

    const badReq = { query: { workbasketId: 'invalid' }, user: baseUser };
    const badRes = mkRes();
    await employeeWorklist(badReq, badRes);
    assert.equal(badRes.statusCode, 400, 'invalid workbasketId should return 400');

    console.log('worklistScopedAuthorizationRegression.test.js passed');
  } finally {
    User.findOne = original.userFindOne;
    Team.findOne = original.teamFindOne;
    Case.find = original.caseFind;
    caseActionService.autoReopenExpiredPendingCases = original.autoReopen;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
