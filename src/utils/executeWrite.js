/**
 * Execute a mutating handler inside a managed transaction session.
 * Owns the full MongoDB session lifecycle: start → withTransaction → end.
 * Never sends HTTP responses; returns handler result to the caller.
 */
const mongoose = require('mongoose');
const { runWithSession, runWithoutTransaction } = require('./transactionContext');

const executeWrite = async (req, handler) => {
  if (req?.skipTransaction) {
    req.transactionSkipped = true;
    return runWithoutTransaction(() => handler(null));
  }

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await runWithSession(session, () => handler(session));
    });

    req.transactionCommitted = true;
  } finally {
    await session.endSession();
  }

  return result;
};

module.exports = { executeWrite };
