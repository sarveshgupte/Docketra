'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const logger = require('../utils/log');

const SUPPORTED_REPORT_TYPES = new Set(['WEEKLY_SLA_SUMMARY', 'CASE_METRICS']);

const redisUrl = process.env.REDIS_URL;
let reportGenerationWorker = null;

if (!redisUrl) {
  setWorkerStatus('reportGeneration', 'disabled');
} else {
  setWorkerStatus('reportGeneration', 'starting');
  reportGenerationWorker = new Worker(
    'reportGenerationQueue',
    async (job) => {
      if (job.name !== 'GENERATE_REPORT') {
        throw new UnrecoverableError(`Unknown report generation job type: ${job.name}`);
      }
      const { firmId, reportType, filters = {} } = job.data || {};
      if (!firmId) {
        throw new UnrecoverableError('GENERATE_REPORT job missing firmId');
      }
      if (!reportType) {
        throw new UnrecoverableError('GENERATE_REPORT job missing reportType');
      }
      if (!SUPPORTED_REPORT_TYPES.has(reportType)) {
        throw new UnrecoverableError(`Unsupported reportType: ${reportType}`);
      }

      let result;

      if (reportType === 'WEEKLY_SLA_SUMMARY') {
        const { getWeeklySlaSummary } = require('../services/sla.service');
        result = await getWeeklySlaSummary(firmId, filters);
      } else if (reportType === 'CASE_METRICS') {
        const { runDailyAggregationJob } = require('../services/tenantCaseMetrics.service');
        const dateInput = filters.date ? new Date(filters.date) : undefined;
        await runDailyAggregationJob(dateInput);
        result = { status: 'aggregated' };
      }

      logger.info('REPORT_GENERATION_COMPLETED', { firmId, reportType, result });
      return result;
    },
    { connection: { url: redisUrl } }
  );

  reportGenerationWorker.on('ready', () => setWorkerStatus('reportGeneration', 'running'));
  reportGenerationWorker.on('error', (err) => {
    logger.error('REPORT_GENERATION_WORKER_ERROR', { error: err.message });
    setWorkerStatus('reportGeneration', 'error');
  });
}

module.exports = reportGenerationWorker;
