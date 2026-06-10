const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const Case = require('../models/Case.model');
const Firm = require('../models/Firm.model');
const TenantCaseMetricsDaily = require('../models/TenantCaseMetricsDaily.model');
const CaseStatus = require('../domain/case/caseStatus');
const log = require('../utils/log');

const MAX_DASHBOARD_RANGE_DAYS = 365;

const normalizeUtcDate = (dateInput) => {
  const dt = DateTime.fromJSDate(new Date(dateInput), { zone: 'utc' }).startOf('day');
  return dt.toJSDate();
};

const getDateBoundsUtc = (dateInput) => {
  const start = normalizeUtcDate(dateInput);
  const end = DateTime.fromJSDate(start, { zone: 'utc' }).plus({ days: 1 }).toJSDate();
  return { start, end };
};

async function ensureSummaryIndexes() {
  await TenantCaseMetricsDaily.collection.createIndexes([
    { key: { tenantId: 1, date: 1 }, name: 'tenantId_1_date_1', unique: true },
    { key: { tenantId: 1, openCases: 1 }, name: 'tenantId_1_openCases_1' },
    { key: { tenantId: 1, overdueCases: 1 }, name: 'tenantId_1_overdueCases_1' },
  ]);

  const indexPlans = await TenantCaseMetricsDaily.collection.indexes();
  const indexNames = new Set(indexPlans.map((idx) => idx.name));
  ['tenantId_1_date_1', 'tenantId_1_openCases_1', 'tenantId_1_overdueCases_1'].forEach((requiredIndex) => {
    if (!indexNames.has(requiredIndex)) {
      throw new Error(`[METRICS] Missing expected index: ${requiredIndex}`);
    }
  });
}

async function verifySummaryExplainUsesIndex(tenantId, fromDate, toDate) {
  const explain = await TenantCaseMetricsDaily.find({
    tenantId,
    date: { $gte: fromDate, $lte: toDate },
  }).select({ _id: 0, totalCases: 1, resolvedCases: 1 }).explain('executionStats');

  const winningPlan = explain?.queryPlanner?.winningPlan || {};
  const planText = JSON.stringify(winningPlan);
  if (planText.includes('COLLSCAN')) {
    throw new Error('[METRICS] Summary query explain includes COLLSCAN');
  }

  return explain;
}

async function computeTenantDailyMetrics(tenantId, dateInput) {
  const { start, end } = getDateBoundsUtc(dateInput);

  // ⚡ Bolt: Revert $facet for mixed pipeline operations
  // 💡 What: Refactored computeTenantDailyMetrics to run a single $group pipeline for totals concurrently via Promise.all alongside individual countDocuments queries.
  // 🎯 Why: While $facet groups operations into a single network roundtrip, it forces MongoDB to pull all matching documents into memory to evaluate the sub-pipelines, bypassing indexes. Individual countDocuments queries can be resolved using fast index scans.
  // 📊 Impact: Reduces memory usage and leverages index scans for simple counts, preventing 100MB aggregation memory limit risks.
  const [totalsAgg, casesCreatedToday, casesResolvedToday] = await Promise.all([
    Case.aggregate([
      {
        $match: {
          firmId: tenantId,
          createdAt: { $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          openCases: {
            $sum: {
              $cond: [
                { $in: ['$status', [CaseStatus.OPEN, CaseStatus.PENDING, CaseStatus.FILED]] },
                1,
                0,
              ],
            },
          },
          pendedCases: { $sum: { $cond: [{ $eq: ['$status', CaseStatus.PENDING] }, 1, 0] } },
          filedCases: { $sum: { $cond: [{ $eq: ['$status', CaseStatus.FILED] }, 1, 0] } },
          resolvedCases: { $sum: { $cond: [{ $eq: ['$status', CaseStatus.RESOLVED] }, 1, 0] } },
          pendingApprovals: {
            $sum: {
              $cond: [
                { $in: ['$status', [CaseStatus.REVIEWED, CaseStatus.UNDER_REVIEW]] },
                1,
                0,
              ],
            },
          },
          overdueCases: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$dueDate', end] },
                    { $ne: ['$status', CaseStatus.RESOLVED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          avgResolutionTimeSeconds: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', CaseStatus.RESOLVED] },
                    { $ne: ['$resolvedAt', null] },
                  ],
                },
                { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000] },
                null,
              ],
            },
          },
        },
      },
    ]),
    Case.countDocuments({
      firmId: tenantId,
      createdAt: { $gte: start, $lt: end },
    }),
    Case.countDocuments({
      firmId: tenantId,
      createdAt: { $lt: end },
      status: CaseStatus.RESOLVED,
      resolvedAt: { $gte: start, $lt: end },
    }),
  ]);

  const result = totalsAgg[0] || {};

  return {
    tenantId,
    date: start,
    totalCases: Number(result.totalCases || 0),
    openCases: Number(result.openCases || 0),
    pendedCases: Number(result.pendedCases || 0),
    filedCases: Number(result.filedCases || 0),
    resolvedCases: Number(result.resolvedCases || 0),
    pendingApprovals: Number(result.pendingApprovals || 0),
    overdueCases: Number(result.overdueCases || 0),
    avgResolutionTimeSeconds: Number(result.avgResolutionTimeSeconds || 0),
    casesCreatedToday: Number(casesCreatedToday || 0),
    casesResolvedToday: Number(casesResolvedToday || 0),
  };
}

async function upsertTenantDailyMetrics(tenantId, dateInput, session = null) {
  const metricDoc = await computeTenantDailyMetrics(tenantId, dateInput);
  const update = {
    $set: {
      totalCases: metricDoc.totalCases,
      openCases: metricDoc.openCases,
      pendedCases: metricDoc.pendedCases,
      filedCases: metricDoc.filedCases,
      resolvedCases: metricDoc.resolvedCases,
      pendingApprovals: metricDoc.pendingApprovals,
      overdueCases: metricDoc.overdueCases,
      avgResolutionTimeSeconds: metricDoc.avgResolutionTimeSeconds,
      casesCreatedToday: metricDoc.casesCreatedToday,
      casesResolvedToday: metricDoc.casesResolvedToday,
    },
  };

  return TenantCaseMetricsDaily.updateOne(
    { tenantId, date: metricDoc.date },
    update,
    { upsert: true, session }
  );
}

async function runTenantAggregation(tenantId, dateInput) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await upsertTenantDailyMetrics(tenantId, dateInput, session);
    });
  } catch (error) {
    log.error('[METRICS] Tenant aggregation failed', { tenantId, message: error.message });
  } finally {
    await session.endSession();
  }
}

async function runDailyAggregationJob(dateInput = DateTime.utc().minus({ days: 1 }).toJSDate()) {
  await ensureSummaryIndexes();

  const tenants = await Firm.find({
    status: 'ACTIVE',
    bootstrapStatus: 'COMPLETED',
  }).select({ _id: 0, firmId: 1 }).lean();

  const BATCH_SIZE = 50;
  for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
    const batch = tenants.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((tenant) => runTenantAggregation(tenant.firmId, dateInput)));
  }
}

async function getLatestTenantMetrics(tenantId) {
  return TenantCaseMetricsDaily.findOne({ tenantId })
    .sort({ date: -1 })
    .select({
      _id: 0,
      tenantId: 1,
      date: 1,
      totalCases: 1,
      openCases: 1,
      pendedCases: 1,
      filedCases: 1,
      resolvedCases: 1,
      pendingApprovals: 1,
      overdueCases: 1,
      avgResolutionTimeSeconds: 1,
      casesCreatedToday: 1,
      casesResolvedToday: 1,
    })
    .lean();
}

async function getTenantMetricsByRange(tenantId, fromDateInput, toDateInput, options = {}) {
  const { allowLongRange = false } = options;
  const { start: fromDate } = getDateBoundsUtc(fromDateInput);
  const { start: toDate } = getDateBoundsUtc(toDateInput);

  const diff = DateTime.fromJSDate(toDate).diff(DateTime.fromJSDate(fromDate), 'days').days;
  if (diff < 0) {
    throw new Error('Invalid date range: fromDate must be before toDate');
  }

  if (!allowLongRange && diff > MAX_DASHBOARD_RANGE_DAYS) {
    throw new Error(`Date range exceeds ${MAX_DASHBOARD_RANGE_DAYS} days`);
  }

  await verifySummaryExplainUsesIndex(tenantId, fromDate, toDate);

  const rows = await TenantCaseMetricsDaily.find({
    tenantId,
    date: { $gte: fromDate, $lte: toDate },
  }).select({
    _id: 0,
    totalCases: 1,
    openCases: 1,
    pendedCases: 1,
    filedCases: 1,
    resolvedCases: 1,
    pendingApprovals: 1,
    overdueCases: 1,
    avgResolutionTimeSeconds: 1,
    casesCreatedToday: 1,
    casesResolvedToday: 1,
  }).lean();

  const aggregate = rows.reduce((acc, row) => {
    acc.totalCases += row.totalCases || 0;
    acc.openCases += row.openCases || 0;
    acc.pendedCases += row.pendedCases || 0;
    acc.filedCases += row.filedCases || 0;
    acc.resolvedCases += row.resolvedCases || 0;
    acc.pendingApprovals += row.pendingApprovals || 0;
    acc.overdueCases += row.overdueCases || 0;
    acc.avgResolutionTimeSeconds += row.avgResolutionTimeSeconds || 0;
    acc.casesCreatedToday += row.casesCreatedToday || 0;
    acc.casesResolvedToday += row.casesResolvedToday || 0;
    return acc;
  }, {
    totalCases: 0,
    openCases: 0,
    pendedCases: 0,
    filedCases: 0,
    resolvedCases: 0,
    pendingApprovals: 0,
    overdueCases: 0,
    avgResolutionTimeSeconds: 0,
    casesCreatedToday: 0,
    casesResolvedToday: 0,
  });

  const divisor = rows.length || 1;
  aggregate.avgResolutionTimeSeconds = aggregate.avgResolutionTimeSeconds / divisor;

  return {
    range: { fromDate, toDate, days: diff + 1 },
    rowsCount: rows.length,
    aggregate,
  };
}

module.exports = {
  MAX_DASHBOARD_RANGE_DAYS,
  ensureSummaryIndexes,
  runDailyAggregationJob,
  upsertTenantDailyMetrics,
  getLatestTenantMetrics,
  getTenantMetricsByRange,
};
