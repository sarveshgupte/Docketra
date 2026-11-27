const log = require('../utils/log');

const normalizeEmail = (val) => String(val || '').trim().toLowerCase();

/**
 * Cloudflare Zero Trust Access & Origin Cloaking Guard
 *
 * Verifies requests entering privileged administration endpoints behind Cloudflare Access.
 * - When CLOUDFLARE_ACCESS_ENABLED is false (default in local/dev/tests), passes through immediately.
 * - When CLOUDFLARE_ACCESS_ENABLED is true:
 *   - Extracts Cloudflare identity headers:
 *     - cf-access-authenticated-user-email (user's verified identity)
 *     - cf-access-jwt-assertion (signed identity token from Cloudflare)
 *     - cf-ipcountry (connecting geo origin)
 *   - If CLOUDFLARE_ACCESS_REQUIRED is true and email header is missing, rejects 403 fail-closed.
 *   - If CLOUDFLARE_ACCESS_ALLOWED_EMAILS is set, enforces that authenticated user email is authorized.
 *   - Attaches req.cfAccess = { email, assertion, country } for audit/downstream handlers.
 */
const cloudflareAccessGuard = (req, res, next) => {
  const isEnabled = String(process.env.CLOUDFLARE_ACCESS_ENABLED || '').trim().toLowerCase() === 'true';
  if (!isEnabled) {
    return next();
  }

  const rawEmail = req.headers?.['cf-access-authenticated-user-email'];
  const userEmail = normalizeEmail(rawEmail);
  const jwtAssertion = req.headers?.['cf-access-jwt-assertion'] || null;
  const country = req.headers?.['cf-ipcountry'] || null;

  const isRequired = String(process.env.CLOUDFLARE_ACCESS_REQUIRED || '').trim().toLowerCase() === 'true';
  if (isRequired && !userEmail) {
    log.warn('CLOUDFLARE_ACCESS_MISSING_HEADER', {
      requestId: req.requestId,
      ip: req.ip,
      route: req.originalUrl || req.url,
    });
    return res.status(403).json({
      success: false,
      code: 'CLOUDFLARE_ACCESS_REQUIRED',
      message: 'Cloudflare Zero Trust Access authentication is required for this endpoint.',
    });
  }

  if (userEmail) {
    const rawAllowed = String(process.env.CLOUDFLARE_ACCESS_ALLOWED_EMAILS || '').trim();
    if (rawAllowed) {
      const allowedEmails = rawAllowed
        .split(',')
        .map((e) => normalizeEmail(e))
        .filter(Boolean);

      if (allowedEmails.length > 0 && !allowedEmails.includes(userEmail)) {
        log.warn('CLOUDFLARE_ACCESS_UNAUTHORIZED_IDENTITY', {
          requestId: req.requestId,
          email: userEmail,
          route: req.originalUrl || req.url,
        });
        return res.status(403).json({
          success: false,
          code: 'CLOUDFLARE_ACCESS_FORBIDDEN',
          message: 'Your Cloudflare Zero Trust identity is not authorized for this endpoint.',
        });
      }
    }

    req.cfAccess = {
      email: userEmail,
      assertion: jwtAssertion,
      country,
    };
  }

  next();
};

module.exports = {
  cloudflareAccessGuard,
  normalizeEmail,
};
