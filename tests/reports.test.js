#!/usr/bin/env node
const assert = require('assert');

let capturedCasePipeline = null;
let capturedSessionPipeline = null;

const mockCaseModel = {
  aggregate: async (pipeline) => {
    capturedCasePipeline = pipeline;

    const groupStage = pipeline.find((stage) => stage.$group);
    if (!groupStage) return [];

    if (groupStage.$group._id === '$state') {
      return [{ _id: 'RESOLVED', count: 2 }];
    }

    if (groupStage.$group._id === '$qcOutcome') {
      return [{ _id: 'PASSED', count: 3 }];
    }

    return [{ _id: 'stub', count: 1 }];
  },
};

const mockDocketSessionModel = {
  aggregate: async (pipeline) => {
    capturedSessionPipeline = pipeline;
    return [{ _id: 'user-1', totalTime: 120 }];
  },
};

const caseModelPath = require.resolve('../src/models/Case.model');
require.cache[caseModelPath] = {
  id: caseModelPath,
  filename: caseModelPath,
  loaded: true,
  exports: mockCaseModel,
};

const docketSessionModelPath = require.resolve('../src/models/DocketSession.model');
require.cache[docketSessionModelPath] = {
  id: docketSessionModelPath,
  filename: docketSessionModelPath,
  loaded: true,
  exports: mockDocketSessionModel,
};

const reportsService = require('../src/services/reports.service');

async function run() {
  console.log('Running reports analytics service tests...');

  // Test 1: productivity aggregation
  {
    capturedCasePipeline = null;
    const response = await reportsService.getUserProductivity({
      firmId: 'firm-1',
      fromDate: '2026-01-01T00:00:00.000Z',
      toDate: '2026-01-31T00:00:00.000Z',
      userId: 'xid-1',
      clientId: 'client-1',
      isInternal: 'true',
      limit: 20,
    });

    assert.ok(Array.isArray(response));
    assert.ok(Array.isArray(capturedCasePipeline));
    assert.strictEqual(capturedCasePipeline[0].$match.firmId, 'firm-1');
    assert.strictEqual(capturedCasePipeline[0].$match.assignedToXID, 'xid-1');
    assert.strictEqual(capturedCasePipeline[0].$match.clientId, 'client-1');
    assert.strictEqual(capturedCasePipeline[0].$match.isInternal, true);
    assert.ok(capturedCasePipeline[0].$match.createdAt.$gte instanceof Date);
    assert.ok(capturedCasePipeline[0].$match.createdAt.$lte instanceof Date);
    assert.strictEqual(capturedCasePipeline[0].$match.createdAt.$lte.getHours(), 23);
    assert.strictEqual(capturedCasePipeline[1].$group._id, '$assignedToXID');
    assert.ok(capturedCasePipeline.some((stage) => stage.$limit === 20));
    console.log('✅ productivity aggregation uses scoped filters and limit');
  }

  // Test 2: QC stats aggregation + zero fill
  {
    capturedCasePipeline = null;
    const response = await reportsService.getQCPerformance({ firmId: 'firm-2' });

    assert.ok(Array.isArray(capturedCasePipeline));
    assert.strictEqual(capturedCasePipeline[0].$match.firmId, 'firm-2');
    assert.deepStrictEqual(capturedCasePipeline[0].$match.qcOutcome, { $ne: null });
    assert.strictEqual(capturedCasePipeline[1].$group._id, '$qcOutcome');
    assert.ok(response.some((r) => r.qcOutcome === 'FAILED' && r.count === 0));
    console.log('✅ QC stats aggregation zero-fills all outcomes');
  }

  // Test 3: time aggregation + sort and limit
  {
    capturedSessionPipeline = null;
    await reportsService.getTimePerUser({
      firmId: 'firm-3',
      fromDate: '2026-02-01T00:00:00.000Z',
      toDate: '2026-02-28T00:00:00.000Z',
      userId: 'user-1',
      sortBy: 'totalTime',
      order: 'asc',
      limit: 25,
    });

    assert.ok(Array.isArray(capturedSessionPipeline));
    assert.strictEqual(capturedSessionPipeline[0].$match.firmId, 'firm-3');
    assert.strictEqual(capturedSessionPipeline[0].$match.userId, 'user-1');
    assert.ok(capturedSessionPipeline[0].$match.startedAt.$gte instanceof Date);
    assert.ok(capturedSessionPipeline[0].$match.startedAt.$lte instanceof Date);
    assert.strictEqual(capturedSessionPipeline[2].$sort.totalTime, 1);
    assert.ok(capturedSessionPipeline.some((stage) => stage.$limit === 25));
    assert.strictEqual(capturedSessionPipeline[1].$group._id, '$userId');
    console.log('✅ time aggregation supports sorting and limits');
  }

  // Test 4: state stats zero fill validation
  {
    capturedCasePipeline = null;
    const response = await reportsService.getDocketStats({ firmId: 'firm-4' });
    assert.ok(response.some((r) => r.state === 'PENDED'));
    assert.ok(response.some((r) => r.state === 'IN_WB'));
    assert.ok(response.some((r) => r.state === 'RESOLVED' && r.count === 2));
    console.log('✅ docket stats zero-fill all canonical states');
  }

  console.log('All reports analytics tests passed.');
}

run().catch((error) => {
  console.error('❌ reports analytics tests failed');
  console.error(error);
  process.exitCode = 1;
});
