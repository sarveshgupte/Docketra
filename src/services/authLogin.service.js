const { createResponseCapture, sendSuccessResponse, sendErrorResponse } = require('../utils/response.util');
const { validateRequiredFields } = require('../utils/validation.util');
const log = require('../utils/log');

const createAuthLoginService = (deps) => {
  const models = deps.models || {};
  const utils = deps.utils || {};
  const services = deps.services || {};
  const {
    User = deps.User,
    LoginSession = deps.LoginSession,
  } = models;
  const {
    getSuperadminEnv = deps.getSuperadminEnv,
    handleSuperadminLogin = deps.handleSuperadminLogin,
    validateTenantUserPreconditions = deps.validateTenantUserPreconditions,
    handlePasswordVerification = deps.handlePasswordVerification,
    handlePostPasswordChecks = deps.handlePostPasswordChecks,
    sendLoginOtpChallenge = deps.sendLoginOtpChallenge,
    getLoginOtpConfig = deps.getLoginOtpConfig,
    LOGIN_OTP_COOLDOWN_SECONDS = deps.LOGIN_OTP_COOLDOWN_SECONDS,
    hashLoginSessionToken = deps.hashLoginSessionToken,
    clearExpiredLoginOtpLock = deps.clearExpiredLoginOtpLock,
    getLoginOtpLockSeconds = deps.getLoginOtpLockSeconds,
    logLoginOtpEvent = deps.logLoginOtpEvent,
    clearLoginOtpState = deps.clearLoginOtpState,
    persistLoginOtpState = deps.persistLoginOtpState,
    logAuthAudit = deps.logAuthAudit,
    DEFAULT_XID = deps.DEFAULT_XID,
    DEFAULT_FIRM_ID = deps.DEFAULT_FIRM_ID,
    noteLoginFailure = deps.noteLoginFailure,
    clearCachedLoginOtpState = deps.clearCachedLoginOtpState,
    buildSuccessfulLoginPayload = deps.buildSuccessfulLoginPayload,
    normalizeFirmSlug = deps.normalizeFirmSlug,
    setAuthCookies = deps.setAuthCookies,
  } = utils;
  const {
    authOtpService = deps.authOtpService,
  } = services;

  const loginHandler = async (req, res) => {
    try {
      const loginScope = req.loginScope || 'tenant';
      const requestedFirmSlug = req.params?.firmSlug || req.firmSlug || null;
      const { xid, xID, XID, password } = req.body;
      log.info('AUTH_LOGIN_SERVICE_START', {
        req,
        loginScope,
        firmSlug: requestedFirmSlug,
        tenantId: req.firmId || req.user?.firmId || null,
      });

      const normalizedXID = (xid || xID || XID)?.trim().toUpperCase();

      if (!validateRequiredFields({ xID: normalizedXID, password }, ['xID', 'password']).isValid) {
        log.warn('AUTH_LOGIN_VALIDATION_FAILED', {
          req,
          hasXID: !!(xid || xID || XID),
          hasPassword: !!password,
        });

        return sendErrorResponse(res, { statusCode: 400, message: 'xID and password are required' });
      }

      const { normalizedXID: superadminXID } = getSuperadminEnv();

      if (superadminXID && normalizedXID === superadminXID) {
        return await handleSuperadminLogin(req, res, normalizedXID, password, loginScope);
      }

      if (loginScope === 'superadmin') {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid xID or password' });
      }

      if (!req.firmId) {
        return sendErrorResponse(res, { statusCode: 400, message: 'Firm context is required for login.' });
      }

      log.info('AUTH_LOGIN_ATTEMPT', {
        req,
        firmSlug: requestedFirmSlug,
        xID: normalizedXID,
        tenantId: req.firmId,
      });
      const user = await User.findOne({
        firmId: req.firmId,
        xID: normalizedXID,
        status: { $ne: 'deleted' },
      });

      if (await validateTenantUserPreconditions(req, res, user, requestedFirmSlug, normalizedXID)) {
        return;
      }

      if (!(await handlePasswordVerification(req, res, user, password))) {
        return;
      }

      if (await handlePostPasswordChecks(req, res, user)) {
        return;
      }

      try {
        const loginToken = await sendLoginOtpChallenge(req, user);
        const otpConfig = getLoginOtpConfig();
        log.info('AUTH_LOGIN_CHALLENGE_SENT', {
          req,
          tenantId: req.firmId,
          userId: user?._id || null,
          userXID: user?.xID || null,
        });
        return sendSuccessResponse(res, {
          body: {
            otpRequired: true,
            loginToken,
            otpDeliveryHint: user.email ? `Code sent to ${user.email.replace(/(.{2}).+(@.+)/, '$1***$2')}` : 'Code sent to your registered email',
            resendCooldownSeconds: otpConfig.resendCooldownSeconds,
          },
        });
      } catch (otpError) {
        if (otpError?.code === 'LOGIN_OTP_COOLDOWN_ACTIVE') {
          return sendErrorResponse(res, {
            statusCode: 429,
            message: 'OTP recently sent. Please wait before requesting a new code.',
            retryAfter: otpError.retryAfter || LOGIN_OTP_COOLDOWN_SECONDS,
          });
        }
        log.error('AUTH_LOGIN_CHALLENGE_FAILED', {
          req,
          tenantId: req.firmId,
          userId: user?._id || null,
          userXID: user?.xID || null,
          error: otpError,
        });
        return sendErrorResponse(res, {
          statusCode: 500,
          message: 'Unable to send login verification code. Please try again.',
        });
      }
    } catch (error) {
      log.error('AUTH_LOGIN_SERVICE_FAILED', { req, error });
      return sendErrorResponse(res, {
        statusCode: 500,
        code: 'AUTH_LOGIN_FAILED',
        message: 'Error during login',
      });
    }
  };

  const login = async (reqOrData, maybeRes) => {
    const req = maybeRes ? reqOrData : (reqOrData?.req || reqOrData);
    if (maybeRes) {
      return loginHandler(req, maybeRes);
    }
    const responseCapture = createResponseCapture();
    await loginHandler(req, responseCapture.res);
    return responseCapture.getResult();
  };

  const resendLoginOtp = async (req, res) => {
    try {
      const otpConfig = getLoginOtpConfig();
      const loginToken = String(req.body?.loginToken || '').trim();
      if (!validateRequiredFields({ loginToken }, ['loginToken']).isValid) {
        return sendErrorResponse(res, { statusCode: 400, message: 'loginToken is required' });
      }

      const tokenHash = hashLoginSessionToken(loginToken);
      const loginSession = await LoginSession.findOne({ tokenHash, consumedAt: null });
      if (!loginSession || !loginSession.expiresAt || loginSession.expiresAt.getTime() < Date.now()) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid or expired login token' });
      }
      if (req.firmId && String(req.firmId) !== String(loginSession.firmId)) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid or expired login token' });
      }

      const user = await User.findOne({
        _id: loginSession.userId,
        firmId: loginSession.firmId,
        status: 'active',
        isActive: true,
      });
      if (!user) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid or expired login token' });
      }

      await clearExpiredLoginOtpLock(user);

      const activeLockSeconds = getLoginOtpLockSeconds(user);
      if (activeLockSeconds > 0) {
        logLoginOtpEvent('OTP_LOCKED', req, user, {
          retryAfter: activeLockSeconds,
          reason: 'verify_lock_active',
        });
        return sendErrorResponse(res, { statusCode: 429, message: 'Too many attempts. Try again later.' });
      }

      const lastSentAtMs = user.loginOtpLastSentAt ? new Date(user.loginOtpLastSentAt).getTime() : 0;
      const resendCooldownEndsAt = lastSentAtMs + (otpConfig.resendCooldownSeconds * 1000);
      const retryAfter = Math.max(0, Math.ceil((resendCooldownEndsAt - Date.now()) / 1000));
      if (retryAfter > 0) {
        return sendErrorResponse(res, { statusCode: 429, message: 'Too many attempts. Try again later.', retryAfter });
      }

      if (Number(user.loginOtpResendCount || 0) >= otpConfig.maxResends) {
        return sendErrorResponse(res, { statusCode: 429, message: 'Too many attempts. Try again later.' });
      }

      await sendLoginOtpChallenge(req, user, { isResend: true, returnLoginToken: false });

      return sendSuccessResponse(res, {
        body: {
          message: 'Verification code resent.',
          resendCooldownSeconds: otpConfig.resendCooldownSeconds,
        },
      });
    } catch (error) {
      if (error?.code === 'LOGIN_OTP_COOLDOWN_ACTIVE') {
        return sendErrorResponse(res, {
          statusCode: 429,
          message: 'OTP recently sent. Please wait before requesting a new code.',
          retryAfter: error.retryAfter || LOGIN_OTP_COOLDOWN_SECONDS,
        });
      }
      log.error('AUTH_LOGIN_RESEND_OTP_FAILED', { req, error });
      return sendErrorResponse(res, {
        statusCode: 500,
        message: 'Unable to resend OTP right now. Please try again.',
      });
    }
  };

  const verifyLoginOtp = async (req, res) => {
    try {
      const otpConfig = getLoginOtpConfig();
      const requestedFirmSlug = req.params?.firmSlug || req.firmSlug || null;
      const otp = String(req.body?.otp || '').trim();
      const loginToken = String(req.body?.loginToken || '').trim();

      if (!/^\d{6}$/.test(otp)) {
        return sendErrorResponse(res, { statusCode: 400, message: 'OTP must be a 6 digit code' });
      }
      if (!validateRequiredFields({ loginToken }, ['loginToken']).isValid) {
        return sendErrorResponse(res, { statusCode: 400, message: 'loginToken is required' });
      }

      const tokenHash = hashLoginSessionToken(loginToken);
      const loginSession = await LoginSession.findOne({ tokenHash, consumedAt: null });
      if (!loginSession || !loginSession.expiresAt || loginSession.expiresAt.getTime() < Date.now()) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid or expired login token' });
      }

      const normalizedRequestedFirmSlug = normalizeFirmSlug(requestedFirmSlug);
      if (req.firmId && String(req.firmId) !== String(loginSession.firmId)) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid or expired login token' });
      }
      if (normalizedRequestedFirmSlug && normalizeFirmSlug(req.firmSlug) && normalizedRequestedFirmSlug !== normalizeFirmSlug(req.firmSlug)) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid or expired login token' });
      }

      const user = await User.findOne({
        _id: loginSession.userId,
        firmId: loginSession.firmId,
        status: 'active',
        isActive: true,
      });

      if (!user) {
        return sendErrorResponse(res, { statusCode: 401, message: 'Invalid authentication token' });
      }

      await clearExpiredLoginOtpLock(user);

      const activeLockSeconds = getLoginOtpLockSeconds(user);
      if (activeLockSeconds > 0) {
        logLoginOtpEvent('OTP_LOCKED', req, user, {
          retryAfter: activeLockSeconds,
          reason: 'verify_lock_active',
        });
        return sendErrorResponse(res, {
          statusCode: 429,
          error: 'Too many attempts. Try again later.',
          message: 'Too many attempts. Try again later.',
          retryAfter: activeLockSeconds,
        });
      }

      if (!user.loginOtpHash || !user.loginOtpExpiresAt || user.loginOtpExpiresAt.getTime() < Date.now()) {
        clearLoginOtpState(user);
        await persistLoginOtpState(user);
        return sendErrorResponse(res, { statusCode: 401, message: 'OTP expired. Please request a new one.' });
      }

      const currentAttempts = Number(user.loginOtpAttempts || 0);
      if (currentAttempts >= otpConfig.maxAttempts) {
        user.loginOtpLockedUntil = new Date(Date.now() + (otpConfig.lockMinutes * 60 * 1000));
        await persistLoginOtpState(user);
        logLoginOtpEvent('OTP_LOCKED', req, user, {
          retryAfter: getLoginOtpLockSeconds(user),
          reason: 'attempts_exhausted_before_verify',
        });
        return sendErrorResponse(res, {
          statusCode: 429,
          error: 'Too many attempts. Try again later.',
          message: 'Too many attempts. Try again later.',
          retryAfter: getLoginOtpLockSeconds(user),
        });
      }

      const isValidOtp = await authOtpService.verifyOtp(otp, user.loginOtpHash);
      if (!isValidOtp) {
        user.loginOtpAttempts = currentAttempts + 1;
        const exhaustedAttempts = user.loginOtpAttempts >= otpConfig.maxAttempts;
        if (exhaustedAttempts) {
          user.loginOtpLockedUntil = new Date(Date.now() + (otpConfig.lockMinutes * 60 * 1000));
        }
        await persistLoginOtpState(user);
        logLoginOtpEvent('OTP_FAILED_ATTEMPT', req, user, {
          attempts: user.loginOtpAttempts,
          maxAttempts: otpConfig.maxAttempts,
          remainingAttempts: exhaustedAttempts
            ? 0
            : Math.max(0, otpConfig.maxAttempts - user.loginOtpAttempts),
        });
        if (exhaustedAttempts) {
          logLoginOtpEvent('OTP_LOCKED', req, user, {
            retryAfter: getLoginOtpLockSeconds(user),
            reason: 'attempt_limit_reached',
          });
        }

        try {
          await logAuthAudit({
            xID: user.xID || DEFAULT_XID,
            firmId: user.firmId || DEFAULT_FIRM_ID,
            userId: user._id,
            actionType: 'LOGIN_FAILURE',
            description: `Invalid login OTP supplied (attempt ${user.loginOtpAttempts})`,
            performedBy: user.xID || DEFAULT_XID,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
              eventType: 'LOGIN_FAILURE',
              firmSlug: requestedFirmSlug,
              attempts: user.loginOtpAttempts,
              timestamp: new Date().toISOString(),
            },
          }, req);
          await noteLoginFailure({
            req,
            xID: user.xID || DEFAULT_XID,
            userId: user._id,
            firmId: user.firmId || DEFAULT_FIRM_ID,
          });
        } catch (auditError) {
          log.error('AUTH_AUDIT_LOG_FAILURE', {
            req,
            eventType: 'LOGIN_FAILURE',
            error: auditError,
          });
        }

        return sendErrorResponse(res, {
          statusCode: exhaustedAttempts ? 429 : 401,
          error: exhaustedAttempts ? 'Too many attempts. Try again later.' : undefined,
          message: exhaustedAttempts
            ? 'Too many attempts. Try again later.'
            : 'Invalid OTP. Please try again.',
          remainingAttempts: exhaustedAttempts
            ? 0
            : Math.max(0, otpConfig.maxAttempts - user.loginOtpAttempts),
          retryAfter: exhaustedAttempts ? getLoginOtpLockSeconds(user) : undefined,
        });
      }

      clearLoginOtpState(user);
      await persistLoginOtpState(user);
      await clearCachedLoginOtpState(user);
      if (loginSession?._id) {
        await LoginSession.updateOne({ _id: loginSession._id, consumedAt: null }, { $set: { consumedAt: new Date() } });
      }
      logLoginOtpEvent('OTP_VERIFIED', req, user);

      try {
        await logAuthAudit({
          xID: user.xID || DEFAULT_XID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'OTP_VERIFIED',
          description: 'Login OTP verified successfully',
          performedBy: user.xID || DEFAULT_XID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            eventType: 'OTP_VERIFIED',
            firmSlug: requestedFirmSlug,
            timestamp: new Date().toISOString(),
          },
        }, req);
        } catch (auditError) {
          log.error('AUTH_AUDIT_LOG_FAILURE', {
            req,
            eventType: 'OTP_VERIFIED',
            error: auditError,
          });
        }

      log.info('AUTH_LOGIN_SUCCESS', {
        req,
        tenantId: user?.firmId || req.firmId || null,
        userId: user?._id || null,
        userXID: user?.xID || null,
      });
      const response = await buildSuccessfulLoginPayload(req, user, {
        authMethod: 'Email OTP',
        resource: 'auth/verify-otp',
        mfaRequired: true,
      });
      if (response?.accessToken && response?.refreshToken) {
        setAuthCookies(res, {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        });
      }
      if (Object.prototype.hasOwnProperty.call(response, 'accessToken')) {
        delete response.accessToken;
      }
      if (Object.prototype.hasOwnProperty.call(response, 'refreshToken')) {
        delete response.refreshToken;
      }

      return res.json(response);
    } catch (error) {
      log.error('AUTH_LOGIN_VERIFY_OTP_FAILED', { req, error });
      return sendErrorResponse(res, { statusCode: 500, message: 'Error verifying login OTP' });
    }
  };

  return {
    login,
    resendLoginOtp,
    verifyLoginOtp,
  };
};

module.exports = createAuthLoginService;
