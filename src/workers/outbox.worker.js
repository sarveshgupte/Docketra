'use strict';

const { claimNextPending, markProcessed, markFailedAttempt } = require('../services/outbox.service');
const { sendEmailNow } = require('../services/email.service');
const { setWorkerStatus } = require('../services/workerRegistry.service');
const log = require('../utils/log');

const OUTBOX_POLL_MS = Number(process.env.OUTBOX_POLL_MS || 2000);
let pollTimer = null;
let busy = false;

const processOutboxEntry = async (entry) => {
  if (!entry) return false;

  if (entry.type === 'EMAIL') {
    const mailOptions = entry?.payload?.mailOptions || {};
    await sendEmailNow(mailOptions);
  } else if (entry.type === 'NOTIFICATION') {
    // Placeholder for notification transport integration.
    log.info('OUTBOX_NOTIFICATION_NOOP', { outboxId: entry._id?.toString?.() });
  } else {
    throw new Error(`Unsupported outbox type: ${entry.type}`);
  }

  await markProcessed(entry._id);
  log.info('OUTBOX_PROCESSED', {
    outboxId: entry._id?.toString?.(),
    type: entry.type,
    requestId: entry.requestId || null,
  });
  return true;
};

const pollOutbox = async () => {
  if (busy) return;
  busy = true;
  try {
    let hasWork = true;
    while (hasWork) {
      const entry = await claimNextPending();
      if (!entry) {
        hasWork = false;
        continue;
      }

      try {
        await processOutboxEntry(entry);
      } catch (error) {
        await markFailedAttempt(entry, error);
      }
    }
  } finally {
    busy = false;
  }
};

const startOutboxWorker = () => {
  setWorkerStatus('outbox', 'starting');
  pollTimer = setInterval(() => {
    pollOutbox().catch((error) => {
      log.error('OUTBOX_WORKER_POLL_ERROR', { error: error.message });
    });
  }, OUTBOX_POLL_MS);
  pollOutbox().catch(() => null);
  setWorkerStatus('outbox', 'running');
  return pollTimer;
};

startOutboxWorker();

module.exports = {
  startOutboxWorker,
};
