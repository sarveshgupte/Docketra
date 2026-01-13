const mongoose = require('mongoose');

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const transactionMiddleware = async (req, res, next) => {
  if (!mutatingMethods.has(req.method)) {
    return next();
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    console.warn('[transactionMiddleware] Unable to start MongoDB session:', err.message);
    session = null;
    req.transactionStartFailed = true;
  }

  const transactionSession = session
    ? {
        session,
        withTransaction: (fn) => session.withTransaction(fn),
        endSession: () => session.endSession(),
      }
    : {
        session: null,
        withTransaction: async (fn) => fn(),
        endSession: () => {},
      };

  req.mongoSession = session;
  req.transactionSession = transactionSession;
  req.transactionActive = true;

  const cleanup = () => transactionSession.endSession();
  res.on('finish', cleanup);
  res.on('close', cleanup);

  return next();
};

module.exports = transactionMiddleware;
