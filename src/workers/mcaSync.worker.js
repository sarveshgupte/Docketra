'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const { processClientMcaSyncJob } = require('../jobs/mcaSync.job');
const CorporateMasterRecord = require('../models/CorporateMasterRecord.model');
const logger = require('../utils/log');

const redisUrl = process.env.REDIS_URL;
let mcaSyncWorker = null;

async function runScheduledMcaSweep() {
  try {
    logger.info('MCA_SCHEDULED_SWEEP_STARTED');
    // Find records that haven't been synced in over 7 days or are pending
    const thresholdDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleRecords = await CorporateMasterRecord.find({
      $or: [
        { lastSyncedAt: { $lt: thresholdDate } },
        { syncStatus: 'PENDING' },
      ],
    })
      .select('firmId clientId cinOrLlpin')
      .limit(50)
      .lean();

    logger.info('MCA_SCHEDULED_SWEEP_FOUND_RECORDS', { count: staleRecords.length });

    for (const record of staleRecords) {
      try {
        await processClientMcaSyncJob({
          firmId: record.firmId,
          clientId: record.clientId,
          cinOrLlpin: record.cinOrLlpin,
          actorXID: 'SYSTEM_MCA_SCHEDULE',
        });
      } catch (err) {
        logger.error('MCA_SWEEP_RECORD_FAILED', { cinOrLlpin: record.cinOrLlpin, error: err.message });
      }
    }

    logger.info('MCA_SCHEDULED_SWEEP_COMPLETED');
  } catch (error) {
    logger.error('MCA_SCHEDULED_SWEEP_ERROR', { error: error.message });
  }
}

if (!redisUrl) {
  setWorkerStatus('mcaSync', 'disabled');
} else {
  setWorkerStatus('mcaSync', 'starting');
  mcaSyncWorker = new Worker(
    'mcaSyncQueue',
    async (job) => {
      if (job.name === 'SYNC_CLIENT_MCA') {
        const payload = job.data || {};
        if (!payload.firmId || !payload.cinOrLlpin) {
          throw new UnrecoverableError('SYNC_CLIENT_MCA job missing required parameters: firmId, cinOrLlpin');
        }
        await processClientMcaSyncJob(payload);
        logger.info('SYNC_CLIENT_MCA_COMPLETED', { firmId: payload.firmId, cinOrLlpin: payload.cinOrLlpin });
      } else if (job.name === 'NIGHTLY_MCA_SWEEP') {
        await runScheduledMcaSweep();
      } else {
        throw new UnrecoverableError(`Unknown MCA sync job type: ${job.name}`);
      }
    },
    { connection: { url: redisUrl } }
  );

  mcaSyncWorker.on('ready', () => setWorkerStatus('mcaSync', 'running'));
  mcaSyncWorker.on('error', (err) => {
    logger.error('MCA_SYNC_WORKER_ERROR', { error: err.message });
    setWorkerStatus('mcaSync', 'error');
  });
}

module.exports = {
  worker: mcaSyncWorker,
  mcaSyncWorker,
  runScheduledMcaSweep,
};
