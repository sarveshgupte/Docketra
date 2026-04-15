'use strict';

const { Worker, UnrecoverableError } = require('bullmq');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const logger = require('../utils/log');

const SUPPORTED_BULK_TYPES = new Set(['BULK_STATUS_UPDATE', 'BULK_ASSIGNMENT']);

const redisUrl = process.env.REDIS_URL;
let bulkProcessWorker = null;

if (!redisUrl) {
  setWorkerStatus('bulkProcess', 'disabled');
} else {
  setWorkerStatus('bulkProcess', 'starting');
  bulkProcessWorker = new Worker(
    'bulkProcessQueue',
    async (job) => {
      if (job.name !== 'BULK_PROCESS') {
        throw new UnrecoverableError(`Unknown bulk process job type: ${job.name}`);
      }
      const { firmId, type, items, userId, options = {} } = job.data || {};
      if (!firmId) {
        throw new UnrecoverableError('BULK_PROCESS job missing firmId');
      }
      if (!type) {
        throw new UnrecoverableError('BULK_PROCESS job missing type');
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new UnrecoverableError('BULK_PROCESS job missing or empty items array');
      }
      if (!SUPPORTED_BULK_TYPES.has(type)) {
        throw new UnrecoverableError(`Unsupported bulk process type: ${type}`);
      }

      const Case = require('../models/Case.model');
      let processedCount = 0;

      if (type === 'BULK_STATUS_UPDATE') {
        const { status } = options;
        if (!status) {
          throw new UnrecoverableError('BULK_STATUS_UPDATE requires options.status');
        }
        const result = await Case.updateMany(
          { firmId, caseId: { $in: items } },
          { $set: { status, updatedAt: new Date() } }
        );
        processedCount = result.modifiedCount;
      } else if (type === 'BULK_ASSIGNMENT') {
        const { assignedToXID } = options;
        if (!assignedToXID) {
          throw new UnrecoverableError('BULK_ASSIGNMENT requires options.assignedToXID');
        }
        const result = await Case.updateMany(
          { firmId, caseId: { $in: items } },
          { $set: { assignedToXID, updatedAt: new Date() } }
        );
        processedCount = result.modifiedCount;
      }

      logger.info('BULK_PROCESS_COMPLETED', { firmId, type, itemCount: items.length, processedCount, userId });
      return { processedCount };
    },
    {
      connection: { url: redisUrl },
      concurrency: 2,
    }
  );

  bulkProcessWorker.on('ready', () => setWorkerStatus('bulkProcess', 'running'));
  bulkProcessWorker.on('error', (err) => {
    logger.error('BULK_PROCESS_WORKER_ERROR', { error: err.message });
    setWorkerStatus('bulkProcess', 'error');
  });
}

module.exports = bulkProcessWorker;
