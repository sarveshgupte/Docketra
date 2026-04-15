'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const logger = require('../utils/log');

const ACTIVE_DOCKET_STATUSES = ['OPEN', 'IN_PROGRESS'];

const redisUrl = process.env.REDIS_URL;
let slaCheckWorker = null;

if (!redisUrl) {
  setWorkerStatus('slaCheck', 'disabled');
} else {
  setWorkerStatus('slaCheck', 'starting');
  slaCheckWorker = new Worker(
    'slaCheckQueue',
    async (job) => {
      if (job.name !== 'SLA_CHECK') {
        throw new UnrecoverableError(`Unknown SLA check job type: ${job.name}`);
      }
      const { firmId } = job.data || {};
      if (!firmId) {
        throw new UnrecoverableError('SLA_CHECK job missing firmId');
      }

      const Case = require('../models/Case.model');
      const { syncSlaBreachNotifications } = require('../services/sla.service');

      const now = new Date();
      const overdueDockets = await Case.find({
        firmId,
        status: { $in: ACTIVE_DOCKET_STATUSES },
        $or: [{ slaDueAt: { $lt: now } }, { dueDate: { $lt: now } }],
      })
        .select('caseNumber caseId title assignedToXID createdByXID slaDueAt dueDate status')
        .lean();

      if (overdueDockets.length > 0) {
        await syncSlaBreachNotifications(overdueDockets, { firmId, now });
      }

      logger.info('SLA_CHECK_COMPLETED', { firmId, breachedCount: overdueDockets.length });
    },
    { connection: { url: redisUrl } }
  );

  slaCheckWorker.on('ready', () => setWorkerStatus('slaCheck', 'running'));
  slaCheckWorker.on('error', (err) => {
    logger.error('SLA_CHECK_WORKER_ERROR', { error: err.message });
    setWorkerStatus('slaCheck', 'error');
  });
}

module.exports = slaCheckWorker;
