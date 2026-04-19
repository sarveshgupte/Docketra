const log = require('../utils/log');

const isEnabled = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const isProduction = process.env.NODE_ENV === 'production';
const workerIntervalSchedulersEnabled = isEnabled(
  process.env.ENABLE_WORKER_INTERVAL_SCHEDULERS,
  !isProduction
);

const workerModules = [
  { name: 'STORAGE_WORKER', path: '../workers/storage.worker' },
  { name: 'STORAGE_INTEGRITY_WORKER', path: '../workers/storageIntegrity.worker' },
  { name: 'TENANT_CASE_METRICS_WORKER', path: '../workers/tenantCaseMetrics.worker', intervalScheduler: true },
  { name: 'EMAIL_WORKER', path: '../workers/email.worker' },
  { name: 'AUDIT_WORKER', path: '../workers/audit.worker' },
  { name: 'NOTIFICATION_WORKER', path: '../workers/notification.worker' },
  { name: 'SLA_WORKER', path: '../workers/sla.worker' },
  { name: 'BULK_UPLOAD_WORKER', path: '../workers/bulkUpload.worker' },
  { name: 'OUTBOX_WORKER', path: '../workers/outbox.worker' },
  { name: 'DOCUMENT_ANALYSIS_WORKER', path: '../workers/documentAnalysis.worker' },
  { name: 'SLA_CHECK_WORKER', path: '../workers/slaCheck.worker' },
  { name: 'REPORT_GENERATION_WORKER', path: '../workers/reportGeneration.worker' },
  { name: 'BULK_PROCESS_WORKER', path: '../workers/bulkProcess.worker' },
];

const startWorkerModule = ({ name, path }) => {
  try {
    require(path);
    log.info(`${name}_STARTED`);
  } catch (err) {
    log.warn(`${name}_START_FAILED`, { error: err.message });
  }
};

const startBackgroundWorkers = () => {
  workerModules.forEach((moduleConfig) => {
    if (moduleConfig.intervalScheduler && !workerIntervalSchedulersEnabled) {
      log.info(`${moduleConfig.name}_SKIPPED`, { reason: 'ENABLE_WORKER_INTERVAL_SCHEDULERS=false' });
      return;
    }
    startWorkerModule(moduleConfig);
  });
};

const startBackgroundSchedules = () => {
  const { enqueueDailyStorageIntegrityJob } = require('../queues/storageIntegrity.queue');
  enqueueDailyStorageIntegrityJob().catch((err) =>
    log.error('[storageIntegritySchedule] registration failed', { message: err.message })
  );

  if (!workerIntervalSchedulersEnabled) {
    log.info('WORKER_INTERVAL_SCHEDULERS_DISABLED');
    return;
  }

  const { runStorageHealthCheck } = require('../jobs/storageHealthCheck.job');
  const { cleanupStaleTmpUploads } = require('../utils/cleanupTmpUploads');
  const { storageBackupService } = require('./storageBackup.service');

  setInterval(() => {
    runStorageHealthCheck().catch((err) =>
      log.error('[storageHealthCheck] failed', { message: err.message })
    );
  }, 8 * 60 * 60 * 1000);
  setInterval(() => {
    cleanupStaleTmpUploads().catch((err) =>
      log.error('[cleanupTmpUploads] failed', { message: err.message })
    );
  }, 6 * 60 * 60 * 1000);

  storageBackupService.scheduleNightlyBackups();
};

module.exports = {
  startBackgroundWorkers,
  startBackgroundSchedules,
  workerIntervalSchedulersEnabled,
};
