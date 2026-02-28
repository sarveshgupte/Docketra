'use strict';

const { DateTime } = require('luxon');
const { runDailyAggregationJob } = require('../services/tenantCaseMetrics.service');

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_HOUR = 0;
const SCHEDULE_MINUTE = 30;

const getMsUntilNextRun = () => {
  const now = DateTime.local();
  let next = now.set({ hour: SCHEDULE_HOUR, minute: SCHEDULE_MINUTE, second: 0, millisecond: 0 });
  if (next <= now) {
    next = next.plus({ days: 1 });
  }
  return next.diff(now).as('milliseconds');
};

const runSafely = async () => {
  try {
    await runDailyAggregationJob();
    console.log('[TenantCaseMetricsWorker] Daily summary aggregation completed');
  } catch (error) {
    console.error('[TenantCaseMetricsWorker] Aggregation run failed (non-fatal)', {
      message: error.message,
    });
  }
};

const startWorker = () => {
  const initialDelay = getMsUntilNextRun();
  setTimeout(() => {
    runSafely();
    setInterval(runSafely, DAILY_INTERVAL_MS);
  }, initialDelay);
};

startWorker();

module.exports = {
  startWorker,
};
