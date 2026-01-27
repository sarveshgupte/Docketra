const optionsPreflight = (allowedOrigins = [], allowedHeaders = [], allowedMethods = []) => {
  const originAllowlist = new Set(allowedOrigins.filter(Boolean));
  if (originAllowlist.size === 0) {
    console.warn('[CORS] OPTIONS preflight allowlist is empty; preflight responses will omit Access-Control-Allow-Origin.');
  }
  const headerList = allowedHeaders.length > 0
    ? allowedHeaders.join(', ')
    : 'Content-Type, Authorization, X-Requested-With, Idempotency-Key';
  const methodList = allowedMethods.length > 0
    ? allowedMethods.join(', ')
    : 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      const allowOrigin = origin && originAllowlist.has(origin);
      if (allowOrigin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
      }
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header(
        'Access-Control-Allow-Headers',
        headerList
      );
      res.header(
        'Access-Control-Allow-Methods',
        methodList
      );
      return res.sendStatus(204);
    }
    return next();
  };
};

module.exports = optionsPreflight;
