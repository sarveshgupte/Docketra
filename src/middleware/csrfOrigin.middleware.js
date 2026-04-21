const { URL } = require('url');

const getSourceUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value);
  } catch (_error) {
    return null;
  }
};

const enforceSameOriginForCookieAuth = (req, res, next) => {
  const originUrl = getSourceUrl(req.headers.origin);
  const refererUrl = getSourceUrl(req.headers.referer);
  const requestHost = req.headers.host;

  if (!originUrl && !refererUrl) {
    return next();
  }
  if (!requestHost) {
    return res.status(403).json({
      success: false,
      message: 'Invalid request origin',
    });
  }

  const candidateHost = originUrl?.host || refererUrl?.host || null;
  if (candidateHost && candidateHost === requestHost) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Invalid request origin',
  });
};

module.exports = {
  enforceSameOriginForCookieAuth,
};
