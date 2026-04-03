const Outbox = require('../models/Outbox.model');
const log = require('../utils/log');

const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 8);
const BASE_BACKOFF_MS = Number(process.env.OUTBOX_BACKOFF_MS || 2000);

const buildBackoffDate = (attempts) => {
  const exponent = Math.max(0, attempts - 1);
  const delayMs = BASE_BACKOFF_MS * (2 ** exponent);
  return new Date(Date.now() + Math.min(delayMs, 15 * 60 * 1000));
};

const enqueueOutbox = async ({ type, payload, requestId = null, session = null }) => {
  const [entry] = await Outbox.create([
    {
      type,
      payload,
      requestId,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
    },
  ], session ? { session } : undefined);

  log.info('OUTBOX_ENQUEUED', {
    outboxId: entry._id?.toString?.(),
    type: entry.type,
    requestId,
  });

  return entry;
};

const claimNextPending = async () => Outbox.findOneAndUpdate(
  {
    status: 'pending',
    nextAttemptAt: { $lte: new Date() },
  },
  {
    $set: { status: 'processing' },
  },
  {
    sort: { createdAt: 1 },
    new: true,
  },
).lean();

const markProcessed = async (entryId) => {
  await Outbox.updateOne(
    { _id: entryId, status: 'processing' },
    {
      $set: {
        status: 'processed',
        processedAt: new Date(),
        errorMessage: null,
      },
    },
  );
};

const markFailedAttempt = async (entry, error) => {
  const attempts = Number(entry?.attempts || 0) + 1;
  const exceeded = attempts >= MAX_ATTEMPTS;
  const nextAttemptAt = buildBackoffDate(attempts);

  await Outbox.updateOne(
    { _id: entry._id, status: 'processing' },
    {
      $set: {
        status: exceeded ? 'failed' : 'pending',
        errorMessage: error?.message || String(error),
        processedAt: exceeded ? new Date() : null,
        nextAttemptAt,
      },
      $inc: {
        attempts: 1,
      },
    },
  );

  log.warn('OUTBOX_FAILED', {
    outboxId: entry._id?.toString?.(),
    type: entry.type,
    attempts,
    willRetry: !exceeded,
    error: error?.message || String(error),
  });
};

module.exports = {
  enqueueOutbox,
  claimNextPending,
  markProcessed,
  markFailedAttempt,
};
