const mongoose = require('mongoose');
const { recordTransactionFailure } = require('../services/transactionMonitor.service');
const { setSession } = require('../utils/getSession');
const log = require('../utils/log');

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const transactionMiddleware = async (req, res, next) => {
  req.transactionCommitted = false;
  if (req?.skipTransaction) {
    setSession(req, null);
    return next();
  }
  if (!mutatingMethods.has(req.method) && !req.forceTransaction) {
    setSession(req, null);
    return next();
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    log.warn('[transactionMiddleware] Unable to start MongoDB session:', err.message);
    recordTransactionFailure('start');
    session = null;
    req.transactionStartFailed = true;
  }
  if (!session) {
    recordTransactionFailure('unavailable');
    setSession(req, null);
    req.transactionActive = false;
    return next();
  }

  setSession(req, session);

  return next();
};

module.exports = transactionMiddleware;
