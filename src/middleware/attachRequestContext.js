const { getSession } = require('../utils/getSession');

const buildRequestContext = (req) => ({
  tenantId: req.context?.tenantId || req.context?.firmId || req.firmId || req.user?.firmId || null,
  firmId: req.context?.firmId || req.firmId || req.user?.firmId || null,
  userId: req.user?._id || req.user?.id || null,
  userXID: req.user?.xID || req.user?.xid || null,
  dbSession: getSession(req),
  route: req.originalUrl || req.url || null,
  requestId: req.requestId || null,
});

const attachRequestContext = (req, res, next) => {
  req.context = {
    ...(req.context || {}),
    ...buildRequestContext(req),
  };
  next();
};

module.exports = {
  attachRequestContext,
  buildRequestContext,
};
