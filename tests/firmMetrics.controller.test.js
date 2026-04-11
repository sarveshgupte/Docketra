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
  const originalAggregate = Case.aggregate;
  const queries = [];

  try {
    Case.aggregate = async (pipeline) => {
      queries.push(pipeline);
      return [{
        overdueComplianceItems: [{ count: 3 }],
        dueInSevenDays: [{ count: 5 }],
        awaitingPartnerReview: [{ count: 2 }],
        totalOpenCases: [{ count: 12 }],
        totalExecutedCases: [{ count: 9 }],
      }];
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

    assert.strictEqual(queries.length, 1);
    const pipeline = queries[0];
    assert.strictEqual(pipeline[0].$match.firmId, req.firmId);
    const facet = pipeline[1].$facet;
    assert.strictEqual(facet.awaitingPartnerReview[0].$match.$or[0].approvalStatus, 'PENDING');
    assert.strictEqual(facet.totalOpenCases[0].$match.status, 'OPEN');
    assert.deepStrictEqual(facet.totalExecutedCases[0].$match.status.$in, ['RESOLVED', 'FILED']);

    const invalidRes = createMockRes();
    await getFirmMetrics({ firmId: 'acme-legal' }, invalidRes);
    assert.strictEqual(invalidRes.statusCode, 200);
    assert.deepStrictEqual(invalidRes.body.data, {
      overdueComplianceItems: 0,
      dueInSevenDays: 0,
      awaitingPartnerReview: 0,
      totalOpenCases: 0,
      totalExecutedCases: 0,
    });

    console.log('Firm metrics controller test passed.');
  } catch (error) {
    console.error('Firm metrics controller test failed:', error);
    process.exit(1);
  } finally {
    Case.aggregate = originalAggregate;
  }
}

run();
