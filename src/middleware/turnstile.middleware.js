const turnstileService = require('../services/turnstile.service');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('../services/securityAudit.service');

const GENERIC_TURNSTILE_FAILURE_MESSAGE = 'We could not verify this request. Please try again.';

const createTurnstileMiddleware = ({
  missingAction,
  failedAction,
  passedAction,
  resource,
  missingDescription,
  failedDescription,
  passedDescription,
  skip = null,
}) => async (req, res, next) => {
  if (!turnstileService.isTurnstileEnabled()) return next();
  if (typeof skip === 'function' && skip(req)) return next();

  const token = turnstileService.extractTurnstileToken(req.body);
  if (!token) {
    await logSecurityAuditEvent({
      req,
      action: missingAction,
      resource,
      metadata: { turnstileEnabled: true },
      description: missingDescription,
    });
    return res.status(400).json({ success: false, message: GENERIC_TURNSTILE_FAILURE_MESSAGE });
  }

  const remoteIp = req.ip || req.headers['x-forwarded-for'];
  const verification = await turnstileService.verifyTurnstileToken({ token, remoteIp });
  if (!verification.success) {
    await logSecurityAuditEvent({
      req,
      action: failedAction,
      resource,
      metadata: { turnstileEnabled: true, turnstileResult: 'failed' },
      description: failedDescription,
    });
    return res.status(403).json({ success: false, message: GENERIC_TURNSTILE_FAILURE_MESSAGE });
  }

  await logSecurityAuditEvent({
    req,
    action: passedAction,
    resource,
    metadata: { turnstileEnabled: true, turnstileResult: 'passed' },
    description: passedDescription,
  });
  return next();
};

const requireTurnstileForSignup = createTurnstileMiddleware({
  missingAction: SECURITY_AUDIT_ACTIONS.SIGNUP_TURNSTILE_MISSING,
  failedAction: SECURITY_AUDIT_ACTIONS.SIGNUP_TURNSTILE_FAILED,
  passedAction: SECURITY_AUDIT_ACTIONS.SIGNUP_TURNSTILE_PASSED,
  resource: 'auth/signup/init',
  missingDescription: 'Signup Turnstile token missing',
  failedDescription: 'Signup Turnstile verification failed',
  passedDescription: 'Signup Turnstile verification passed',
});

const requireTurnstileForForgotPassword = createTurnstileMiddleware({
  missingAction: SECURITY_AUDIT_ACTIONS.FORGOT_PASSWORD_TURNSTILE_MISSING,
  failedAction: SECURITY_AUDIT_ACTIONS.FORGOT_PASSWORD_TURNSTILE_FAILED,
  passedAction: SECURITY_AUDIT_ACTIONS.FORGOT_PASSWORD_TURNSTILE_PASSED,
  resource: 'auth/forgot-password/init',
  missingDescription: 'Forgot-password init Turnstile token missing',
  failedDescription: 'Forgot-password init Turnstile verification failed',
  passedDescription: 'Forgot-password init Turnstile verification passed',
});

const requireTurnstileForUpload = createTurnstileMiddleware({
  missingAction: SECURITY_AUDIT_ACTIONS.UPLOAD_TURNSTILE_MISSING,
  failedAction: SECURITY_AUDIT_ACTIONS.UPLOAD_TURNSTILE_FAILED,
  passedAction: SECURITY_AUDIT_ACTIONS.UPLOAD_TURNSTILE_PASSED,
  resource: 'public/upload',
  missingDescription: 'Upload Turnstile token missing',
  failedDescription: 'Upload Turnstile verification failed',
  passedDescription: 'Upload Turnstile verification passed',
});

const requireTurnstileForLoginVerify = createTurnstileMiddleware({
  missingAction: SECURITY_AUDIT_ACTIONS.LOGIN_VERIFY_TURNSTILE_MISSING,
  failedAction: SECURITY_AUDIT_ACTIONS.LOGIN_VERIFY_TURNSTILE_FAILED,
  passedAction: SECURITY_AUDIT_ACTIONS.LOGIN_VERIFY_TURNSTILE_PASSED,
  resource: 'auth/login/verify',
  missingDescription: 'Login verify Turnstile token missing',
  failedDescription: 'Login verify Turnstile verification failed',
  passedDescription: 'Login verify Turnstile verification passed',
});

const isEmbeddedPublicFormSubmission = (req) => (
  req?.query?.embed === 'true' || req?.body?.submissionMode === 'embedded_form'
);

const requireTurnstileForPublicForm = createTurnstileMiddleware({
  missingAction: SECURITY_AUDIT_ACTIONS.PUBLIC_FORM_TURNSTILE_MISSING,
  failedAction: SECURITY_AUDIT_ACTIONS.PUBLIC_FORM_TURNSTILE_FAILED,
  passedAction: SECURITY_AUDIT_ACTIONS.PUBLIC_FORM_TURNSTILE_PASSED,
  resource: 'public/forms/submit',
  missingDescription: 'Public form Turnstile token missing',
  failedDescription: 'Public form Turnstile verification failed',
  passedDescription: 'Public form Turnstile verification passed',
  skip: isEmbeddedPublicFormSubmission,
});

module.exports = {
  GENERIC_TURNSTILE_FAILURE_MESSAGE,
  createTurnstileMiddleware,
  requireTurnstileForForgotPassword,
  requireTurnstileForSignup,
  requireTurnstileForUpload,
  requireTurnstileForLoginVerify,
  requireTurnstileForPublicForm,
};
