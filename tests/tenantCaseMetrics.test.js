#!/usr/bin/env node
const assert = require('assert');

const Case = require('../src/models/Case.model');
const TenantCaseMetricsDaily = require('../src/models/TenantCaseMetricsDaily.model');
const {
  upsertTenantDailyMetrics,
  getTenantMetricsByRange,
} = require('../src/services/tenantCaseMetrics.service');

function hasIndex(indexes, keys, options = {}) {
  return indexes.some(([indexKeys, indexOptions]) => {
    const sameKeys = JSON.stringify(indexKeys) === JSON.stringify(keys);
    if (!sameKeys) return false;
    return Object.entries(options).every(([k, v]) => indexOptions?.[k] === v);
  });
}

function testSchemaIndexes() {
  const indexes = TenantCaseMetricsDaily.schema.indexes();
  assert.strictEqual(hasIndex(indexes, { tenantId: 1, date: 1 }, { unique: true }), true);
  assert.strictEqual(hasIndex(indexes, { tenantId: 1, openCases: 1 }), true);
  assert.strictEqual(hasIndex(indexes, { tenantId: 1, overdueCases: 1 }), true);
}

function testCaseSchemaSupportsResolvedAt() {
  assert.ok(Case.schema.path('resolvedAt'));
}

async function testAggregationIdempotencyAndAccuracy() {
  const originalAggregate = Case.aggregate;
  const originalUpdateOne = TenantCaseMetricsDaily.updateOne;
  const updates = [];

  Case.aggregate = async () => ([{
    totalCases: 10,
    openCases: 5,
    pendedCases: 2,
    filedCases: 1,
    resolvedCases: 2,
    pendingApprovals: 1,
    overdueCases: 3,
    avgResolutionTimeSeconds: 3600,
    casesCreatedToday: 4,
    casesResolvedToday: 2,
  }]);

  TenantCaseMetricsDaily.updateOne = async (query, update, options) => {
    updates.push({ query, update, options });
    return { acknowledged: true };
  };

  try {
    await upsertTenantDailyMetrics('FIRM001', '2026-01-10T00:00:00.000Z');
    await upsertTenantDailyMetrics('FIRM001', '2026-01-10T00:00:00.000Z');

    assert.strictEqual(updates.length, 2);
    assert.strictEqual(updates[0].options.upsert, true);
    assert.strictEqual(updates[0].query.tenantId, 'FIRM001');
    assert.strictEqual(updates[0].update.$set.totalCases, 10);
    assert.strictEqual(updates[0].update.$set.overdueCases, 3);
    assert.deepStrictEqual(updates[0].update.$set, updates[1].update.$set);
  } finally {
    Case.aggregate = originalAggregate;
    TenantCaseMetricsDaily.updateOne = originalUpdateOne;
  }
}

async function testDashboardRangeUsesSummaryOnlyAndSupportsLargeData() {
  const originalFind = TenantCaseMetricsDaily.find;

  const summaryRows = Array.from({ length: 5000 }).map((_, i) => ({
    totalCases: 100 + i,
    openCases: 10,
    pendedCases: 4,
    filedCases: 3,
    resolvedCases: 5,
    pendingApprovals: 2,
    overdueCases: 1,
    avgResolutionTimeSeconds: 120,
    casesCreatedToday: 8,
    casesResolvedToday: 6,
  }));

  TenantCaseMetricsDaily.find = () => ({
    select: () => ({
      explain: async () => ({ queryPlanner: { winningPlan: { stage: 'IXSCAN' } } }),
      lean: async () => summaryRows,
    }),
    explain: async () => ({ queryPlanner: { winningPlan: { stage: 'IXSCAN' } } }),
  });

  try {
    const result = await getTenantMetricsByRange(
      'FIRM001',
      '2026-01-01T00:00:00.000Z',
      '2026-01-31T00:00:00.000Z'
    );

    assert.strictEqual(result.rowsCount, 5000);
    assert.strictEqual(result.aggregate.openCases, 50000);
    assert.strictEqual(result.aggregate.overdueCases, 5000);
  } finally {
    TenantCaseMetricsDaily.find = originalFind;
  }
}

async function testRangeGuardrail() {
  let threw = false;
  try {
    await getTenantMetricsByRange('FIRM001', '2026-01-01T00:00:00.000Z', '2027-12-31T00:00:00.000Z');
  } catch (error) {
    threw = true;
    assert.ok(error.message.includes('Date range exceeds 365 days'));
  }
  assert.strictEqual(threw, true);
}

async function run() {
  try {
    testSchemaIndexes();
    testCaseSchemaSupportsResolvedAt();
    await testAggregationIdempotencyAndAccuracy();
    await testDashboardRangeUsesSummaryOnlyAndSupportsLargeData();
    await testRangeGuardrail();
    console.log('Tenant case metrics reporting tests passed.');
  } catch (error) {
    console.error('Tenant case metrics reporting tests failed:', error);
    process.exit(1);
  }
}

run();
