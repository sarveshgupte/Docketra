const log = require('../utils/log');

const DEFAULT_SLOW_MS = 700;

const requestTiming = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const threshold = Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10) || DEFAULT_SLOW_MS;

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (elapsedMs < threshold) return;

    log.warn('SLOW_REQUEST', {
      requestId: req.requestId || req.id || null,
      method: req.method,
      route: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Math.round(elapsedMs),
      userId: req.user?._id || req.user?.id || null,
      userXID: req.user?.xID || null,
      firmId: req.user?.firmId || null,
    });
  });

  next();
};

module.exports = requestTiming;
