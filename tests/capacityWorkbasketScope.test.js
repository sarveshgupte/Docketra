#!/usr/bin/env node
const assert = require('assert');

const Case = require('../src/models/Case.model');

const controllerPath = require.resolve('../src/controllers/capacity.controller');
const freshController = () => {
  delete require.cache[controllerPath];
  return require('../src/controllers/capacity.controller');
};

const makeRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

async function testActiveQueueScopePrecedence() {
  const originalFind = Case.find;
  let capturedQuery = null;

  Case.find = (query) => {
    capturedQuery = query;
    const chain = {
      select: () => chain,
      sort: () => chain,
      lean: async () => [],
    };
    return chain;
  };

  const req = {
    params: { workbasketId: '60d5ec49f3e1a329dc3309a4' },
    query: {},
    user: { firmId: '60d5ec49f3e1a329dc3309a1' },
  };
  const res = makeRes();

  try {
    const controller = freshController();
    await controller.getWorkbasketDockets(req, res);

    assert.strictEqual(res.statusCode, undefined);
    assert.strictEqual(res.data.success, true);
    assert.ok(capturedQuery, 'Expected Case.find query capture');

    assert.ok(Array.isArray(capturedQuery.$or), 'Expected queue scope to be an $or group');
    assert.strictEqual(capturedQuery.$or.length, 2, 'Expected routed + fallback queue branches');

    const routedBranch = capturedQuery.$or.find((entry) => entry?.routedToTeamId && !entry?.$or);
    assert.ok(routedBranch, 'Expected direct routedToTeamId branch');
    assert.strictEqual(String(routedBranch.routedToTeamId), req.params.workbasketId, 'routedToTeamId branch must scope to selected workbasket');

    const fallbackBranch = capturedQuery.$or.find((entry) => entry?.routedToTeamId === null && Array.isArray(entry?.$or));
    assert.ok(fallbackBranch, 'Expected fallback branch when routedToTeamId is null');
    const fallbackKeys = new Set(fallbackBranch.$or.flatMap((entry) => Object.keys(entry || {})));
    assert.ok(fallbackKeys.has('ownerTeamId'), 'Fallback branch must include ownerTeamId');
    assert.ok(fallbackKeys.has('workbasketId'), 'Fallback branch must include workbasketId');

    console.log('capacityWorkbasketScope.test.js passed');
  } finally {
    Case.find = originalFind;
  }
}

testActiveQueueScopePrecedence().catch((error) => {
  console.error(error);
  process.exit(1);
});
