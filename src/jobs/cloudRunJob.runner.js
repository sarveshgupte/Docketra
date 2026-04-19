require('dotenv').config();

const log = require('../utils/log');
const connectDB = require('../config/database');
const { validateEnv } = require('../config/validateEnv');
const { logBuildMetadata } = require('../services/buildInfo.service');
const { runStorageHealthCheck } = require('./storageHealthCheck.job');
const { cleanupStaleTmpUploads } = require('../utils/cleanupTmpUploads');
const { runAutoReopenJob } = require('../services/autoReopenScheduler.service');
const { runDailyAggregationJob } = require('../services/tenantCaseMetrics.service');
const { storageBackupService } = require('../services/storageBackup.service');

const isEnabled = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const JOBS = {
  storage_health_check: runStorageHealthCheck,
  cleanup_tmp_uploads: cleanupStaleTmpUploads,
  auto_reopen_pending_dockets: runAutoReopenJob,
  tenant_case_metrics_daily: runDailyAggregationJob,
  nightly_storage_backups: () => storageBackupService.runNightlyBackupsOnce(),
};

async function main() {
  const cloudRunJobEntrypointsEnabled = isEnabled(
    process.env.ENABLE_CLOUD_RUN_JOB_ENTRYPOINTS,
    true
  );
  if (!cloudRunJobEntrypointsEnabled) {
    throw new Error('Cloud Run job entrypoints are disabled (ENABLE_CLOUD_RUN_JOB_ENTRYPOINTS=false)');
  }

  const jobName = String(process.env.CLOUD_RUN_JOB_NAME || process.argv[2] || '').trim();
  const job = JOBS[jobName];

  if (!job) {
    const supportedJobs = Object.keys(JOBS).join(', ');
    throw new Error(`Unknown or missing CLOUD_RUN_JOB_NAME. Supported values: ${supportedJobs}`);
  }

  validateEnv();
  logBuildMetadata();
  await connectDB();

  log.info('CLOUD_RUN_JOB_START', { jobName });
  const startedAt = Date.now();
  await job();
  log.info('CLOUD_RUN_JOB_DONE', { jobName, durationMs: Date.now() - startedAt });
}

main().catch((error) => {
  log.error('CLOUD_RUN_JOB_FAILED', {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
