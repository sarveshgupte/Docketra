const log = require('./src/utils/log');

const workerModules = [
  './src/workers/bulkUpload.worker.js',
  './src/workers/audit.worker.js',
  './src/workers/email.worker.js',
  './src/workers/notification.worker.js',
  './src/workers/sla.worker.js',
  './src/workers/outbox.worker.js',
  './src/workers/storage.worker.js',
  './src/workers/storageIntegrity.worker.js',
  './src/workers/tenantCaseMetrics.worker.js',
  './src/workers/slaCheck.worker.js',
  './src/workers/reportGeneration.worker.js',
  './src/workers/bulkProcess.worker.js',
];

workerModules.forEach((workerModulePath) => require(workerModulePath));

log.info('WORKER_REGISTRATION_SUCCESS', {
  workerCount: workerModules.length,
  workers: workerModules.map((modulePath) => modulePath.split('/').pop()),
});
