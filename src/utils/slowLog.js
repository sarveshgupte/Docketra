const log = require('./log');

const toPathWithoutQuery = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value.split('?')[0] || null;
};

const logSlowEndpoint = ({
  marker,
  thresholdMs,
  durationMs,
  req = null,
  method = null,
  route = null,
  firmId = null,
  userXID = null,
  queryCategoryFlags = {},
  pagination = {},
  extra = {},
}) => {
  if (!Number.isFinite(durationMs) || durationMs < thresholdMs) return;

  log.warn(marker, {
    req,
    marker,
    diagnosticType: 'SLOW_ENDPOINT',
    durationMs: Math.round(durationMs),
    thresholdMs,
    method: method || req?.method || null,
    route: toPathWithoutQuery(route || req?.originalUrl || req?.url),
    requestId: req?.requestId || null,
    correlationId: req?.correlationId || null,
    firmId: firmId || req?.firmId || req?.firm?.id || req?.user?.firmId || null,
    userXID: userXID || req?.user?.xID || null,
    queryCategoryFlags,
    pagination,
    ...extra,
  });
};

module.exports = {
  logSlowEndpoint,
};
