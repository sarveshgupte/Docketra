#!/usr/bin/env node
/**
 * Verifies employee worklist supports a server-side limit for dashboard snapshots.
 */

const assert = require('assert');
const Case = require('../src/models/Case.model');
const auditLogService = require('../src/services/auditLog.service');
const caseActionService = require('../src/services/caseAction.service');

const createRes = () => ({
  statusCode: null,
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

async function shouldApplyEmployeeWorklistLimit() {
  const originalFind = Case.find;
  const originalLogCaseListViewed = auditLogService.logCaseListViewed;
  const originalAutoReopen = caseActionService.autoReopenExpiredPendingCases;
  const controllerPath = require.resolve('../src/controllers/search.controller');

  let observedQuery = null;
  let observedSort = null;
  let observedLimit = null;

  const chain = {
    select() {
      return this;
    },
    sort(sortSpec) {
      observedSort = sortSpec;
      return this;
    },
    limit(value) {
      observedLimit = value;
      return this;
    },
    async lean() {
      return [
        {
          _id: 'mongo-1',
          caseId: 'CASE-1',
          caseName: 'First dashboard case',
          category: 'GST',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-08T00:00:00.000Z',
          status: 'OPEN',
        },
      ];
    },
  };

  Case.find = (query) => {
    observedQuery = query;
    return chain;
  };
  auditLogService.logCaseListViewed = async () => {};
  caseActionService.autoReopenExpiredPendingCases = async () => {};
  delete require.cache[controllerPath];
  const searchController = require('../src/controllers/search.controller');

  const req = {
    query: { limit: '5' },
    user: { xID: 'X123456' },
    firmId: 'firm-1',
  };
  const res = createRes();

  await searchController.employeeWorklist(req, res);

  assert.deepStrictEqual(observedQuery, {
    firmId: 'firm-1',
    assignedToXID: 'X123456',
    status: 'OPEN',
  });
  assert.deepStrictEqual(observedSort, { updatedAt: -1, createdAt: -1 });
  assert.strictEqual(observedLimit, 5, 'Expected employee worklist to apply the requested limit');
  assert.strictEqual(res.statusCode, null);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].caseId, 'CASE-1');
  console.log('✓ Employee worklist applies server-side dashboard limits');

  Case.find = originalFind;
  auditLogService.logCaseListViewed = originalLogCaseListViewed;
  caseActionService.autoReopenExpiredPendingCases = originalAutoReopen;
  delete require.cache[controllerPath];
}

shouldApplyEmployeeWorklistLimit().catch((error) => {
  console.error('Employee worklist limit test failed:', error);
  process.exit(1);
});
