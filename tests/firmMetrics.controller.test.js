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
  const queries = [];

  try {
    Case.countDocuments = async (query) => {
      queries.push(query);
      if (query.dueDate && query.dueDate.$lt && !query.dueDate.$gte) return 3;
      if (query.dueDate && query.dueDate.$gte && query.dueDate.$lte) return 5;
      if (query.$or) return 2;
      if (query.status === 'OPEN') return 12;
      if (query.status && query.status.$in) return 9;
      return 0;
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

    const awaitingPartnerReviewQuery = queries.find(q => q.$or);
    assert.strictEqual(awaitingPartnerReviewQuery.$or[0].approvalStatus, 'PENDING');

    const totalOpenCasesQuery = queries.find(q => q.status === 'OPEN');
    assert.strictEqual(totalOpenCasesQuery.status, 'OPEN');

    const totalExecutedCasesQuery = queries.find(q => q.status && q.status.$in);
    assert.deepStrictEqual(totalExecutedCasesQuery.status.$in, ['RESOLVED', 'FILED']);

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
    Case.countDocuments = originalCountDocuments;
  }
}

run();
