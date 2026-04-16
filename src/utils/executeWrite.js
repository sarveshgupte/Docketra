/**
 * Execute a mutating handler inside a managed transaction session.
 * Owns the full MongoDB session lifecycle: start → withTransaction → end.
 * Never sends HTTP responses; returns handler result to the caller.
 */
const mongoose = require('mongoose');
const { runWithSession, runWithoutTransaction } = require('./transactionContext');
const { setSession } = require('./getSession');
const log = require('../utils/log');

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
  // Wrapped controllers either return an explicit { statusCode, ...payload }
  // object or set the Express response status before the handler resolves.
  // We inspect the live response as a legacy fallback for handlers that still
  // write directly to res without returning a status-bearing payload.
  const response = req?._transactionResponse || req?.res;
  return Number.isInteger(response?.statusCode) ? response.statusCode : 200;
};

const executeWrite = async (req, handler) => {
  req.transactionState = 'not_started';
  if (req?.skipTransaction) {
    req.transactionSkipped = true;
    req.transactionCommitted = false;
    req.transactionState = 'skipped';
    setSession(req, null);
    return runWithoutTransaction(() => handler(null));
  }

  const routeLabel = `${req?.method || 'UNKNOWN'} ${req?.originalUrl || req?.url || 'unknown-route'}`;
  let session = null;
  let result;

  try {
    session = await mongoose.startSession();
  } catch (error) {
    log.warn(`[TXN] optional transaction unavailable for ${routeLabel}: ${error.message}`);
    req.transactionStartFailed = true;
    req.transactionState = 'start_failed';
  }

  if (!session) {
    req.transactionSkipped = true;
    req.transactionCommitted = false;
    if (req.transactionState !== 'start_failed') {
      req.transactionState = 'skipped';
    }
    setSession(req, null);
    return runWithoutTransaction(() => handler(null));
  }

  let finalizeTransaction;
  req.transactionFinalized = new Promise((resolve) => {
    finalizeTransaction = resolve;
  });

  try {
    setSession(req, session);
    req.transactionSkipped = false;
    req.transactionCommitted = false;
    req.transactionState = 'started';
    log.info(`[TXN] start ${routeLabel}`);
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
    req.transactionState = 'committed';
    log.info(`[TXN] commit ${routeLabel}`);
  } catch (error) {
    req.transactionState = 'rolled_back';
    if (error instanceof TransactionRollback) {
      req.transactionCommitted = false;
      return error.result;
    }
    throw error;
  } finally {
    setSession(req, null);
    await session.endSession();
    finalizeTransaction();
  }

  return result;
};

module.exports = { executeWrite };
