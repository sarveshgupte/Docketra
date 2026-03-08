const getSession = (req) => req?.context?.dbSession || req?.transactionSession?.session || req?.mongoSession || undefined;

const setSession = (req, session) => {
  if (!req) return;
  req.context = {
    ...(req.context || {}),
    dbSession: session || undefined,
  };
  req.mongoSession = session || undefined;
  if (session) {
    req.transactionSession = { session };
    req.transactionActive = true;
    return;
  }
  delete req.transactionSession;
  delete req.mongoSession;
  req.transactionActive = false;
};

module.exports = {
  getSession,
  setSession,
};
