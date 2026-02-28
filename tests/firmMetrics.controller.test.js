#!/usr/bin/env node
const assert = require('assert');
const Case = require('../src/models/Case.model');
const { getFirmMetrics } = require('../src/controllers/firmMetrics.controller');

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

async function run() {
  const originalCountDocuments = Case.countDocuments;
  const expectedCounts = [3, 5, 2, 12, 9];
  const queries = [];
  let callIndex = 0;

  try {
    Case.countDocuments = async (query) => {
      queries.push(query);
      return expectedCounts[callIndex++];
    };

    const req = { firmId: '507f1f77bcf86cd799439011' };
    const res = createMockRes();

    await getFirmMetrics(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.deepStrictEqual(res.body.data, {
      overdueComplianceItems: 3,
      dueInSevenDays: 5,
      awaitingPartnerReview: 2,
      totalOpenCases: 12,
      totalExecutedCases: 9,
    });
    assert.strictEqual(queries.length, 5);
    assert.strictEqual(queries[2].$or[0].approvalStatus, 'PENDING');
    assert.strictEqual(queries[3].status, 'OPEN');
    assert.deepStrictEqual(queries[4].status.$in, ['RESOLVED', 'FILED']);

    console.log('Firm metrics controller test passed.');
  } catch (error) {
    console.error('Firm metrics controller test failed:', error);
    process.exit(1);
  } finally {
    Case.countDocuments = originalCountDocuments;
  }
}

run();
