function parseCookieHeader(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};

  return cookieHeader.split(';').reduce((acc, entry) => {
    const [rawName, ...rawValueParts] = entry.split('=');
    const name = String(rawName || '').trim();
    if (!name) return acc;

    const rawValue = rawValueParts.join('=');
    try {
      acc[name] = decodeURIComponent(String(rawValue || '').trim());
    } catch {
      acc[name] = String(rawValue || '').trim();
    }
    return acc;
  }, {});
}

module.exports = function cookieParserMiddleware() {
  return (req, _res, next) => {
    if (!req.cookies || typeof req.cookies !== 'object') {
      req.cookies = parseCookieHeader(req.headers?.cookie);
    }
    next();
  };
};
