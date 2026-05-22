const turnstileService = require('../services/turnstile.service');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('../services/securityAudit.service');

const GENERIC_TURNSTILE_FAILURE_MESSAGE = 'We could not verify this signup attempt. Please try again.';

const requireTurnstileForSignup = async (req, res, next) => {
  if (!turnstileService.isTurnstileEnabled()) return next();

  const token = turnstileService.extractTurnstileToken(req.body);
  if (!token) {
    await logSecurityAuditEvent({
      req,
      action: SECURITY_AUDIT_ACTIONS.SIGNUP_TURNSTILE_MISSING,
      resource: 'auth/signup/init',
      metadata: { turnstileEnabled: true },
      description: 'Signup Turnstile token missing',
    });
    return res.status(400).json({ success: false, message: GENERIC_TURNSTILE_FAILURE_MESSAGE });
  }

  const remoteIp = req.ip || req.headers['x-forwarded-for'];
  const verification = await turnstileService.verifyTurnstileToken({ token, remoteIp });
  if (!verification.success) {
    await logSecurityAuditEvent({
      req,
      action: SECURITY_AUDIT_ACTIONS.SIGNUP_TURNSTILE_FAILED,
      resource: 'auth/signup/init',
      metadata: { turnstileEnabled: true, turnstileResult: 'failed' },
      description: 'Signup Turnstile verification failed',
    });
    return res.status(403).json({ success: false, message: GENERIC_TURNSTILE_FAILURE_MESSAGE });
  }

  await logSecurityAuditEvent({
    req,
    action: SECURITY_AUDIT_ACTIONS.SIGNUP_TURNSTILE_PASSED,
    resource: 'auth/signup/init',
    metadata: { turnstileEnabled: true, turnstileResult: 'passed' },
    description: 'Signup Turnstile verification passed',
  });
  return next();
};

module.exports = {
  GENERIC_TURNSTILE_FAILURE_MESSAGE,
  requireTurnstileForSignup,
};
