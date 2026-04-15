const log = require('../utils/log');

const workerModules = [
  { name: 'STORAGE_WORKER', path: '../workers/storage.worker' },
  { name: 'STORAGE_INTEGRITY_WORKER', path: '../workers/storageIntegrity.worker' },
  { name: 'TENANT_CASE_METRICS_WORKER', path: '../workers/tenantCaseMetrics.worker' },
  { name: 'EMAIL_WORKER', path: '../workers/email.worker' },
  { name: 'AUDIT_WORKER', path: '../workers/audit.worker' },
  { name: 'OUTBOX_WORKER', path: '../workers/outbox.worker' },
  { name: 'DOCUMENT_ANALYSIS_WORKER', path: '../workers/documentAnalysis.worker' },
  { name: 'SLA_CHECK_WORKER', path: '../workers/slaCheck.worker' },
  { name: 'NOTIFICATION_WORKER', path: '../workers/notification.worker' },
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
  workerModules.forEach(startWorkerModule);
};

const startBackgroundSchedules = () => {
  const { runStorageHealthCheck } = require('../jobs/storageHealthCheck.job');
  const { enqueueDailyStorageIntegrityJob } = require('../queues/storageIntegrity.queue');

  setInterval(() => {
    runStorageHealthCheck().catch((err) =>
      console.error('[storageHealthCheck] failed', { message: err.message })
    );
  }, 8 * 60 * 60 * 1000);

  enqueueDailyStorageIntegrityJob().catch((err) =>
    console.error('[storageIntegritySchedule] registration failed', { message: err.message })
  );
};

module.exports = {
  startBackgroundWorkers,
  startBackgroundSchedules,
};
