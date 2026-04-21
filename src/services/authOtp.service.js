const bcrypt = require('bcrypt');
const crypto = require('crypto');
const log = require('../utils/log');

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const hashOtp = async (otp, saltRounds = 10) => bcrypt.hash(String(otp), saltRounds);

const verifyOtp = async (otp, otpHash) => bcrypt.compare(String(otp), String(otpHash || ''));

const incrementAttempts = (currentAttempts = 0, maxAttempts = 5) => {
  const attempts = Number(currentAttempts || 0) + 1;
  return {
    attempts,
    exhausted: attempts >= maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - attempts),
  };
};

const createAuthOtpService = (deps) => {
  const {
    getRequestFirmId,
    User,
    getTwoFactorSecret,
    speakeasy,
    jwt,
    mongoose,
    getFirmSlug,
    ensureCanonicalXid,
    jwtService,
    generateAndStoreRefreshToken,
    handleSuccessfulLoginMonitoring,
    logAuthAudit,
    logSecurityAuditEvent,
    SECURITY_AUDIT_ACTIONS,
    DEFAULT_XID,
    DEFAULT_FIRM_ID,
    sendCentralOtp,
    verifyCentralOtp,
    issueAuthTokens,
    setAuthCookies,
  } = deps;

  const verifyTotp = async (req, res) => {
    try {
      const xID = String(req.body?.xID || '').trim().toUpperCase();
      const token = String(req.body?.token || '').trim();

      if (!xID || !token) {
        return res.status(400).json({
          success: false,
          message: 'xID and token are required',
        });
      }

      const firmId = getRequestFirmId(req);
      const userQuery = { xID, status: 'active' };
      if (firmId) {
        userQuery.firmId = firmId;
      }
      const user = await User.findOne(userQuery).select('xID twoFactorSecret');
      if (!user || !user.twoFactorSecret) {
        return res.status(404).json({
          success: false,
          message: 'MFA is not configured for this user',
        });
      }

      const decryptedSecret = getTwoFactorSecret(user);
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          message: 'Invalid TOTP token',
        });
      }

      return res.json({
        success: true,
        message: 'TOTP verified successfully',
      });
    } catch (error) {
      log.error('[AUTH][verifyTotp] Error verifying TOTP', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying TOTP',
      });
    }
  };

  const completeMfaLogin = async (req, res) => {
    try {
      const token = String(req.body?.token || '').trim();
      const preAuthToken = String(req.body?.preAuthToken || '').trim();

      if (!preAuthToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired pre-authentication token',
        });
      }

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'token is required',
        });
      }

      let decodedPreAuthToken;
      try {
        decodedPreAuthToken = jwt.verify(preAuthToken, process.env.JWT_SECRET, {
          algorithms: ['HS256'],
        });
      } catch (_error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired pre-authentication token',
        });
      }

      if (!decodedPreAuthToken?.mfaStage || !decodedPreAuthToken?.userId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired pre-authentication token',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(decodedPreAuthToken.userId)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired pre-authentication token',
        });
      }

      const user = await User.findOne({
        _id: decodedPreAuthToken.userId,
        ...(decodedPreAuthToken.firmId ? { firmId: decodedPreAuthToken.firmId } : {}),
        isActive: true,
        status: 'active',
      });

      if (!user || !user.twoFactorSecret) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token',
        });
      }

      const decryptedSecret = getTwoFactorSecret(user);
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token',
        });
      }

      const firmSlug = await getFirmSlug(user.firmId);
      await ensureCanonicalXid(user);

      const accessToken = jwtService.generateAccessToken({
        userId: user._id.toString(),
        firmId: user.firmId ? user.firmId.toString() : undefined,
        firmSlug: firmSlug || undefined,
        defaultClientId: user.defaultClientId ? user.defaultClientId.toString() : undefined,
        role: user.role,
      });

      let refreshToken = null;
      try {
        ({ refreshToken } = await generateAndStoreRefreshToken({
          userId: user._id,
          firmId: user.firmId || null,
          req,
        }));
      } catch (tokenError) {
        log.error('[AUTH] Refresh token persistence failed', tokenError);
      }

      try {
        await handleSuccessfulLoginMonitoring(req, user, {
          resource: 'auth/complete-mfa-login',
          mfaRequired: true,
        });
        await logAuthAudit({
          xID: user.xID || DEFAULT_XID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'MFA_LOGIN_SUCCESS',
          description: 'User completed MFA login successfully',
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }, req);
        await logSecurityAuditEvent({
          req,
          action: SECURITY_AUDIT_ACTIONS.LOGIN_SUCCESS,
          resource: 'auth/complete-mfa-login',
          userId: user._id,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          xID: user.xID || DEFAULT_XID,
          performedBy: user.xID || DEFAULT_XID,
          metadata: {
            mfaRequired: true,
          },
          description: 'User completed MFA login successfully',
        }).catch(() => null);
      } catch (auditError) {
        log.error('[AUTH AUDIT] Failed to record MFA login success event', auditError);
      }

      const response = {
        success: true,
        message: user.forcePasswordReset ? 'Password reset required' : 'Login successful',
        data: {
          id: user._id.toString(),
          xID: user.xID,
          name: user.name,
          email: user.email,
          role: user.role,
          firmId: user.firmId ? user.firmId.toString() : null,
          firmSlug,
          allowedCategories: user.allowedCategories,
          isActive: user.isActive,
          mustSetPassword: !!user.mustSetPassword,
          passwordSetAt: user.passwordSetAt,
        },
      };

      if (user.forcePasswordReset) {
        response.mustChangePassword = true;
        response.forcePasswordReset = true;
      }
      if (accessToken) {
        setAuthCookies(res, { accessToken, refreshToken });
      }

      return res.json(response);
    } catch (error) {
      log.error('[AUTH][completeMfaLogin] Error completing MFA login', error);
      return res.status(500).json({
        success: false,
        message: 'Error completing MFA login',
      });
    }
  };

  const sendOtpEndpoint = async (req, res) => {
    try {
      const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
      const xid = req.body?.xid ? String(req.body.xid).trim().toUpperCase() : null;
      const purpose = String(req.body?.purpose || 'login').trim();
      const result = await sendCentralOtp({ email, xid, purpose });
      return res.status(202).json({ success: true, data: result });
    } catch (error) {
      const statusCode = error.message === 'OTP_RATE_LIMITED' ? 429 : 400;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  };

  const verifyOtpEndpoint = async (req, res) => {
    try {
      const email = String(req.body?.email || req.body?.identifier || '').trim().toLowerCase();
      const otp = String(req.body?.otp || req.body?.code || '').trim();
      const purpose = String(req.body?.purpose || 'login').trim();
      const result = await verifyCentralOtp({ identifier: email, code: otp, purpose });

      const user = await User.findOne({
        $or: [{ primary_email: result.identifier }, { email: result.identifier }],
        status: { $ne: 'deleted' },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      if (!user.emailVerified) {
        user.emailVerified = true;
        user.is_verified = true;
        user.emailVerifiedAt = new Date();
        user.verificationMethod = 'OTP';
        await user.save();
      }

      const tokens = await issueAuthTokens(req, user);
      setAuthCookies(res, tokens);
      return res.json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  };

  return {
    verifyTotp,
    completeMfaLogin,
    sendOtpEndpoint,
    verifyOtpEndpoint,
  };
};

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtp,
  incrementAttempts,
  createAuthOtpService,
  createAuthOtpDomainService: createAuthOtpService,
  createAuthOtpControllerService: createAuthOtpService,
};
