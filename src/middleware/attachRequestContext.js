const buildRequestContext = (req) => ({
  firmId: req.user?.firmId || null,
  userId: req.user?._id || null,
  userXID: req.user?.xID || req.user?.xid || null,
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
