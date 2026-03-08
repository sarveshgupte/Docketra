/**
 * Execute a mutating handler inside a managed transaction session.
 * Owns the full MongoDB session lifecycle: start → withTransaction → end.
 * Never sends HTTP responses; returns handler result to the caller.
 */
const mongoose = require('mongoose');
const { runWithSession, runWithoutTransaction } = require('./transactionContext');
const { setSession } = require('./getSession');

class TransactionRollback extends Error {
  constructor(result) {
    super('Transaction rolled back due to non-success response');
    this.name = 'TransactionRollback';
    this.result = result;
  }
}

const resolveResponseStatus = (req, result) => {
  if (result && typeof result === 'object' && Number.isInteger(result.statusCode)) {
    return result.statusCode;
  }
  const response = req?._transactionResponse || req?.res;
  return Number.isInteger(response?.statusCode) ? response.statusCode : 200;
};

const executeWrite = async (req, handler) => {
  if (req?.skipTransaction) {
    req.transactionSkipped = true;
    req.transactionCommitted = false;
    setSession(req, null);
    return runWithoutTransaction(() => handler(null));
  }

  const routeLabel = `${req?.method || 'UNKNOWN'} ${req?.originalUrl || req?.url || 'unknown-route'}`;
  let session = null;
  let result;

  try {
    session = await mongoose.startSession();
  } catch (error) {
    console.warn(`[TXN] optional transaction unavailable for ${routeLabel}: ${error.message}`);
    req.transactionStartFailed = true;
  }

  if (!session) {
    req.transactionSkipped = true;
    req.transactionCommitted = false;
    setSession(req, null);
    return runWithoutTransaction(() => handler(null));
  }

  try {
    setSession(req, session);
    req.transactionSkipped = false;
    req.transactionCommitted = false;
    console.info(`[TXN] start ${routeLabel}`);
    await session.withTransaction(async () => {
      result = await runWithSession(session, async () => {
        const handlerResult = await handler(session);
        const statusCode = resolveResponseStatus(req, handlerResult);
        if (statusCode >= 400) {
          throw new TransactionRollback(handlerResult);
        }
        return handlerResult;
      });
    });

    req.transactionCommitted = true;
    console.info(`[TXN] commit ${routeLabel}`);
  } catch (error) {
    if (error instanceof TransactionRollback) {
      req.transactionCommitted = false;
      return error.result;
    }
    throw error;
  } finally {
    setSession(req, null);
    await session.endSession();
  }

  return result;
};

module.exports = { executeWrite };
