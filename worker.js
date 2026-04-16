require('./src/workers/bulkUpload.worker.js');
require('./src/workers/audit.worker.js');
require('./src/workers/email.worker.js');
require('./src/workers/notification.worker.js');
require('./src/workers/sla.worker.js');
require('./src/workers/outbox.worker.js');
require('./src/workers/storage.worker.js');
require('./src/workers/storageIntegrity.worker.js');
require('./src/workers/tenantCaseMetrics.worker.js');
require('./src/workers/slaCheck.worker.js');
require('./src/workers/reportGeneration.worker.js');
require('./src/workers/bulkProcess.worker.js');

console.info(
  '[worker] Registered workers:',
  [
    'bulkUpload.worker.js',
    'audit.worker.js',
    'email.worker.js',
    'notification.worker.js',
    'sla.worker.js',
    'outbox.worker.js',
    'storage.worker.js',
    'storageIntegrity.worker.js',
    'tenantCaseMetrics.worker.js',
    'slaCheck.worker.js',
    'reportGeneration.worker.js',
    'bulkProcess.worker.js',
  ].join(', ')
);
