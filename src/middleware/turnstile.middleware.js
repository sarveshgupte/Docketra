const turnstileService = require('../services/turnstile.service');

const GENERIC_TURNSTILE_FAILURE_MESSAGE = 'We could not verify this signup attempt. Please try again.';

const requireTurnstileForSignup = async (req, res, next) => {
  if (!turnstileService.isTurnstileEnabled()) return next();

  const token = turnstileService.extractTurnstileToken(req.body);
  if (!token) {
    return res.status(400).json({ success: false, message: GENERIC_TURNSTILE_FAILURE_MESSAGE });
  }

  const remoteIp = req.ip || req.headers['x-forwarded-for'];
  const verification = await turnstileService.verifyTurnstileToken({ token, remoteIp });
  if (!verification.success) {
    return res.status(403).json({ success: false, message: GENERIC_TURNSTILE_FAILURE_MESSAGE });
  }

  return next();
};

module.exports = {
  GENERIC_TURNSTILE_FAILURE_MESSAGE,
  requireTurnstileForSignup,
};
