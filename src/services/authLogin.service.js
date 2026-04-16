const { createResponseCapture } = require('../utils/response.util');

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
  } = utils;
  const {
    authOtpService = deps.authOtpService,
  } = services;

  const loginHandler = async (req, res) => {
    try {
      const loginScope = req.loginScope || 'tenant';
      const requestedFirmSlug = req.params?.firmSlug || req.firmSlug || null;
      const { xid, xID, XID, password } = req.body;

      const normalizedXID = (xid || xID || XID)?.trim().toUpperCase();

      if (!normalizedXID || !password) {
        console.warn('[AUTH] Missing credentials in login attempt', {
          hasXID: !!(xid || xID || XID),
          hasPassword: !!password,
          ip: req.ip,
        });

        return res.status(400).json({
          success: false,
          message: 'xID and password are required',
        });
      }

      const { normalizedXID: superadminXID } = getSuperadminEnv();

      if (superadminXID && normalizedXID === superadminXID) {
        return await handleSuperadminLogin(req, res, normalizedXID, password, loginScope);
      }

      if (loginScope === 'superadmin') {
        return res.status(401).json({ success: false, message: 'Invalid xID or password' });
      }

      if (!req.firmId) {
        return res.status(400).json({
          success: false,
          message: 'Firm context is required for login.',
        });
      }

      console.log('[AUTH][tenant] login attempt', { firmSlug: requestedFirmSlug, xID: normalizedXID });
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
        return res.json({
          success: true,
          otpRequired: true,
          loginToken,
          otpDeliveryHint: user.email ? `Code sent to ${user.email.replace(/(.{2}).+(@.+)/, '$1***$2')}` : 'Code sent to your registered email',
          resendCooldownSeconds: otpConfig.resendCooldownSeconds,
        });
      } catch (otpError) {
        if (otpError?.code === 'LOGIN_OTP_COOLDOWN_ACTIVE') {
          return res.status(429).json({
            success: false,
            message: 'OTP recently sent. Please wait before requesting a new code.',
            retryAfter: otpError.retryAfter || LOGIN_OTP_COOLDOWN_SECONDS,
          });
        }
        console.error('[AUTH] Failed to send login OTP email:', otpError.message);
        return res.status(500).json({
          success: false,
          message: 'Unable to send login verification code. Please try again.',
        });
      }
    } catch (error) {
      console.error('[AUTH] Login error:', error);
      return res.status(500).json({
        success: false,
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
      if (!loginToken) {
        return res.status(400).json({ success: false, message: 'loginToken is required' });
      }

      const tokenHash = hashLoginSessionToken(loginToken);
      const loginSession = await LoginSession.findOne({ tokenHash, consumedAt: null });
      if (!loginSession || !loginSession.expiresAt || loginSession.expiresAt.getTime() < Date.now()) {
        return res.status(401).json({ success: false, message: 'Invalid or expired login token' });
      }
      if (req.firmId && String(req.firmId) !== String(loginSession.firmId)) {
        return res.status(401).json({ success: false, message: 'Invalid or expired login token' });
      }

      const user = await User.findOne({
        _id: loginSession.userId,
        firmId: loginSession.firmId,
        status: 'active',
        isActive: true,
      });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid or expired login token' });
      }

      await clearExpiredLoginOtpLock(user);

      const activeLockSeconds = getLoginOtpLockSeconds(user);
      if (activeLockSeconds > 0) {
        logLoginOtpEvent('OTP_LOCKED', req, user, {
          retryAfter: activeLockSeconds,
          reason: 'verify_lock_active',
        });
        return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
      }

      const lastSentAtMs = user.loginOtpLastSentAt ? new Date(user.loginOtpLastSentAt).getTime() : 0;
      const resendCooldownEndsAt = lastSentAtMs + (otpConfig.resendCooldownSeconds * 1000);
      const retryAfter = Math.max(0, Math.ceil((resendCooldownEndsAt - Date.now()) / 1000));
      if (retryAfter > 0) {
        return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.', retryAfter });
      }

      if (Number(user.loginOtpResendCount || 0) >= otpConfig.maxResends) {
        return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
      }

      await sendLoginOtpChallenge(req, user, { isResend: true, returnLoginToken: false });

      return res.json({
        success: true,
        message: 'Verification code resent.',
        resendCooldownSeconds: otpConfig.resendCooldownSeconds,
      });
    } catch (error) {
      if (error?.code === 'LOGIN_OTP_COOLDOWN_ACTIVE') {
        return res.status(429).json({
          success: false,
          message: 'OTP recently sent. Please wait before requesting a new code.',
          retryAfter: error.retryAfter || LOGIN_OTP_COOLDOWN_SECONDS,
        });
      }
      console.error('[AUTH] Resend OTP error:', error);
      return res.status(500).json({
        success: false,
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
        return res.status(400).json({
          success: false,
          message: 'OTP must be a 6 digit code',
        });
      }
      if (!loginToken) {
        return res.status(400).json({
          success: false,
          message: 'loginToken is required',
        });
      }

      const tokenHash = hashLoginSessionToken(loginToken);
      const loginSession = await LoginSession.findOne({ tokenHash, consumedAt: null });
      if (!loginSession || !loginSession.expiresAt || loginSession.expiresAt.getTime() < Date.now()) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired login token',
        });
      }

      const normalizedRequestedFirmSlug = normalizeFirmSlug(requestedFirmSlug);
      if (req.firmId && String(req.firmId) !== String(loginSession.firmId)) {
        return res.status(401).json({ success: false, message: 'Invalid or expired login token' });
      }
      if (normalizedRequestedFirmSlug && normalizeFirmSlug(req.firmSlug) && normalizedRequestedFirmSlug !== normalizeFirmSlug(req.firmSlug)) {
        return res.status(401).json({ success: false, message: 'Invalid or expired login token' });
      }

      const user = await User.findOne({
        _id: loginSession.userId,
        firmId: loginSession.firmId,
        status: 'active',
        isActive: true,
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token',
        });
      }

      await clearExpiredLoginOtpLock(user);

      const activeLockSeconds = getLoginOtpLockSeconds(user);
      if (activeLockSeconds > 0) {
        logLoginOtpEvent('OTP_LOCKED', req, user, {
          retryAfter: activeLockSeconds,
          reason: 'verify_lock_active',
        });
        return res.status(429).json({
          success: false,
          error: 'Too many attempts. Try again later.',
          message: 'Too many attempts. Try again later.',
          retryAfter: activeLockSeconds,
        });
      }

      if (!user.loginOtpHash || !user.loginOtpExpiresAt || user.loginOtpExpiresAt.getTime() < Date.now()) {
        clearLoginOtpState(user);
        await persistLoginOtpState(user);
        return res.status(401).json({
          success: false,
          message: 'OTP expired. Please request a new one.',
        });
      }

      const currentAttempts = Number(user.loginOtpAttempts || 0);
      if (currentAttempts >= otpConfig.maxAttempts) {
        user.loginOtpLockedUntil = new Date(Date.now() + (otpConfig.lockMinutes * 60 * 1000));
        await persistLoginOtpState(user);
        logLoginOtpEvent('OTP_LOCKED', req, user, {
          retryAfter: getLoginOtpLockSeconds(user),
          reason: 'attempts_exhausted_before_verify',
        });
        return res.status(429).json({
          success: false,
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
          console.error('[AUTH AUDIT] Failed to record login OTP failure event', auditError);
        }

        return res.status(exhaustedAttempts ? 429 : 401).json({
          success: false,
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
        console.error('[AUTH AUDIT] Failed to record login OTP verification event', auditError);
      }

      const response = await buildSuccessfulLoginPayload(req, user, {
        authMethod: 'Email OTP',
        resource: 'auth/verify-otp',
        mfaRequired: true,
      });

      return res.json(response);
    } catch (error) {
      console.error('[AUTH] Verify login OTP error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying login OTP',
      });
    }
  };

  return {
    login,
    resendLoginOtp,
    verifyLoginOtp,
  };
};

module.exports = createAuthLoginService;
