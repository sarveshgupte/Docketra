const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const User = require('../models/User.model');
const Team = require('../models/Team.model');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const UserProfile = require('../models/UserProfile.model');
const AuthAudit = require('../models/AuthAudit.model');
const RefreshToken = require('../models/RefreshToken.model');
const AuthIdentity = require('../models/AuthIdentity.model');
const LoginSession = require('../models/LoginSession.model');
const { sendOtp: sendCentralOtp, verifyOtp: verifyCentralOtp } = require('../services/otp.service');
const emailService = require('../services/email.service');
const authOtpService = require('../services/authOtp.service');
const createAuthLoginService = require('../services/authLogin.service');
const createAuthSignupService = require('../services/authSignup.service');
const createAuthSessionService = require('../services/authSession.service');
const createAuthPasswordService = require('../services/authPassword.service');
const xIDGenerator = require('../services/xIDGenerator');
const signupService = require('../services/signup.service');
const jwtService = require('../services/jwt.service');
const { isSuperAdminRole, normalizeRole } = require('../utils/role.utils');
const { getTutorialStatus, shouldShowWelcomeTutorial } = require('../utils/tutorialState.utils');
const { assertPrimaryAdmin, canInviteRole, getTagValidationError, normalizeId } = require('../utils/hierarchy.utils');
const { normalizeFirmSlug } = require('../utils/slugify');
const { isActiveStatus, getFirmInactiveCode } = require('../utils/status.utils');
const { validatePasswordStrength, PASSWORD_POLICY_MESSAGE } = require('../utils/passwordPolicy');
const { applyServiceResponse } = require('../utils/response.util');
const { getSession } = require('../utils/getSession');
const { handleUserDeactivation } = require('../services/docketWorkflow.service');
const { ensureDefaultClientForFirm } = require('../services/defaultClient.service');
const { getOrCreateDefaultClient } = require('../services/defaultClient.guard');
const { getLatestPublishedUpdate } = require('../services/productUpdate.service');
const { disconnectUserSockets } = require('../services/notificationSocket.service');
const { resolveCanonicalTenantForUser } = require('../services/tenantIdentity.service');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const config = require('../config/config');
const { loadEnv } = require('../config/env');
const { recordFailedLoginAttempt, clearFailedLoginAttempts } = require('../middleware/accountLockout.middleware');
const { assertFirmPlanCapacity, PlanLimitExceededError, PlanAdminLimitExceededError, assertCanDeactivateUser, PrimaryAdminActionError } = require('../services/user.service');
const { logAuthEvent } = require('../services/audit.service');
const { incrementTenantMetric } = require('../services/tenantMetrics.service');
const { mapUserResponse } = require('../mappers/user.mapper');
const { decrypt: decryptProtectedValue } = require('../utils/encryption');
const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('../services/securityAudit.service');
const { getRedisClient } = require('../config/redis');
const log = require('../utils/log');
const {
  noteLoginFailure,
  noteLockedAccountAttempt,
  noteSuccessfulLogin,
  noteRefreshTokenFailure,
  noteRefreshTokenUse,
  getRequestCountry,
} = require('../services/securityTelemetry.service');

/**
 * Authentication Controller for JWT-based Enterprise Authentication
 * PART B - Identity and Authentication Management
 */

const SALT_ROUNDS = 10;
const PASSWORD_EXPIRY_DAYS = 60;
const PASSWORD_HISTORY_LIMIT = 5;
const MAX_FAILED_ATTEMPTS = config.security.rateLimit.accountLockAttempts;
const LOCK_TIME = config.security.rateLimit.accountLockSeconds * 1000;
const INVITE_TOKEN_EXPIRY_HOURS = 48; // 48 hours for invite tokens (per PR 32 requirements)
const PASSWORD_SETUP_TOKEN_EXPIRY_HOURS = 24; // 24 hours for password reset tokens
const FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES = 30; // 30 minutes for forgot password tokens
const PRE_AUTH_TOKEN_EXPIRY = '5m';
const DEFAULT_FIRM_ID = 'PLATFORM'; // Default firmId for SUPER_ADMIN and audit logging
const DEFAULT_XID = 'SUPERADMIN'; // Default xID for SUPER_ADMIN in audit logs
const env = loadEnv({ exitOnError: false }) || {};
const SUPERADMIN_USER_ID = () => env.SUPERADMIN_OBJECT_ID;
const SUPERADMIN_ROLE = 'SUPERADMIN';
const ROLE_SUPER_ADMIN = 'SUPER_ADMIN';
const ROLE_ADMIN = 'Admin';
const ROLE_EMPLOYEE = 'Employee';
const HIERARCHY_TAG_FIELDS = ['primaryAdminId', 'adminId', 'managerId'];
const isSuperAdminRequest = (req) => (
  req?.isSuperAdmin === true
  || req?.jwt?.isSuperAdmin === true
  || isSuperAdminRole(req?.jwt?.role || req?.user?.role)
);
const getRequestFirmId = (req) => req?.jwt?.firmId || req?.user?.firmId || req?.firmId || null;

const ensureUserDefaultClientLink = async (user, req = null) => {
  if (!user?.firmId) {
    throw new Error('MISSING_FIRM_CONTEXT');
  }

  let defaultClient = null;
  if (user.defaultClientId) {
    defaultClient = await Client.findById(user.defaultClientId)
      .select('_id firmId isDefaultClient')
      .lean();
  }

  const needsRepair = (
    !defaultClient
    || !defaultClient.isDefaultClient
    || String(defaultClient.firmId) !== String(user.firmId)
  );

  if (needsRepair) {
    defaultClient = await getOrCreateDefaultClient(user.firmId, {
      userId: user._id,
      requestId: req?.id || req?.requestId || null,
    });
    user.defaultClientId = defaultClient._id;
    await user.save();
  }

  return defaultClient;
};

const logger = log;
const { safeLogForensicAudit, getRequestIp, getRequestUserAgent } = require('../services/forensicAudit.service');
const { safeAuditLog, safeQueueEmail, safeAnalyticsEvent } = require('../services/safeSideEffects.service');
const { logAuditEvent } = require('../services/adminActionAudit.service');

const resolveInviteRequestState = async ({ req, admin, normalizedEmail, session, existingXID = null }) => {
  const cachedState = req._inviteRequestState;

  if (
    cachedState
    && cachedState.firmId === String(admin.firmId)
    && cachedState.email === normalizedEmail
    && (!existingXID || cachedState.xID === existingXID)
  ) {
    log.info('ADMIN_INVITE_STATE_REUSED', {
      req: {
        requestId: req.requestId || req.id || null,
        method: req.method,
        path: req.originalUrl || req.url,
      },
      firmId: admin.firmId,
      userXID: admin.xID,
      invitedEmail: emailService.maskEmail(normalizedEmail),
      inviteXID: cachedState.xID,
      inviteExpiry: cachedState.tokenExpiry.toISOString(),
      reuseReason: existingXID ? 'existing_invited_user' : 'transaction_retry',
    });
    return cachedState;
  }

  const xID = existingXID || await xIDGenerator.generateNextXID(admin.firmId, session);
  const token = emailService.generateSecureToken();
  const tokenHash = emailService.hashToken(token);
  const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const inviteState = {
    firmId: String(admin.firmId),
    email: normalizedEmail,
    xID,
    token,
    tokenHash,
    tokenExpiry,
  };

  req._inviteRequestState = inviteState;

  log.info('ADMIN_INVITE_XID_GENERATED', {
    req: {
      requestId: req.requestId || req.id || null,
      method: req.method,
      path: req.originalUrl || req.url,
    },
    firmId: admin.firmId,
    userXID: admin.xID,
    invitedEmail: emailService.maskEmail(normalizedEmail),
    inviteXID: xID,
  });
  log.info('ADMIN_INVITE_TOKEN_GENERATED', {
    req: {
      requestId: req.requestId || req.id || null,
      method: req.method,
      path: req.originalUrl || req.url,
    },
    firmId: admin.firmId,
    userXID: admin.xID,
    inviteXID: xID,
    inviteExpiry: tokenExpiry.toISOString(),
  });

  return inviteState;
};

const applySessionToQuery = (query, session) => {
  if (session && query && typeof query.session === 'function') {
    return query.session(session);
  }
  return query;
};

const findExistingInviteUser = async ({ firmId, normalizedEmail, session }) => {
  const query = User.findOne({
    firmId,
    email: normalizedEmail,
    status: { $ne: 'deleted' },
  });
  return await applySessionToQuery(query, session);
};

const resolveFirmPrimaryAdmin = async ({ firmId, session }) => {
  const query = User.findOne({
    firmId,
    role: 'PRIMARY_ADMIN',
    status: { $ne: 'deleted' },
  }).select('_id');
  const primaryAdmin = await applySessionToQuery(query, session);
  return primaryAdmin || null;
};

const buildInviteResponse = (user, { statusCode, message }) => ({
  statusCode,
  success: true,
  message,
  data: {
    xID: user.xID,
    name: user.name,
    email: user.email,
    role: user.role,
    allowedCategories: user.allowedCategories,
    passwordSet: user.passwordSet,
    status: user.status,
  },
});

const getLoginOtpConfig = () => (
  process.env.NODE_ENV === 'production'
    ? {
        expiryMinutes: 10,
        maxAttempts: 5,
        lockMinutes: 10,
        resendCooldownSeconds: 30,
        maxResends: 5,
      }
    : {
        expiryMinutes: 60,
        maxAttempts: 50,
        lockMinutes: 1,
        resendCooldownSeconds: 3,
        maxResends: 100,
      }
);

const getTwoFactorSecret = (user) => decryptProtectedValue(user?.twoFactorSecret);

const logLoginOtpEvent = (event, req, user, metadata = {}) => {
  log.info(event, {
    req: {
      requestId: req?.requestId || req?.id || null,
      method: req?.method,
      path: req?.originalUrl || req?.url,
    },
    userId: user?._id || null,
    userXID: user?.xID || null,
    email: user?.email || null,
    firmId: user?.firmId || null,
    firmSlug: req?.params?.firmSlug || req?.firmSlug || metadata.firmSlug || null,
    ...metadata,
  });
};

const persistLastSuccessfulLogin = async (req, user) => {
  if (!user) return;

  try {
    const loginState = {
      lastLoginAt: new Date(),
      lastLoginIp: getRequestIp(req),
      lastLoginCountry: getRequestCountry(req),
    };

    user.lastLoginAt = loginState.lastLoginAt;
    user.lastLoginIp = loginState.lastLoginIp;
    user.lastLoginCountry = loginState.lastLoginCountry;

    if (typeof user.save === 'function') {
      await user.save();
      return;
    }

    if (user._id && mongoose.connection?.readyState === 1) {
      await User.updateOne({ _id: user._id, firmId: user.firmId }, { $set: loginState });
    }
  } catch (error) {
    log.warn('AUTH_LAST_LOGIN_PERSIST_FAILED', {
      req: {
        requestId: req?.requestId || req?.id || null,
        method: req?.method,
        path: req?.originalUrl || req?.url,
      },
      userId: user?._id || null,
      firmId: user?.firmId || null,
      error: error.message,
    });
  }
};

const handleSuccessfulLoginMonitoring = async (req, user, { resource = 'auth/login', mfaRequired = false } = {}) => {
  if (!user) return;

  await noteSuccessfulLogin({
    req,
    userId: user._id,
    firmId: user.firmId || DEFAULT_FIRM_ID,
    xID: user.xID || DEFAULT_XID,
    lastLoginIp: user.lastLoginIp || null,
    lastLoginAt: user.lastLoginAt || null,
    lastLoginCountry: user.lastLoginCountry || null,
    resource,
    mfaRequired,
  });
  await persistLastSuccessfulLogin(req, user);
};

/**
 * Non-fatal auth audit logger. Audit failures must never break primary business
 * logic or change a successful HTTP response to 500.
 * Always uses explicit array syntax so no implicit wrapping is required.
 */
const logAuthAudit = async (params, req = null) => {
  try {
    await logAuthEvent({
      eventType: params?.actionType,
      actionType: params?.actionType,
      userId: params?.userId,
      firmId: params?.firmId,
      xID: params?.xID,
      performedBy: params?.performedBy,
      description: params?.description,
      req,
      metadata: params?.metadata,
      timestamp: params?.timestamp,
    });
  } catch (auditErr) {
    log.error('AUTH_AUDIT_FAILURE', {
      error: auditErr.message,
      stack: auditErr.stack,
      context: 'auth.controller',
    });
  }

  // SECURITY: Audit logging isolated to prevent auth outage
  try {
    await safeLogForensicAudit({
      tenantId: params?.firmId,
      entityType: 'AUTH',
      entityId: params?.userId || params?.xID || 'UNKNOWN',
      action: params?.actionType || 'AUTH_EVENT',
      performedBy: params?.performedBy || params?.xID || 'SYSTEM',
      performedByRole: params?.metadata?.performedByRole || null,
      impersonatedBy: params?.metadata?.impersonatedBy || null,
      ipAddress: params?.ipAddress || getRequestIp(req),
      userAgent: params?.userAgent || getRequestUserAgent(req),
      metadata: {
        description: params?.description || null,
        source: 'auth.controller.logAuthAudit',
        metadata: params?.metadata || null,
      },
    });
  } catch (err) {
    logger.warn('Forensic audit logging failed (non-fatal)', { error: err.message });
  }
};

const getSuperadminEnv = () => {
  return {
    rawXID: env.SUPERADMIN_XID,
    normalizedXID: env.SUPERADMIN_XID_NORMALIZED,
    email: env.SUPERADMIN_EMAIL_NORMALIZED,
  };
};

const createMfaPreAuthToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured for MFA pre-auth token signing');
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: PRE_AUTH_TOKEN_EXPIRY,
    // SECURITY: Explicit JWT algorithm allowlist
    algorithm: 'HS256',
  });
};

const generateLoginSessionToken = () => crypto.randomBytes(32).toString('hex');
const hashLoginSessionToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const FORGOT_PASSWORD_OTP_EXPIRY_MINUTES = 10;
const FORGOT_PASSWORD_OTP_LOCK_MINUTES = 10;
const FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS = 30;
const LOGIN_OTP_COOLDOWN_SECONDS = 30;
const loginOtpCacheFallback = new Map();

const clearLoginOtpState = (user) => {
  if (!user) return;
  user.loginOtpHash = null;
  user.loginOtpExpiresAt = null;
  user.loginOtpAttempts = 0;
  user.loginOtpLastSentAt = null;
  user.loginOtpResendCount = 0;
  user.loginOtpLockedUntil = null;
};

const clearForgotPasswordOtpState = (user) => {
  if (!user) return;
  user.forgotPasswordOtpHash = null;
  user.forgotPasswordOtpExpiresAt = null;
  user.forgotPasswordOtpAttempts = 0;
  user.forgotPasswordOtpLastSentAt = null;
  user.forgotPasswordOtpLockedUntil = null;
  user.forgotPasswordOtpResendCount = 0;
};

const persistLoginOtpState = async (user) => {
  if (!user) return;

  if (typeof user.save === 'function') {
    await user.save();
    return;
  }

  if (user._id && mongoose.connection?.readyState === 1) {
    await User.updateOne(
      { _id: user._id, firmId: user.firmId },
      {
        $set: {
          loginOtpHash: user.loginOtpHash || null,
          loginOtpExpiresAt: user.loginOtpExpiresAt || null,
          loginOtpAttempts: user.loginOtpAttempts || 0,
          loginOtpLastSentAt: user.loginOtpLastSentAt || null,
          loginOtpResendCount: user.loginOtpResendCount || 0,
          loginOtpLockedUntil: user.loginOtpLockedUntil || null,
        },
      }
    );
  }
};

const getLoginOtpLockSeconds = (user) => {
  const lockUntil = user?.loginOtpLockedUntil instanceof Date
    ? user.loginOtpLockedUntil
    : user?.loginOtpLockedUntil
      ? new Date(user.loginOtpLockedUntil)
      : null;

  if (!lockUntil || Number.isNaN(lockUntil.getTime())) {
    return 0;
  }

  return Math.max(0, Math.ceil((lockUntil.getTime() - Date.now()) / 1000));
};

const clearExpiredLoginOtpLock = async (user) => {
  if (!user?.loginOtpLockedUntil) {
    return;
  }

  const lockSeconds = getLoginOtpLockSeconds(user);
  if (lockSeconds > 0) {
    return;
  }

  user.loginOtpLockedUntil = null;
  user.loginOtpAttempts = 0;
  await persistLoginOtpState(user);
};

const getLoginOtpRedisKeys = (user) => {
  const userId = String(user?._id || '').trim();
  const firmId = String(user?.firmId || 'platform').trim();
  return {
    lockKey: `otp_lock:${firmId}:${userId}`,
    otpKey: `otp:${firmId}:${userId}`,
  };
};

const acquireLoginOtpCooldownLock = async (user) => {
  const { lockKey } = getLoginOtpRedisKeys(user);
  const token = crypto.randomUUID();
  const redis = getRedisClient();

  if (redis) {
    const response = await redis.set(lockKey, token, 'NX', 'EX', LOGIN_OTP_COOLDOWN_SECONDS);
    if (response === 'OK') {
      return { acquired: true, token, retryAfter: 0 };
    }

    const ttl = await redis.ttl(lockKey);
    return {
      acquired: false,
      retryAfter: Number.isFinite(ttl) && ttl > 0 ? ttl : LOGIN_OTP_COOLDOWN_SECONDS,
    };
  }

  const now = Date.now();
  const current = loginOtpCacheFallback.get(lockKey);
  if (current && current.expiresAt > now) {
    return {
      acquired: false,
      retryAfter: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    };
  }

  loginOtpCacheFallback.set(lockKey, {
    token,
    expiresAt: now + (LOGIN_OTP_COOLDOWN_SECONDS * 1000),
  });
  return { acquired: true, token, retryAfter: 0 };
};

const cacheLoginOtpState = async (user, { otpHash, otpExpiresAt }) => {
  const { otpKey } = getLoginOtpRedisKeys(user);
  const redis = getRedisClient();
  const payload = JSON.stringify({
    otpHash,
    otpExpiresAt: otpExpiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  });

  const otpTtlSeconds = Math.max(1, Math.ceil((otpExpiresAt.getTime() - Date.now()) / 1000));

  if (redis) {
    await redis.set(otpKey, payload, 'EX', otpTtlSeconds);
    return;
  }

  loginOtpCacheFallback.set(otpKey, {
    value: payload,
    expiresAt: otpExpiresAt.getTime(),
  });
};

const clearCachedLoginOtpState = async (user) => {
  const { lockKey, otpKey } = getLoginOtpRedisKeys(user);
  const redis = getRedisClient();
  if (redis) {
    await redis.del(lockKey, otpKey);
    return;
  }

  loginOtpCacheFallback.delete(lockKey);
  loginOtpCacheFallback.delete(otpKey);
};

/**
 * Generate a refresh token, hash it for storage, persist with expiry, and return the raw token.
 * @param {Object} params
 * @param {Object} params.req
 * @param {string|null} params.userId User id or null for SuperAdmin
 * @param {string|null} params.firmId Firm id or null for platform scope
 * @returns {Promise<{refreshToken: string, expiresAt: Date}>} Raw refresh token (unhashed) and its expiry timestamp
 * @throws {Error} When request context is missing or refresh token persistence fails
 */
const generateAndStoreRefreshToken = async ({ req, userId = null, firmId = null }) => authSessionService.generateAndStoreRefreshToken({ req, userId, firmId });

/**
 * Build tokens + audit entry for successful login
 * OBJECTIVE 2: Ensure firm context (firmId, firmSlug, defaultClientId) is always in JWT
 */
const buildTokenResponse = async (user, req, authMethod = 'Password') => {
  if (user?.role !== ROLE_SUPER_ADMIN && user?.firmId) {
    await ensureUserDefaultClientLink(user, req);
  }

  const tenantContext = await resolveCanonicalTenantForUser(user);
  const runtimeTenantId = tenantContext?.tenantId || (user.firmId ? String(user.firmId) : null);
  const firmSlug = tenantContext?.firmSlug || null;

  // OBJECTIVE 2: Include ALL firm context in JWT token
  await ensureCanonicalXid(user);

  const accessToken = jwtService.generateAccessToken({
    userId: user._id.toString(),
    firmId: runtimeTenantId || undefined,
    firmSlug: firmSlug || undefined, // NEW: Include firmSlug in token
    defaultClientId: tenantContext?.defaultClientId || (user.defaultClientId ? user.defaultClientId.toString() : undefined),
    role: user.role,
  });

  const { refreshToken } = await generateAndStoreRefreshToken({
    userId: user._id,
    firmId: runtimeTenantId || null,
    req,
  });

  await logAuthAudit({
    xID: user.xID || DEFAULT_XID,
    firmId: user.firmId || DEFAULT_FIRM_ID,
    userId: user._id,
    actionType: 'Login',
    description: `User logged in via ${authMethod}`,
    performedBy: user.xID,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }, req);

  return { accessToken, refreshToken, firmSlug };
};

const sendLoginOtpChallenge = async (req, user, { isResend = false, returnLoginToken = true } = {}) => {
  const otpConfig = getLoginOtpConfig();
  const lockResult = await acquireLoginOtpCooldownLock(user);
  if (!lockResult.acquired) {
    const conflictError = new Error('LOGIN_OTP_COOLDOWN_ACTIVE');
    conflictError.code = 'LOGIN_OTP_COOLDOWN_ACTIVE';
    conflictError.retryAfter = lockResult.retryAfter;
    throw conflictError;
  }

  const otp = authOtpService.generateOtp();
  logLoginOtpEvent('OTP_GENERATED', req, user, {
    expiryMinutes: otpConfig.expiryMinutes,
    resend: isResend,
  });

  const otpHash = await authOtpService.hashOtp(otp, SALT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + otpConfig.expiryMinutes * 60 * 1000);

  user.loginOtpHash = otpHash;
  user.loginOtpExpiresAt = otpExpiresAt;
  user.loginOtpAttempts = 0;
  user.loginOtpLastSentAt = new Date();
  user.loginOtpLockedUntil = null;
  user.loginOtpResendCount = isResend
    ? Number(user.loginOtpResendCount || 0) + 1
    : 0;
  await persistLoginOtpState(user);
  await cacheLoginOtpState(user, { otpHash, otpExpiresAt });

  try {
    await emailService.sendLoginOtpEmail({
      email: user.email,
      name: user.name,
      otp,
      firmName: req.firmName || req.firm?.name || null,
      firmSlug: req.params?.firmSlug || req.firmSlug || null,
      expiryMinutes: otpConfig.expiryMinutes,
    });
    logLoginOtpEvent('OTP_EMAIL_QUEUED', req, user, {
      expiryMinutes: otpConfig.expiryMinutes,
      resend: isResend,
      resendCount: user.loginOtpResendCount || 0,
    });
  } catch (error) {
    clearLoginOtpState(user);
    await persistLoginOtpState(user);
    await clearCachedLoginOtpState(user);
    throw error;
  }

  await logAuthAudit({
    xID: user.xID || DEFAULT_XID,
    firmId: user.firmId || DEFAULT_FIRM_ID,
    userId: user._id,
    actionType: 'OTP_SENT',
    description: 'Login OTP sent to user email after password verification',
    performedBy: user.xID || DEFAULT_XID,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: {
      eventType: 'OTP_SENT',
      firmSlug: req.params?.firmSlug || req.firmSlug || null,
      expiresInMinutes: otpConfig.expiryMinutes,
      email: user.email || null,
      resend: isResend,
      resendCount: user.loginOtpResendCount || 0,
      timestamp: new Date().toISOString(),
    },
  }, req);

  if (!returnLoginToken) {
    return null;
  }

  const loginToken = generateLoginSessionToken();
  const tokenHash = hashLoginSessionToken(loginToken);
  await LoginSession.deleteMany({ userId: user._id, consumedAt: null });
  await LoginSession.create({
    tokenHash,
    userId: user._id,
    firmId: user.firmId,
    xID: user.xID,
    expiresAt: new Date(Date.now() + otpConfig.expiryMinutes * 60 * 1000),
    consumedAt: null,
  });

  return loginToken;
};

const findTenantUserForOtp = async ({ xID, firmSlug }) => {
  const normalizedXID = String(xID || '').trim().toUpperCase();
  const normalizedFirmSlug = normalizeFirmSlug(firmSlug);

  if (!normalizedXID || !normalizedFirmSlug) {
    return { user: null, firm: null, normalizedXID, normalizedFirmSlug };
  }

  const firm = await Firm.findOne({ firmSlug: normalizedFirmSlug, status: 'active' });
  if (!firm?._id) {
    return { user: null, firm: null, normalizedXID, normalizedFirmSlug };
  }

  const user = await User.findOne({
    firmId: firm._id,
    xID: normalizedXID,
    status: 'active',
    isActive: true,
  });

  return { user, firm, normalizedXID, normalizedFirmSlug };
};

const buildSuccessfulLoginPayload = async (req, user, { authMethod = 'Email OTP', resource = 'auth/verify-otp', mfaRequired = true } = {}) => {
  const { accessToken, refreshToken, firmSlug } = await buildTokenResponse(user, req, authMethod);

  await handleSuccessfulLoginMonitoring(req, user, {
    resource,
    mfaRequired,
  });
  await logSecurityAuditEvent({
    req,
    action: SECURITY_AUDIT_ACTIONS.LOGIN_SUCCESS,
    resource,
    userId: user._id,
    firmId: user.firmId || DEFAULT_FIRM_ID,
    xID: user.xID || DEFAULT_XID,
    performedBy: user.xID || DEFAULT_XID,
    metadata: {
      email: user.email || null,
      mfaRequired,
    },
    description: `User login completed successfully via ${authMethod}`,
  }).catch(() => null);

  const redirectTo = isSuperAdminRole(user.role)
    ? '/app/superadmin'
    : (firmSlug ? `/app/firm/${firmSlug}/dashboard` : '/complete-profile');
  const response = {
    success: true,
    message: user.forcePasswordReset ? 'Password reset required' : 'Login successful',
    accessToken,
    refreshToken,
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
    redirectTo,
  };

  if (user.forcePasswordReset) {
    response.mustChangePassword = true;
    response.forcePasswordReset = true;
  }

  return response;
};

/**
 * Login with xID and password
 * POST /superadmin/login or POST /:firmSlug/login
 */

const handleSuperadminLogin = async (req, res, normalizedXID, password, loginScope) => {
  const { rawXID: superadminXIDRaw, normalizedXID: superadminXID, email: superadminEmail } = getSuperadminEnv();

  if (loginScope !== 'superadmin') {
    return res.status(401).json({ success: false, message: 'Invalid xID or password' });
  }
  log.info('[AUTH][superadmin] login attempt', { xID: normalizedXID });

  const superadminPasswordHash = process.env.SUPERADMIN_PASSWORD_HASH;
  if (!superadminPasswordHash) {
    log.error('[AUTH][superadmin] SUPERADMIN_PASSWORD_HASH not configured in environment');
    return res.status(500).json({
      success: false,
      message: 'SuperAdmin authentication not configured',
    });
  }

  const isSuperadminPasswordValid = await bcrypt.compare(password, superadminPasswordHash);

  if (!isSuperadminPasswordValid) {
    await recordFailedLoginAttempt(req);
    log.warn('[AUTH][superadmin] SuperAdmin login failed - invalid credentials');
    await logAuthAudit({
      xID: normalizedXID || DEFAULT_XID,
      firmId: DEFAULT_FIRM_ID,
      actionType: 'LoginFailed',
      description: 'SuperAdmin login failed: invalid credentials',
      performedBy: normalizedXID || DEFAULT_XID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { eventType: 'LOGIN_FAILED', email: superadminEmail || null, timestamp: new Date().toISOString() },
    }, req);
    return res.status(401).json({
      success: false,
      message: 'Invalid xID or password',
    });
  }

  log.info('[AUTH][superadmin] SuperAdmin login successful');
  await clearFailedLoginAttempts(req);
  await logAuthAudit({
    xID: normalizedXID || DEFAULT_XID,
    firmId: DEFAULT_FIRM_ID,
    actionType: 'LOGIN_SUCCESS',
    description: 'SuperAdmin login successful',
    performedBy: normalizedXID || DEFAULT_XID,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { eventType: 'LOGIN_SUCCESS', email: superadminEmail || null, timestamp: new Date().toISOString() },
  }, req);

  const user = {
    id: SUPERADMIN_USER_ID(),
    xID: superadminXIDRaw || 'SUPERADMIN',
    email: superadminEmail,
    role: SUPERADMIN_ROLE,
    firmId: null,
    isSuperAdmin: true,
  };

  try {
    log.info('[DEBUG] user object:', user);

    const accessToken = jwtService.generateAccessToken({
      userId: user.id,
      role: user.role,
      firmId: user.firmId,
      firmSlug: null,
      defaultClientId: null,
      isSuperAdmin: user.isSuperAdmin,
    });
    authSessionService.setAuthCookies(res, { accessToken });

    return res.json({
      success: true,
      message: 'Login successful',
      isSuperAdmin: true,
      refreshEnabled: false,
      data: user,
      redirectTo: '/app/superadmin',
    });
  } catch (postAuthError) {
    log.error('[AUTH][superadmin] Post-auth token/response failure', {
      message: postAuthError.message,
      xID: normalizedXID || DEFAULT_XID,
    });
    return res.status(500).json({
      success: false,
      message: 'Authentication succeeded but response generation failed',
    });
  }
};

const validateTenantUserPreconditions = async (req, res, user, requestedFirmSlug, normalizedXID) => {
  const loginScope = req.loginScope || 'tenant';
  if (!user || !isActiveStatus(user.status)) {
    await recordFailedLoginAttempt(req);
    log.warn(`[AUTH] Invalid login attempt for xID=${normalizedXID} in firm context ${req.firmSlug || req.firmId}`);
    try {
      await logAuthAudit({
        xID: normalizedXID || 'UNKNOWN',
        firmId: req.firmIdString || req.firmId || 'UNKNOWN',
        actionType: 'LoginFailed',
        description: `Login failed: invalid credentials (xID: ${normalizedXID}, firmSlug: ${requestedFirmSlug || 'none'})`,
        performedBy: normalizedXID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          eventType: 'LOGIN_FAILED',
          email: null,
          timestamp: new Date().toISOString(),
        },
      }, req);
      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.LOGIN_FAILURE,
        resource: 'auth/login',
        firmId: req.firmIdString || req.firmId || 'UNKNOWN',
        xID: normalizedXID || 'UNKNOWN',
        performedBy: normalizedXID || 'UNKNOWN',
        metadata: {
          reason: 'invalid_credentials',
          loginScope,
        },
        description: 'Login failed due to invalid credentials',
      }).catch(() => null);
      await noteLoginFailure({
        req,
        xID: normalizedXID || 'UNKNOWN',
        firmId: req.firmIdString || req.firmId || null,
      });
    } catch (auditError) {
      log.error('[AUTH AUDIT] Failed to record login failure event', auditError);
    }
    res.status(401).json({
      success: false,
      message: 'Invalid xID or password',
    });
    return true;
  }

  if (user.role !== 'SUPER_ADMIN') {
    const firmCount = await Firm.countDocuments();
    if (firmCount === 0) {
      log.warn(`[AUTH] Login blocked for ${user.xID} - system not initialized (no firms exist)`);
      res.status(403).json({
        success: false,
        message: 'System not initialized. Contact SuperAdmin.',
      });
      return true;
    }
  }

  if (!isSuperAdminRole(user.role) && !user.firmId) {
    log.error(`[AUTH] User ${user.xID} missing firmId - login rejected`);
    res.status(403).json({
      success: false,
      message: 'Account is not linked to a firm. Please complete onboarding or contact administrator.',
    });
    return true;
  }

  if (user.role === ROLE_ADMIN) {
    log.info(`[AUTH] Admin ${user.xID} validation - firmId: ${user.firmId}, defaultClientId: ${user.defaultClientId}`);
    try {
      await ensureUserDefaultClientLink(user, req);
    } catch (defaultClientError) {
      log.error(`[AUTH] Failed to enforce default client invariant for ${user.xID}:`, defaultClientError.message);
      res.status(500).json({
        success: false,
        message: 'Account configuration error. Please contact administrator.',
      });
      return true;
    }
  }

  if (!isActiveStatus(user.status)) {
    res.status(403).json({
      success: false,
      message: 'Please complete your account setup using the invite link sent to your email',
      accountStatus: user.status,
    });
    return true;
  }

  if (user.isLocked) {
    await noteLockedAccountAttempt({
      req,
      userId: user._id,
      firmId: user.firmId || DEFAULT_FIRM_ID,
      xID: user.xID,
    });
    const retryAfter = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(403).json({
      success: false,
      error: 'ACCOUNT_TEMP_LOCKED',
      retryAfter,
    });
    return true;
  }

  const passwordSetupRequired = user.mustChangePassword || user.mustSetPassword;
  if (passwordSetupRequired || !user.passwordHash) {
    res.status(403).json({
      success: false,
      code: 'PASSWORD_SETUP_REQUIRED',
      message: 'Please set your password using the link sent to your email',
      mustSetPassword: true,
      redirectPath: '/auth/setup-account',
    });
    return true;
  }

  return false;
};

const handlePasswordVerification = async (req, res, user, password) => {
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    await recordFailedLoginAttempt(req);
    const lockUntilAt = new Date(Date.now() + LOCK_TIME);

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, firmId: user.firmId },
      [
        {
          $set: {
            failedLoginAttempts: {
              $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1],
            },
            lockUntil: {
              $let: {
                vars: {
                  nextFailedAttempts: {
                    $add: [{ $ifNull: ['$failedLoginAttempts', 0] }, 1],
                  },
                },
                in: {
                  $cond: [
                    { $gte: ['$$nextFailedAttempts', MAX_FAILED_ATTEMPTS] },
                    { $ifNull: ['$lockUntil', lockUntilAt] },
                    '$lockUntil',
                  ],
                },
              },
            },
          },
        },
      ],
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      res.status(401).json({
        success: false,
        message: 'Invalid xID or password',
      });
      return false;
    }

    const currentFailedAttempts = updatedUser.failedLoginAttempts || 0;
    const isNowLocked = updatedUser.lockUntil && new Date(updatedUser.lockUntil) > new Date();

    if (isNowLocked && currentFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      try {
        await logAuthAudit({
          xID: user.xID,
          firmId: user.firmId || DEFAULT_FIRM_ID,
          userId: user._id,
          actionType: 'AccountLocked',
          description: `Account locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts`,
          performedBy: user.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }, req);
      } catch (auditError) {
        log.error('[AUTH AUDIT] Failed to record account lock event', auditError);
      }

      res.status(403).json({
        success: false,
        error: 'ACCOUNT_TEMP_LOCKED',
        retryAfter: config.security.rateLimit.accountLockSeconds,
      });
      return false;
    }

    try {
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'LOGIN_FAILED',
        description: `Login failed: Invalid password (attempt ${currentFailedAttempts})`,
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          eventType: 'LOGIN_FAILED',
          email: user.email || null,
          timestamp: new Date().toISOString(),
        },
      }, req);
      await logSecurityAuditEvent({
        req,
        action: SECURITY_AUDIT_ACTIONS.LOGIN_FAILURE,
        resource: 'auth/login',
        userId: user._id,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        xID: user.xID,
        performedBy: user.xID,
        metadata: {
          reason: 'invalid_password',
          failedAttempts: currentFailedAttempts,
        },
        description: `Login failed: invalid password (attempt ${currentFailedAttempts})`,
      }).catch(() => null);
      await noteLoginFailure({
        req,
        xID: user.xID,
        userId: user._id,
        firmId: user.firmId || DEFAULT_FIRM_ID,
      });
    } catch (auditError) {
      log.error('[AUTH AUDIT] Failed to record login failure event', auditError);
    }

    res.status(401).json({
      success: false,
      message: 'Invalid xID or password',
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - currentFailedAttempts),
    });
    return false;
  }

  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }
  await clearFailedLoginAttempts(req);
  return true;
};

const handlePostPasswordChecks = async (req, res, user) => {
  const now = new Date();
  if (user.passwordExpiresAt && user.passwordExpiresAt < now) {
    try {
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'PasswordExpired',
        description: `Login attempt with expired password`,
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);
    } catch (auditError) {
      log.error('[AUTH AUDIT] Failed to record password expiry event', auditError);
    }

    res.status(403).json({
      success: false,
      message: 'Password has expired. Please change your password.',
      mustChangePassword: true,
    });
    return true;
  }

  if (user.forcePasswordReset) {
    log.info(`[AUTH] First login detected for user ${user.xID}, generating password reset token`);

    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    log.info('PASSWORD RESET LINK:', resetUrl);

    if (!process.env.FRONTEND_URL) {
      log.warn('[AUTH] FRONTEND_URL not configured. Using default http://localhost:3000.');
    }
    
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = tokenExpiry;

    try {
      await user.save();
    } catch (saveError) {
      log.error('[AUTH] Failed to save password reset token:', saveError.message);
    }
    
    let emailSent = false;
    try {
      const emailResult = await emailService.sendPasswordResetEmail(user.email, user.name, token);
      emailSent = emailResult.success;
      if (emailSent) {
        log.info(`[AUTH] Password reset email sent successfully`);
      } else {
        log.error(`[AUTH] Password reset email failed:`, emailResult.error);
      }
    } catch (emailError) {
      log.error('[AUTH] Failed to send password reset email:', emailError.message);
    }

    try {
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId || DEFAULT_FIRM_ID,
        userId: user._id,
        actionType: 'PasswordResetEmailSent',
        description: emailSent
          ? 'Password reset email sent on first login'
          : 'Password reset email failed to send on first login',
        performedBy: user.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }, req);
    } catch (auditError) {
      log.error('[AUTH AUDIT] Failed to record password reset email event', auditError);
    }
  }
  return false;
};

/**
 * Login with xID and password
 * POST /superadmin/login or POST /:firmSlug/login
 */
const login = async (req, res) => applyServiceResponse(res, await authLoginService.login({ req }));

const resendLoginOtp = async (req, res) => authLoginService.resendLoginOtp(req, res);

const verifyLoginOtp = async (req, res) => authLoginService.verifyLoginOtp(req, res);

/**
 * Logout
 * POST /api/auth/logout
 */
const logout = async (req, res) => applyServiceResponse(res, await authSessionService.logout({ req }));

/**
 * Change password
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required',
      });
    }
    if (!validatePasswordStrength(newPassword)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_POLICY_MESSAGE,
      });
    }
    
    // Get user from authenticated request
    const user = req.user;

    // Onboarding guard: changePassword is for onboarded users only
    // DO NOT gate on passwordSet; mustSetPassword is authoritative.
    if (user.mustSetPassword) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_SETUP_REQUIRED',
        mustSetPassword: true,
        redirectPath: '/auth/setup-account',
      });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }
    
    // Check if new password matches any of the last 5 passwords
    const passwordHistory = user.passwordHistory || [];
    const passwordHistorySlice = passwordHistory.slice(-PASSWORD_HISTORY_LIMIT);
    const passwordHistoryResults = await Promise.all(
      passwordHistorySlice.map((oldPassword) => bcrypt.compare(newPassword, oldPassword.hash))
    );

    if (passwordHistoryResults.includes(true)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reuse any of your last 5 passwords',
      });
    }
    
    // Check if new password is same as current
    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Add current password to history
    user.passwordHistory.push({
      hash: user.passwordHash,
      changedAt: new Date(),
    });
    
    // Keep only last 5 passwords in history
    if (user.passwordHistory.length > PASSWORD_HISTORY_LIMIT) {
      user.passwordHistory = user.passwordHistory.slice(-PASSWORD_HISTORY_LIMIT);
    }
    
    // Update password
    user.passwordHash = newPasswordHash;
    user.passwordLastChangedAt = new Date();
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000); // Update expiry on password change
    user.mustChangePassword = false;
    user.mustSetPassword = false; // Keep onboarding flag aligned after a successful rotation
    user.passwordSetAt = new Date();
    
    await user.save();
    
    // Revoke all refresh tokens for security (force re-login)
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true }
    );
    
    // Log password change
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'PasswordChanged',
      description: `User changed their password`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    await logSecurityAuditEvent({
      req,
      action: SECURITY_AUDIT_ACTIONS.PASSWORD_CHANGE,
      resource: 'auth/change-password',
      userId: user._id,
      firmId: user.firmId,
      xID: user.xID,
      performedBy: user.xID,
      description: 'User changed their password',
    }).catch(() => null);
    
    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    log.error('[AUTH] Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
    });
  }
};

/**
 * Reset password (Admin only) - Sends password setup email
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { xID } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user to reset
    const lookupQuery = { xID: xID.toUpperCase() };
    if (!isSuperAdminRequest(req)) {
      lookupQuery.firmId = getRequestFirmId(req);
    }
    const user = await User.findOne(lookupQuery);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Generate new secure password setup token
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + PASSWORD_SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Reset password state (put user back into invite-like state)
    user.passwordHash = null;
    user.passwordSet = false;
    user.passwordSetupTokenHash = tokenHash;
    user.passwordSetupExpires = tokenExpiry;
    user.mustChangePassword = true;
    user.mustSetPassword = false;
    user.passwordExpiresAt = null; // Clear expiry until password is set
    user.status = 'invited'; // User must set password to become active again
    user.isActive = false;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.passwordSetAt = null;
    
    await user.save();
    
    // Fetch firmSlug for email
    let firmSlug = null;
    if (user.firmId) {
      const firm = await Firm.findById(user.firmId);
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Send password setup email with xID
    try {
      const emailResult = await emailService.sendPasswordSetupEmail({
        email: user.email,
        name: user.name,
        token: token,
        xID: user.xID,
        firmSlug: firmSlug, // Pass firmSlug for firm-specific URL in email
        role: user.role,
        req,
      });

      if (!emailResult.success) {
        log.warn('[AUTH] Password setup email not sent:', emailResult.error);
      }
      
      // Log password setup email sent
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'PasswordSetupEmailSent',
        description: emailResult.success 
          ? `Password reset email sent to ${emailService.maskEmail(user.email)}` 
          : `Password reset email failed to send to ${emailService.maskEmail(user.email)}: ${emailResult.error}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (emailError) {
      log.warn('[AUTH] Failed to send password setup email:', emailError.message);
      // Continue even if email fails
    }
    
    // Log password reset
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'PasswordResetByAdmin',
      description: `Password reset by admin - setup email sent`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        resetBy: admin.xID,
      },
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully. User will receive an email with setup instructions.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
    });
  }
};

/**
 * Get user profile
 * GET /api/auth/profile
 * 
 * PR 32: Returns immutable fields (xID, name, email) from User model
 * and editable personal info from UserProfile model
 * 
 * SUPERADMIN HANDLING: Short-circuits for SuperAdmin before any DB operations
 * SuperAdmin has no firm and no DB-backed user record.
 */
const getProfile = async (req, res) => {
  try {
    // Get authenticated request user snapshot (plain object from middleware)
    const requestUser = req.user;
    
    // 1️⃣ IDENTIFY SUPERADMIN (defensive - check all signals)
    // Check multiple signals to ensure SuperAdmin is detected in all cases
    const isSuperAdmin = 
      isSuperAdminRole(requestUser?.role) ||    // Check user role
      req.jwt?.isSuperAdmin === true ||          // Check JWT flag
      isSuperAdminRole(req.jwt?.role) ||         // Check JWT role (handles all variants)
      requestUser?.isSuperAdmin === true;        // Check user flag
    
    // 2️⃣ SHORT-CIRCUIT before any firm logic, DB operations, or transactions
    if (isSuperAdmin) {
      const { rawXID: superadminXIDRaw, email: superadminEmail } = getSuperadminEnv();
      return res.json({
        success: true,
        data: {
          id: SUPERADMIN_USER_ID(),
          xID: superadminXIDRaw || 'SUPERADMIN',
          name: 'SuperAdmin',
          email: superadminEmail,
          role: req.jwt?.role || SUPERADMIN_ROLE,
          firm: null,
          firmId: null,
          firmSlug: null,
          defaultClientId: null,
          isSuperAdmin: true,
          refreshEnabled: false,
          permissions: ['*'],
        },
        redirectTo: '/app/superadmin',
      });
    }
    
    // Always fetch a fresh DB user for profile hydration and consistency.
    // Never mutate/populate req.user (middleware snapshot).
    const dbUser = await User.findById(requestUser?._id)
      .populate('firmId', 'firmId name firmSlug');

    if (!dbUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session. Please log in again.',
      });
    }

    const userFirmId = dbUser?.firmId?._id?.toString() || null;
    if (!userFirmId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session. Please log in again.',
      });
    }

    // Harden profile fetch: heal missing/stale default-client linkage without middleware writes.
    try {
      await ensureUserDefaultClientLink(dbUser, req);
    } catch (defaultClientError) {
      log.error('[AUTH] Failed to self-heal default client during profile fetch:', defaultClientError.message);
      return res.status(503).json({
        success: false,
        message: 'Unable to resolve account context. Please try again.',
      });
    }
    
    // Get profile info
    let profile = await UserProfile.findOne({ xID: dbUser.xID });
    
    // If profile doesn't exist, create empty one
    if (!profile) {
      profile = {
        xID: dbUser.xID,
        dob: null,
        dateOfBirth: null,
        gender: null,
        phone: null,
        address: '',
        pan: null,
        panMasked: null,
        aadhaar: null,
        aadhaarMasked: null,
        email: null,
      };
    }
    
    const latestUpdate = await getLatestPublishedUpdate();
    const shouldShowWhatsNew = Boolean(
      latestUpdate?._id
      && String(dbUser.lastSeenUpdateId || '') !== String(latestUpdate._id || ''),
    );

    const normalizedTutorialRole = normalizeRole(dbUser.role);
    const tutorialRole = normalizedTutorialRole === 'SUPER_ADMIN'
      ? 'super_admin'
      : (normalizedTutorialRole === 'PRIMARY_ADMIN'
        ? 'primary_admin'
        : (normalizedTutorialRole === 'ADMIN'
          ? 'admin'
          : (normalizedTutorialRole === 'MANAGER' ? 'manager' : 'user')));

    const tutorialStepMap = {
      super_admin: [
        'Review platform health and tenant activity without editing firm operations unless needed.',
        'Use Firms Management for support diagnostics and controlled intervention.',
        'Capture support actions clearly to preserve auditability and trust.',
      ],
      primary_admin: [
        'Complete firm profile, storage/BYOS setup, and work settings before scaling operations.',
        'Invite admins, managers, and users with clear reporting hierarchy.',
        'Create clients, categories, sub-categories, and workbaskets including QC mapping.',
        'Launch a real docket and validate end-to-end workflow plus audit visibility.',
      ],
      admin: [
        'Review assigned teams and active workbasket coverage.',
        'Route unassigned or pending dockets to the right owners quickly.',
        'Monitor compliance deadlines and resolve operational bottlenecks daily.',
      ],
      manager: [
        'Open operational queues and identify blocked or overdue dockets first.',
        'Validate workload distribution and team handoffs across workbaskets.',
        'Use QC review paths to maintain quality before completion.',
      ],
      user: [
        'Start in My Worklist and prioritize overdue or due-soon dockets.',
        'Update status, comments, and document requests so next handoff is clean.',
        'Use categories/sub-categories correctly for clear reporting and audits.',
      ],
    };

    const tutorialSteps = tutorialStepMap[tutorialRole] || tutorialStepMap.user;

    const resolvedTeamIds = Array.isArray(dbUser.teamIds) && dbUser.teamIds.length > 0
      ? dbUser.teamIds.map((entry) => String(entry))
      : (dbUser.teamId ? [String(dbUser.teamId)] : []);

    const mappedWorkbaskets = resolvedTeamIds.length > 0
      ? await Team.find({
          _id: { $in: resolvedTeamIds },
          firmId: userFirmId,
        })
          .select('_id name type parentWorkbasketId')
          .lean()
      : [];

    const workbasketLookup = new Map(mappedWorkbaskets.map((workbasket) => [String(workbasket._id), workbasket]));
    const orderedAll = resolvedTeamIds
      .map((id) => workbasketLookup.get(String(id)))
      .filter(Boolean);

    const orderedWorkbaskets = orderedAll
      .filter((workbasket) => String(workbasket.type || 'PRIMARY').toUpperCase() !== 'QC')
      .map((workbasket) => ({
        id: String(workbasket._id),
        name: String(workbasket.name || '').trim(),
      }))
      .filter((workbasket) => workbasket.name);

    const orderedQcWorkbaskets = orderedAll
      .filter((workbasket) => String(workbasket.type || '').toUpperCase() === 'QC')
      .map((workbasket) => ({
        id: String(workbasket._id),
        name: String(workbasket.name || '').trim(),
        parentWorkbasketId: workbasket.parentWorkbasketId ? String(workbasket.parentWorkbasketId) : null,
      }))
      .filter((workbasket) => workbasket.name);

    const resolvedFirmSlug = req.jwt?.firmSlug || dbUser.firmId?.firmSlug || null;

    res.json({
      success: true,
      data: {
        id: dbUser._id.toString(),
        // Immutable fields from User model (read-only)
        xID: dbUser.xID,
        name: dbUser.name,
        email: dbUser.email, // Email from User model is immutable
        role: dbUser.role,
        mustSetPassword: !!dbUser.mustSetPassword,
        passwordSetAt: dbUser.passwordSetAt,
        allowedCategories: dbUser.allowedCategories,
        isActive: dbUser.isActive,
        teamId: resolvedTeamIds[0] || null,
        teamIds: orderedAll.map((workbasket) => String(workbasket._id)),
        teamNames: orderedAll.map((workbasket) => String(workbasket.name || '').trim()),
        workbaskets: orderedWorkbaskets,
        qcWorkbaskets: orderedQcWorkbaskets,
        // OBJECTIVE 2: Include firm context (JWT-first approach)
        // Use JWT claims as primary source, DB as fallback for display
        // Firm metadata (read-only, admin-controlled)
        firm: dbUser.firmId ? {
          id: dbUser.firmId._id.toString(),
          firmId: dbUser.firmId.firmId,
          name: dbUser.firmId.name,
        } : null,
        firmId: userFirmId,
        firmSlug: resolvedFirmSlug, // JWT-first: use token claim, fallback to DB
        defaultClientId: req.jwt?.defaultClientId || (dbUser.defaultClientId ? dbUser.defaultClientId.toString() : null), // JWT-first
        // Mutable fields from UserProfile model (editable)
        dateOfBirth: profile.dob || profile.dateOfBirth,
        gender: profile.gender,
        phone: profile.phone,
        address: typeof profile.address === 'string' ? profile.address : '',
        panMasked: profile.pan || profile.panMasked,
        aadhaarMasked: profile.aadhaar || profile.aadhaarMasked,
        welcomeTutorial: {
          show: shouldShowWelcomeTutorial(dbUser),
          role: tutorialRole,
          status: getTutorialStatus(dbUser),
          steps: tutorialSteps,
        },
        whatsNew: {
          show: shouldShowWhatsNew,
          update: latestUpdate || null,
        },
      },
      redirectTo: resolvedFirmSlug ? `/app/firm/${resolvedFirmSlug}/dashboard` : '/complete-profile',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 * 
 * PR 32: Only allows updating personal info fields
 * Immutable fields (xID, name, email from User model) are rejected if provided
 * PAN/Aadhaar must be masked format only
 */
const updateProfile = async (req, res) => {
  try {
    const { dateOfBirth, dob, gender, phone, address, panMasked, pan, aadhaarMasked, aadhaar, 
            name, email, xID, firmId } = req.body;
    
    // PR 32: Block attempts to modify immutable fields
    if (name !== undefined || email !== undefined || xID !== undefined || firmId !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify immutable fields (name, email, xID, firmId). These fields are read-only.',
      });
    }
    
    // Get user from authenticated request
    const user = req.user;
    
    // Users can only edit their own profile
    if (req.params.xID && req.params.xID !== user.xID) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own profile',
      });
    }
    
    // Find or create profile
    let profile = await UserProfile.findOne({ xID: user.xID });
    
    const oldProfile = profile ? { ...profile.toObject() } : {};
    
    if (!profile) {
      profile = new UserProfile({ xID: user.xID });
    }
    
    // Update only editable fields
    // Support both dob and dateOfBirth (aliases)
    if (dateOfBirth !== undefined) profile.dob = dateOfBirth;
    if (dob !== undefined) profile.dob = dob;
    if (gender !== undefined) profile.gender = gender;
    if (phone !== undefined) profile.phone = phone;
    if (address !== undefined) profile.address = address;
    
    // Handle PAN (support both pan and panMasked)
    // PR 32: Enforce masked format only (no raw PAN storage)
    if (panMasked !== undefined || pan !== undefined) {
      const panValue = panMasked !== undefined ? panMasked : pan;
      
      // Validate masked format: ABCDE1234F (10 characters, uppercase)
      if (panValue && panValue.trim()) {
        const maskedPanRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
        if (!maskedPanRegex.test(panValue.toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid PAN format. Must be in format: ABCDE1234F (masked)',
          });
        }
        profile.pan = panValue.toUpperCase();
      } else {
        profile.pan = panValue;
      }
    }
    
    // Handle Aadhaar (support both aadhaar and aadhaarMasked)
    // PR 32: Enforce masked format only (no raw Aadhaar storage)
    if (aadhaarMasked !== undefined || aadhaar !== undefined) {
      const aadhaarValue = aadhaarMasked !== undefined ? aadhaarMasked : aadhaar;
      
      // Validate masked format: XXXX-XXXX-1234 or last 4 digits only
      if (aadhaarValue && aadhaarValue.trim()) {
        // Accept formats: XXXX-XXXX-1234, XXXXXXXX1234, or just 1234 (last 4 digits)
        const maskedAadhaarRegex = /^(X{4}-X{4}-\d{4}|X{8}\d{4}|\d{4})$/;
        if (!maskedAadhaarRegex.test(aadhaarValue)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid Aadhaar format. Must be masked: XXXX-XXXX-1234 or last 4 digits only',
          });
        }
        profile.aadhaar = aadhaarValue;
      } else {
        profile.aadhaar = aadhaarValue;
      }
    }
    
    await profile.save();
    
    // Log profile update with old and new values
    const changes = {};
    if (dateOfBirth !== undefined || dob !== undefined) {
      changes.dateOfBirth = { old: oldProfile.dob, new: profile.dob };
    }
    if (gender !== undefined) changes.gender = { old: oldProfile.gender, new: gender };
    if (phone !== undefined) changes.phone = { old: oldProfile.phone, new: phone };
    if (address !== undefined) changes.address = { old: oldProfile.address, new: address };
    if (panMasked !== undefined || pan !== undefined) {
      changes.panMasked = { old: oldProfile.pan, new: profile.pan };
    }
    if (aadhaarMasked !== undefined || aadhaar !== undefined) {
      changes.aadhaarMasked = { old: oldProfile.aadhaar, new: profile.aadhaar };
    }
    
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'ProfileUpdated',
      description: `User profile updated`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        changes,
      },
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
    });
  }
};

/**
 * Create user (Admin only)
 * POST /api/admin/users
 * 
 * PR 32 Changes:
 * - xID is now AUTO-GENERATED server-side (admin cannot provide it)
 * - Email uniqueness enforced with HTTP 409 on duplicates
 * - Invite token expiry set to 48 hours
 * - mustChangePassword set to true (enforces password setup)
 */
const createUser = async (req, res) => {
  try {
    const {
      name, role, allowedCategories, email, teamIds, department, assignQcWorkbaskets,
    } = req.body;
    
    // Prevent creation of SUPER_ADMIN users
    const normalizedRequestedRole = normalizeRole(role || ROLE_EMPLOYEE);
    const persistedRole = normalizedRequestedRole;

    if (normalizedRequestedRole === 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Cannot create Superadmin users',
      });
    }
    
    // xID is NOT accepted from request - it will be auto-generated
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'name and email are required',
      });
    }
    
    const normalizedTeamIds = Array.isArray(teamIds)
      ? [...new Set(teamIds.map((entry) => String(entry || '').trim()).filter(Boolean))]
      : [];

    if (normalizedTeamIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one workbasket is required',
      });
    }

    // Get admin from authenticated request
    const admin = req.user;
    const inviterRole = normalizeRole(admin?.role);
    const normalizedEmail = email.trim().toLowerCase();
    const session = getSession(req);

    if (!canInviteRole(inviterRole, normalizedRequestedRole)) {
      return res.status(403).json({
        success: false,
        message: `Role ${inviterRole} cannot invite ${normalizedRequestedRole}`,
      });
    }

    const hasExplicitTagPatch = HIERARCHY_TAG_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
    if (hasExplicitTagPatch && inviterRole !== 'PRIMARY_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only PRIMARY_ADMIN can assign hierarchy tags',
      });
    }

    log.info('ADMIN_INVITE_REQUEST_RECEIVED', {
      req: {
        requestId: req.requestId || req.id || null,
        method: req.method,
        path: req.originalUrl || req.url,
      },
      firmId: admin.firmId,
      userXID: admin.xID,
      invitedEmail: emailService.maskEmail(normalizedEmail),
      requestedRole: persistedRole,
    });
    
    // Resolve firm's default client to inherit for new user
    const firm = await applySessionToQuery(Firm.findById(admin.firmId), session);
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }
    
    // Check if email already exists (enforce uniqueness)
    const existingUser = await findExistingInviteUser({
      firmId: admin.firmId,
      normalizedEmail,
      session,
    });
    
    if (existingUser) {
      if (existingUser.status === 'invited') {
        const shouldQueueInviteEmail = !existingUser.inviteSentAt;

        log.info('ADMIN_INVITE_STATE_REUSED', {
          req: {
            requestId: req.requestId || req.id || null,
            method: req.method,
            path: req.originalUrl || req.url,
          },
          firmId: admin.firmId,
          userXID: admin.xID,
          invitedEmail: emailService.maskEmail(normalizedEmail),
          inviteXID: existingUser.xID,
          inviteExpiry: existingUser.inviteTokenExpiry?.toISOString?.() || null,
          reuseReason: shouldQueueInviteEmail ? 'existing_invited_user_send_pending' : 'existing_invited_user',
        });

        if (shouldQueueInviteEmail) {
          const inviteState = await resolveInviteRequestState({
            req,
            admin,
            normalizedEmail,
            session,
            existingXID: existingUser.xID,
          });

          existingUser.inviteTokenHash = inviteState.tokenHash;
          existingUser.inviteTokenExpiry = inviteState.tokenExpiry;
          existingUser.setupTokenHash = inviteState.tokenHash;
          existingUser.setupTokenExpiresAt = inviteState.tokenExpiry;
          existingUser.mustSetPassword = true;
          existingUser.status = 'invited';
          existingUser.isActive = false;
          existingUser.inviteSentAt = new Date();
          await existingUser.save(session ? { session } : undefined);

          await safeQueueEmail({
            context: req,
            operation: 'EMAIL_QUEUE',
            payload: {
              action: 'USER_INVITE_EMAIL',
              tenantId: existingUser.firmId?.toString?.() || existingUser.firmId || null,
              email: existingUser.email,
            },
            execute: async () => {
              const emailResult = await emailService.sendPasswordSetupEmail({
                email: existingUser.email,
                name: existingUser.name,
                token: inviteState.token,
                xID: existingUser.xID,
                firmSlug: firm.firmSlug,
                role: existingUser.role,
                firmName: firm.name,
                invitedBy: admin.name || admin.xID,
                req,
              });

              if (emailResult?.success) {
                log.info('ADMIN_INVITE_EMAIL_SENT', {
                  req: {
                    requestId: req.requestId || req.id || null,
                    method: req.method,
                    path: req.originalUrl || req.url,
                  },
                  firmId: existingUser.firmId,
                  userXID: admin.xID,
                  inviteXID: existingUser.xID,
                  invitedEmail: emailService.maskEmail(existingUser.email),
                });
              } else {
                log.warn('ADMIN_INVITE_EMAIL_FAILED', {
                  req: {
                    requestId: req.requestId || req.id || null,
                    method: req.method,
                    path: req.originalUrl || req.url,
                  },
                  firmId: existingUser.firmId,
                  userXID: admin.xID,
                  inviteXID: existingUser.xID,
                  invitedEmail: emailService.maskEmail(existingUser.email),
                  error: emailResult?.error || 'Unknown email error',
                });
              }
            },
          });
        }

        return buildInviteResponse(existingUser, {
          statusCode: 200,
          message: shouldQueueInviteEmail
            ? 'User already invited. Invite email queued.'
            : 'User already invited. Existing invite remains active.',
        });
      }

      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }
    
    const inviteState = await resolveInviteRequestState({
      req,
      admin,
      normalizedEmail,
      session,
    });
    
    const inheritedDefaultClientId = (
      firm.defaultClientId
      && mongoose.Types.ObjectId.isValid(firm.defaultClientId)
    ) ? firm.defaultClientId : null;

    const teams = await Team.find({
      _id: { $in: normalizedTeamIds },
      firmId: admin.firmId,
      isActive: true,
    }).select('_id type parentWorkbasketId').lean();

    if (teams.length !== normalizedTeamIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected workbaskets are invalid or inactive',
      });
    }

    const resolvedTeamIds = teams.map((team) => team._id);
    const primaryTeamIds = teams
      .filter((team) => String(team?.type || 'PRIMARY').toUpperCase() !== 'QC')
      .map((team) => team._id);

    // Only include linked QC workbaskets when explicitly requested via assignQcWorkbaskets.
    // QC access is managed separately in Team Management and is not granted by default.
    if (Boolean(assignQcWorkbaskets)) {
      const qcTeams = await Team.find({
        firmId: admin.firmId,
        isActive: true,
        type: 'QC',
        parentWorkbasketId: { $in: primaryTeamIds },
      }).select('_id').lean();
      for (const qcTeam of qcTeams) {
        resolvedTeamIds.push(qcTeam._id);
      }
    }
    const finalTeamIds = [...new Set(resolvedTeamIds.map((entry) => String(entry)))].map((entry) => new mongoose.Types.ObjectId(entry));
    const firmPrimaryAdmin = await resolveFirmPrimaryAdmin({ firmId: admin.firmId, session });
    if (!firmPrimaryAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Firm is missing PRIMARY_ADMIN',
      });
    }

    const requesterPrimaryAdminId = normalizeId(admin.primaryAdminId) || normalizeId(firmPrimaryAdmin._id);
    let primaryAdminId = normalizeId(req.body?.primaryAdminId) || requesterPrimaryAdminId;
    let adminId = normalizeId(req.body?.adminId) || null;
    let managerId = normalizeId(req.body?.managerId) || null;

    if (inviterRole !== 'PRIMARY_ADMIN') {
      primaryAdminId = requesterPrimaryAdminId;
      if (inviterRole === 'ADMIN') {
        adminId = normalizeId(admin._id);
        managerId = null;
      } else if (inviterRole === 'MANAGER') {
        adminId = normalizeId(admin.adminId) || null;
        managerId = normalizeId(admin._id);
      }
    }

    if (normalizedRequestedRole === 'ADMIN') {
      adminId = null;
      managerId = null;
    }
    if (normalizedRequestedRole === 'MANAGER') {
      managerId = null;
    }

    const hierarchyError = getTagValidationError({
      role: normalizedRequestedRole,
      primaryAdminId,
      adminId,
      managerId,
    });
    if (hierarchyError) {
      return res.status(400).json({
        success: false,
        message: hierarchyError,
      });
    }

    await assertFirmPlanCapacity({ firmId: admin.firmId, session, role: persistedRole });

    // Create user without password (invite-based onboarding)
    const newUser = new User({
      xID: inviteState.xID, // Auto-generated, immutable
      name,
      email: normalizedEmail,
      firmId: admin.firmId, // Inherit firmId from admin
      ...(inheritedDefaultClientId ? { defaultClientId: inheritedDefaultClientId } : {}),
      role: persistedRole,
      department: String(department || '').trim() || undefined,
      primaryAdminId,
      adminId,
      managerId,
      allowedCategories: allowedCategories || [],
      teamId: finalTeamIds[0] || null,
      teamIds: finalTeamIds,
      isActive: false,
      passwordHash: null, // No password until user sets it
      passwordSet: false, // Password not set yet
      mustSetPassword: true,
      inviteTokenHash: inviteState.tokenHash, // Using alias for invite token
      inviteTokenExpiry: inviteState.tokenExpiry, // 48 hours
      setupTokenHash: inviteState.tokenHash,
      setupTokenExpiresAt: inviteState.tokenExpiry,
      mustChangePassword: true, // Enforce password setup on first login
      passwordExpiresAt: null, // Not set until password is created
      status: 'invited', // User is invited, not yet active
      passwordHistory: [],
      passwordSetAt: null,
      inviteSentAt: new Date(),
    });
    
    await newUser.save(session ? { session } : undefined);
    log.info('ADMIN_INVITE_USER_CREATED', {
      req: {
        requestId: req.requestId || req.id || null,
        method: req.method,
        path: req.originalUrl || req.url,
      },
      firmId: admin.firmId,
      userXID: admin.xID,
      inviteXID: newUser.xID,
      invitedEmail: emailService.maskEmail(newUser.email),
      status: newUser.status,
      passwordSet: newUser.passwordSet,
      mustSetPassword: newUser.mustSetPassword,
      inheritedDefaultClientId: inheritedDefaultClientId ? inheritedDefaultClientId.toString() : null,
    });
    await safeAnalyticsEvent({
      context: req,
      eventName: 'TENANT_METRIC_INCREMENT',
      payload: {
        tenantId: admin.firmId?.toString?.() || admin.firmId || null,
        metric: 'users',
      },
      execute: async () => {
        await incrementTenantMetric(admin.firmId, 'users');
      },
    });
    
    // Fetch firmSlug for email
    const firmSlug = firm.firmSlug;
    
    await safeQueueEmail({
      context: req,
      operation: 'EMAIL_QUEUE',
      payload: {
        action: 'USER_INVITE_EMAIL',
        tenantId: newUser.firmId?.toString?.() || newUser.firmId || null,
        email: newUser.email,
      },
      execute: async () => {
        const emailResult = await emailService.sendPasswordSetupEmail({
          email: newUser.email,
          name: newUser.name,
          token: inviteState.token,
          xID: newUser.xID,
          firmSlug,
          role: newUser.role,
          firmName: firm.name,
          invitedBy: admin.name || admin.xID,
          req,
        });

        if (emailResult?.success) {
          log.info('ADMIN_INVITE_EMAIL_SENT', {
            req: {
              requestId: req.requestId || req.id || null,
              method: req.method,
              path: req.originalUrl || req.url,
            },
            firmId: newUser.firmId,
            userXID: admin.xID,
            inviteXID: newUser.xID,
            invitedEmail: emailService.maskEmail(newUser.email),
          });
        } else {
          log.warn('ADMIN_INVITE_EMAIL_FAILED', {
            req: {
              requestId: req.requestId || req.id || null,
              method: req.method,
              path: req.originalUrl || req.url,
            },
            firmId: newUser.firmId,
            userXID: admin.xID,
            inviteXID: newUser.xID,
            invitedEmail: emailService.maskEmail(newUser.email),
            error: emailResult?.error || 'Unknown email error',
          });
        }

        await safeAuditLog({
          xID: newUser.xID,
          firmId: newUser.firmId,
          userId: newUser._id,
          actionType: emailResult?.success ? 'InviteEmailSent' : 'InviteEmailFailed',
          description: emailResult?.success
            ? `Invite email sent to ${emailService.maskEmail(newUser.email)}`
            : `Invite email failed to send to ${emailService.maskEmail(newUser.email)}: ${emailResult?.error || 'Unknown email error'}`,
          performedBy: admin.xID,
        }, req);
      },
    });
    
    await safeAuditLog({
      xID: newUser.xID,
      firmId: newUser.firmId,
      userId: newUser._id,
      actionType: 'UserCreated',
      description: `User account created by admin with auto-generated xID`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        createdBy: admin.xID,
        role: newUser.role,
        xID: newUser.xID,
      },
    }, req);

    await logAuditEvent({
      firmId: newUser.firmId,
      actorId: admin?._id,
      targetId: newUser._id,
      action: 'USER_INVITED',
      metadata: {
        invitedRole: newUser.role,
        adminId: newUser.adminId,
        managerId: newUser.managerId,
        inviteXID: newUser.xID,
      },
    });
    
    return buildInviteResponse(newUser, {
      statusCode: 201,
      message: 'User created successfully. Invite email queued.',
    });
  } catch (error) {
    if (error instanceof PlanLimitExceededError || error instanceof PlanAdminLimitExceededError) {
      log.warn('[PLAN_LIMIT] createUser blocked', { firmId: req.user?.firmId?.toString?.() || req.user?.firmId, message: error.message });
      return res.status(403).json({
        success: false,
        error: error.code,
        message: error.message,
        upgradeRequired: true,
        redirectTo: '/pricing',
      });
    }
    logger.error('USER_CREATE_FAILED', {
      req: {
        requestId: req.requestId || req.id || null,
        method: req.method,
        path: req.originalUrl || req.url,
      },
      firmId: req.user?.firmId || null,
      email: req.body?.email || null,
      error: error.message,
    });
    // Handle duplicate key errors from MongoDB (E11000)
    if (error.code === 11000) {
      const admin = req.user;
      const normalizedEmail = req.body?.email?.trim?.().toLowerCase?.();
      if (admin?.firmId && normalizedEmail) {
        const existingUser = await findExistingInviteUser({
          firmId: admin.firmId,
          normalizedEmail,
        });

        if (existingUser?.status === 'invited') {
          log.info('ADMIN_INVITE_STATE_REUSED', {
            req: {
              requestId: req.requestId || req.id || null,
              method: req.method,
              path: req.originalUrl || req.url,
            },
            firmId: admin.firmId,
            userXID: admin.xID,
            invitedEmail: emailService.maskEmail(normalizedEmail),
            inviteXID: existingUser.xID,
            inviteExpiry: existingUser.inviteTokenExpiry?.toISOString?.() || null,
            reuseReason: 'duplicate_key_existing_invited_user',
          });

          return buildInviteResponse(existingUser, {
            statusCode: 200,
            message: 'User already invited. Existing invite remains active.',
          });
        }
      }

      // Check which field caused the duplicate
      if (error.keyPattern && error.keyPattern.email) {
        log.error('[AUTH] Duplicate email error:', error.message);
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }
      
      if (error.keyPattern && error.keyPattern.xID) {
        // This should never happen with atomic counter operations
        // If this occurs, it indicates a critical system issue
        log.error('[AUTH] CRITICAL: Duplicate xID error (identity collision):', error.message);
        log.error('[AUTH] Counter value:', error.keyValue?.xID);
        log.error('[AUTH] This should be investigated immediately');
        return res.status(500).json({
          success: false,
          message: 'Identity generation collision. Please try again or contact support.',
        });
      }
      
      // Generic duplicate key error
      log.error('[AUTH] Duplicate key error:', error.message);
      return res.status(409).json({
        success: false,
        message: 'A user with this information already exists',
      });
    }
    
    // Log all other errors for debugging
    log.error('[AUTH] Error creating user:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error creating user',
    });
  }
};

/**
 * Activate user (Admin only)
 * PUT /api/admin/users/:xID/activate
 */
const activateUser = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    const { xID } = req.params;
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user in the same firm only (prevents cross-firm account control)
    const user = await User.findOne({ xID: xID.toUpperCase(), firmId: admin.firmId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    const session = getSession(req);
    const currentlyCounted = ['active', 'invited'].includes(user.status);
    const incrementBy = currentlyCounted ? 0 : 1;
    await assertFirmPlanCapacity({ firmId: admin.firmId, session, incrementBy, role: user.role });

    // Activate user
    user.status = 'active';
    await user.save(session ? { session } : undefined);
    await logAuditEvent({
      firmId: admin?.firmId,
      actorId: admin?._id,
      targetId: user._id,
      action: 'USER_ACTIVATED',
      metadata: {
        status: user.status,
        isActive: user.isActive,
      },
    });
    
    // Log activation
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'AccountActivated',
      description: `User account activated by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      success: true,
      message: 'User activated successfully',
    });
  } catch (error) {
    if (error instanceof PlanLimitExceededError || error instanceof PlanAdminLimitExceededError) {
      log.warn('[PLAN_LIMIT] activateUser blocked', { firmId: req.user?.firmId?.toString?.() || req.user?.firmId, message: error.message });
      return res.status(403).json({
        success: false,
        error: error.code,
        message: error.message,
        upgradeRequired: true,
        redirectTo: '/pricing',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error activating user',
    });
  }
};

/**
 * Deactivate user (Admin only)
 * PUT /api/admin/users/:xID/deactivate
 */
const deactivateUser = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    const { xID } = req.params;
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Prevent admin from deactivating themselves
    if (admin.xID === xID.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }
    
    // Find user in the same firm only (prevents cross-firm account control)
    const user = await User.findOne({ xID: xID.toUpperCase(), firmId: admin.firmId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // PROTECTION: Prevent deactivation of primary admin and system users
    try {
      assertCanDeactivateUser(user);
    } catch (guardError) {
      if (guardError instanceof PrimaryAdminActionError) {
        await logAuthAudit({
          xID: user.xID,
          firmId: user.firmId,
          userId: user._id,
          actionType: 'DeactivationAttemptBlocked',
          description: 'Attempted to deactivate primary admin - blocked',
          performedBy: admin.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        return res.status(403).json({
          success: false,
          message: guardError.message,
        });
      }
      throw guardError;
    }
    
    // Soft-disable user (never hard delete)
    user.status = 'disabled';
    await user.save();
    await logAuditEvent({
      firmId: admin?.firmId,
      actorId: admin?._id,
      targetId: user._id,
      action: 'USER_DEACTIVATED',
      metadata: {
        status: user.status,
        isActive: user.isActive,
      },
    });
    
    await handleUserDeactivation({ firmId: admin.firmId, userXID: user.xID });

    // Log deactivation
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'AccountDeactivated',
      description: `User account deactivated by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deactivating user',
    });
  }
};

/**
 * Set password using token from email (for first-time password setup)
 * POST /api/auth/set-password
 * 
 * Used when a new user sets their password for the first time.
 * Does NOT check password history since this is initial setup.
 */
const setPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        code: 'ACTIVATION_TOKEN_INVALID',
        message: 'Token and password required',
      });
    }

    const passwordSetupSecret = process.env.JWT_PASSWORD_SETUP_SECRET;
    if (!passwordSetupSecret) {
      return res.status(500).json({
        success: false,
        message: 'JWT_PASSWORD_SETUP_SECRET environment variable is not configured',
      });
    }

    let decoded;
    try {
      // SECURITY: Explicit JWT algorithm allowlist
      decoded = jwt.verify(token, passwordSetupSecret, {
        algorithms: ['HS256'],
      });
    } catch (jwtError) {
      return res.status(400).json({
        success: false,
        code: 'ACTIVATION_TOKEN_INVALID',
        message: 'Invalid or expired token',
      });
    }

    if (decoded.type !== 'PASSWORD_SETUP') {
      return res.status(400).json({
        success: false,
        code: 'ACTIVATION_TOKEN_INVALID',
        message: 'Invalid token type',
      });
    }

    const tokenOwner = await User.findOne({
      _id: decoded.userId,
      firmId: decoded.firmId,
    });

    if (!tokenOwner) {
      return res.status(400).json({
        success: false,
        code: 'ACTIVATION_TOKEN_INVALID',
        message: 'Invalid or expired token',
      });
    }

    if (tokenOwner.passwordHash || isActiveStatus(tokenOwner.status)) {
      return res.status(409).json({
        success: false,
        code: 'ACCOUNT_ALREADY_ACTIVATED',
        message: 'Password already set',
      });
    }
    
    // Hash new password
    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Set password and clear token
    tokenOwner.passwordHash = passwordHash;
    tokenOwner.passwordSet = true;
    tokenOwner.mustSetPassword = false;
    tokenOwner.passwordSetupTokenHash = null;
    tokenOwner.passwordSetupExpires = null;
    tokenOwner.passwordLastChangedAt = now;
    tokenOwner.passwordSetAt = now;
    tokenOwner.passwordExpiresAt = new Date(now.getTime() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000); // Set expiry when password is created
    tokenOwner.mustChangePassword = false;
    tokenOwner.status = 'active'; // User becomes active after setting password
    tokenOwner.isActive = true;
    tokenOwner.failedLoginAttempts = 0;
    tokenOwner.lockUntil = null;
    
    await tokenOwner.save();
    
    // Log password setup
    await logAuthAudit({
      xID: tokenOwner.xID,
      firmId: tokenOwner.firmId,
      userId: tokenOwner._id,
      actionType: 'PasswordSetup',
      description: `User set password via email link`,
      performedBy: tokenOwner.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    // Fetch firmSlug for firm-scoped redirect
    let firmSlug = null;
    if (tokenOwner.firmId) {
      const firm = await Firm.findOne({ _id: tokenOwner.firmId });
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Fail fast if firmSlug cannot be resolved
    if (!firmSlug) {
      return res.status(400).json({
        success: false,
        code: 'FIRM_NOT_FOUND',
        message: 'Firm context missing. Cannot complete password setup. Please contact support.',
      });
    }
    
    res.json({
      success: true,
      message: 'Password set successfully',
      firmSlug: firmSlug,
      redirectUrl: `/${firmSlug}/login`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'FIRM_RESOLUTION_FAILED',
      message: 'Error setting password',
    });
  }
};

const setupAccount = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, code: 'SETUP_PAYLOAD_INVALID', message: 'token and password are required' });
  }
  if (password && !validatePasswordStrength(password)) {
    return res.status(400).json({ success: false, code: 'PASSWORD_POLICY_VIOLATION', message: PASSWORD_POLICY_MESSAGE });
  }

  const now = new Date();
  const setupTokenHash = emailService.hashToken(token);
  const existingUser = await User.findOne({
    ...(req.firmId ? { firmId: req.firmId } : {}),
    $or: [
      { setupTokenHash },
      { passwordSetupTokenHash: setupTokenHash },
    ],
  });

  if (!existingUser) {
    return res.status(400).json({ success: false, code: 'SETUP_TOKEN_INVALID', message: 'Invalid setup token' });
  }

  if (existingUser.setupTokenUsedAt) {
    return res.status(400).json({ success: false, code: 'SETUP_TOKEN_ALREADY_USED', message: 'This setup link has already been used.' });
  }

  const tokenExpiresAt = existingUser.setupTokenExpiresAt || existingUser.passwordSetupExpires || null;
  if (!tokenExpiresAt || tokenExpiresAt < now) {
    log.warn('[AUTH][setup] setup token expired', { userId: existingUser._id.toString() });
    return res.status(400).json({ success: false, code: 'SETUP_TOKEN_EXPIRED', message: 'Setup token expired. This link will expire in 48 hours.' });
  }

  const update = {
    status: 'active',
    isActive: true,
    setupTokenUsedAt: now,
    setupTokenHash: null,
    setupTokenExpiresAt: null,
    passwordSetupTokenHash: null,
    passwordSetupExpires: null,
    mustSetPassword: false,
    mustChangePassword: false,
    passwordSetAt: now,
  };

  if (password) {
    update.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    update.passwordSet = true;
  }

  const user = await User.findOneAndUpdate(
    {
      _id: existingUser._id,
      firmId: existingUser.firmId,
      setupTokenUsedAt: null,
      setupTokenExpiresAt: { $gt: now },
      $or: [{ setupTokenHash }, { passwordSetupTokenHash: setupTokenHash }],
    },
    { $set: update },
    { returnDocument: 'after' }
  );

  if (!user) {
    const raceUser = await User.findOne({
      _id: existingUser._id,
      firmId: existingUser.firmId,
    }).select('setupTokenUsedAt setupTokenExpiresAt');
    if (raceUser?.setupTokenUsedAt) {
      return res.status(400).json({ success: false, code: 'SETUP_TOKEN_ALREADY_USED', message: 'This setup link has already been used.' });
    }
    if (raceUser?.setupTokenExpiresAt && raceUser.setupTokenExpiresAt <= now) {
      return res.status(400).json({ success: false, code: 'SETUP_TOKEN_EXPIRED', message: 'Setup token expired. This link will expire in 48 hours.' });
    }
    return res.status(400).json({ success: false, code: 'SETUP_TOKEN_INVALID', message: 'Invalid setup token' });
  }

  await Firm.updateOne(
    { _id: user.firmId, status: 'pending_setup' },
    { $set: { status: 'active' } }
  );

  let firmSlug = user.firmSlug || null;
  if (!firmSlug && user.firmId) {
    const firm = await Firm.findById(user.firmId).select('firmSlug');
    firmSlug = firm?.firmSlug || null;
  }

  return res.json({
    success: true,
    message: 'Account setup completed',
    firmSlug,
    redirectUrl: firmSlug ? `/${firmSlug}/login` : '/login',
  });
};

const resendSetup = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, code: 'EMAIL_REQUIRED', message: 'email is required' });
  const genericResponse = { success: true, message: 'If the account exists, a setup email has been sent.' };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const normalizedEmail = email.toLowerCase().trim();
  const userQuery = { email: normalizedEmail };
  if (req.firmId) {
    userQuery.firmId = req.firmId;
  }
  const user = await User.findOne(userQuery);
  if (!user) return res.json(genericResponse);

  const recentCount = await AuthAudit.countDocuments({
    userId: user._id,
    actionType: 'SetupLinkResent',
    createdAt: { $gte: oneHourAgo },
  });
  if (recentCount >= 3) {
    return res.status(429).json({ success: false, code: 'SETUP_RESEND_RATE_LIMITED', message: 'Rate limit exceeded. Max 3 setup links per hour.' });
  }

  const token = emailService.generateSecureToken();
  const tokenHash = emailService.hashToken(token);
  const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  user.setupTokenHash = tokenHash;
  user.setupTokenExpiresAt = tokenExpiry;
  user.passwordSetupTokenHash = tokenHash;
  user.passwordSetupExpires = tokenExpiry;
  user.setupTokenUsedAt = null;
  await user.save();

  await emailService.sendPasswordSetupEmail({
    email: user.email,
    name: user.name,
    token,
    xID: user.xID,
    role: user.role,
    customMessage: 'This link will expire in 48 hours.',
  });

  await logAuthAudit({
    userId: user._id,
    xID: user.xID,
    firmId: user.firmId,
    actionType: 'SetupLinkResent',
    description: 'Setup link resent',
    performedBy: user.xID,
  }, req);
  log.info('[AUTH][setup] setup link resent', { userId: user._id.toString(), firmId: user.firmId?.toString?.() || user.firmId });
  return res.json(genericResponse);
};

const resendCredentials = async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, code: 'EMAIL_REQUIRED', message: 'Email is required' });
  }

  const result = await signupService.resendCredentialsEmail({ email, req });
  return res.status(200).json({ success: true, message: result.message || 'Credentials email sent.' });
};

/**
 * Reset password using token from first login email (for password resets)
 * POST /api/auth/reset-password-with-token
 * 
 * Used when a user resets their password (e.g., on first login with default password).
 * DOES check password history to prevent reuse.
 * Note: Separate from setPassword to maintain different validation rules.
 */
const resetPasswordWithToken = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required',
      });
    }
    if (!validatePasswordStrength(password)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_POLICY_MESSAGE,
      });
    }
    
    // Hash the token to compare with stored hash
    const tokenHash = emailService.hashToken(token);
    
    // Find user with matching token hash (check both reset and setup tokens in one query)
    const user = await User.findOne({ 
      ...(req.firmId ? { firmId: req.firmId } : {}),
      $or: [
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: { $gt: new Date() }
        },
        {
          passwordSetupTokenHash: tokenHash,
          passwordSetupExpires: { $gt: new Date() }
        }
      ]
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token',
      });
    }
    
    // Check if new password matches any of the last 5 passwords
    const passwordHistory = user.passwordHistory || [];
    const passwordHistorySlice = passwordHistory.slice(-PASSWORD_HISTORY_LIMIT);
    const passwordHistoryResults = await Promise.all(
      passwordHistorySlice.map((oldPassword) => bcrypt.compare(password, oldPassword.hash))
    );

    if (passwordHistoryResults.includes(true)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reuse any of your last 5 passwords',
      });
    }
    
    // Check if new password is same as current
    if (user.passwordHash) {
      const isSameAsCurrent = await bcrypt.compare(password, user.passwordHash);
      if (isSameAsCurrent) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password',
        });
      }
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Add current password to history if it exists
    if (user.passwordHash) {
      user.passwordHistory.push({
        hash: user.passwordHash,
        changedAt: new Date(),
      });
      
      // Keep only last 5 passwords in history
      if (user.passwordHistory.length > PASSWORD_HISTORY_LIMIT) {
        user.passwordHistory = user.passwordHistory.slice(-PASSWORD_HISTORY_LIMIT);
      }
    }
    
    // Update password and clear tokens
    user.passwordHash = passwordHash;
    user.passwordSet = true;
    user.mustSetPassword = false;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    user.passwordSetupTokenHash = null;
    user.passwordSetupExpires = null;
    user.passwordLastChangedAt = new Date();
    user.passwordSetAt = new Date();
    user.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000); // Set expiry when password is reset
    user.mustChangePassword = false;
    user.forcePasswordReset = false;
    user.status = 'active'; // Ensure user is active after password reset
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    
    await user.save();
    
    // Log password reset
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'PasswordReset',
      description: `User reset password via email link`,
      performedBy: user.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    log.error('[AUTH] Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
    });
  }
};

/**
 * Resend password setup email (Admin only)
 * POST /api/auth/resend-setup-email
 * 
 * @deprecated This function is deprecated as of PR #48
 * Use POST /api/admin/users/:xID/resend-invite instead (admin.controller.js)
 * This endpoint has been removed from auth.routes.js to prevent password enforcement issues
 */
const resendSetupEmail = async (req, res) => {
  try {
    const { xID } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user
    const lookupQuery = { xID: xID.toUpperCase() };
    if (!isSuperAdminRequest(req)) {
      lookupQuery.firmId = getRequestFirmId(req);
    }
    const user = await User.findOne(lookupQuery);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    if (user.passwordSet) {
      return res.status(400).json({
        success: false,
        message: 'User has already set their password',
      });
    }
    
    // Generate new secure invite token (48-hour expiry)
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Update token
    user.inviteTokenHash = tokenHash;
    user.inviteTokenExpiry = tokenExpiry;
    await user.save();
    
    // Fetch firmSlug for email
    let firmSlug = null;
    if (user.firmId) {
      const firm = await Firm.findById(user.firmId);
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Send invite reminder email with xID
    try {
      const emailResult = await emailService.sendPasswordSetupReminderEmail({
        email: user.email,
        name: user.name,
        token: token,
        xID: user.xID,
        firmSlug: firmSlug, // Pass firmSlug for firm-specific URL in email
        req,
      });
      
      if (!emailResult.success) {
        log.warn('[AUTH] Failed to send invite reminder email:', emailResult.error);
        await logAuthAudit({
          xID: user.xID,
          firmId: user.firmId,
          userId: user._id,
          actionType: 'InviteEmailResendFailed',
          description: `Invite reminder email failed to send: ${emailResult.error}`,
          performedBy: admin.xID,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        return res.status(500).json({
          success: false,
          code: 'FIRM_RESOLUTION_FAILED',
          message: 'Failed to send email',
          error: emailResult.error,
        });
      }
      
      // Log invite email sent
      await logAuthAudit({
        xID: user.xID,
        firmId: user.firmId,
        userId: user._id,
        actionType: 'InviteEmailResent',
        description: `Invite reminder email sent to ${emailService.maskEmail(user.email)}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    } catch (emailError) {
      log.warn('[AUTH] Failed to send invite email:', emailError.message);
      return res.status(500).json({
        success: false,
        code: 'FIRM_RESOLUTION_FAILED',
        message: 'Failed to send email',
        error: emailError.message,
      });
    }
    
    res.json({
      success: true,
      message: 'Invite email sent successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resending setup email',
    });
  }
};

/**
 * Update user status (Admin only)
 * PATCH /api/users/:xID/status
 */
const updateUserStatus = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    const { xID } = req.params;
    const { active, status } = req.body;
    
    if (active === undefined && !status) {
      return res.status(400).json({
        success: false,
        message: 'Either active (boolean) or status is required',
      });
    }

    const resolvedStatus = typeof active === 'boolean'
      ? (active ? 'active' : 'disabled')
      : String(status).toLowerCase();

    if (!['active', 'disabled'].includes(resolvedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'status must be either active or disabled',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Prevent admin from deactivating themselves
    if (resolvedStatus === 'disabled' && admin.xID === xID.toUpperCase()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }
    
    // Find user in same firm only (prevents cross-firm account takeover)
    const user = await User.findOne({ xID: xID.toUpperCase(), firmId: admin.firmId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // PROTECTION: Prevent deactivation of primary admin and system users
    if (resolvedStatus === 'disabled') {
      try {
        assertCanDeactivateUser(user);
      } catch (guardError) {
        if (guardError instanceof PrimaryAdminActionError) {
          await logAuthAudit({
            xID: user.xID,
            firmId: user.firmId,
            userId: user._id,
            actionType: 'DeactivationAttemptBlocked',
            description: 'Attempted to deactivate primary admin - blocked',
            performedBy: admin.xID,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });
          return res.status(403).json({
            success: false,
            message: guardError.message,
          });
        }
        throw guardError;
      }
    }
    
    // Update status
    user.status = resolvedStatus;
    await user.save();
    await logAuditEvent({
      firmId: admin?.firmId,
      actorId: admin?._id,
      targetId: user._id,
      action: resolvedStatus === 'active' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      metadata: {
        status: user.status,
        isActive: user.isActive,
      },
    });
    
    if (resolvedStatus === 'disabled') {
      await handleUserDeactivation({ firmId: admin.firmId, userXID: user.xID });
    }

    // Log status change
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: resolvedStatus === 'active' ? 'AccountActivated' : 'AccountDeactivated',
      description: `User account ${resolvedStatus === 'active' ? 'activated' : 'deactivated'} by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      success: true,
      message: `User ${resolvedStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
    });
  }
};

/**
 * Unlock user account (Admin only)
 * POST /api/auth/unlock-account
 */
const unlockAccount = async (req, res) => {
  try {
    const { xID } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find user
    const lookupQuery = { xID: xID.toUpperCase() };
    if (!isSuperAdminRequest(req)) {
      lookupQuery.firmId = getRequestFirmId(req);
    }
    const user = await User.findOne(lookupQuery);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Unlock account
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
    
    // Log unlock
    await logAuthAudit({
      xID: user.xID,
      firmId: user.firmId,
      userId: user._id,
      actionType: 'AccountUnlocked',
      description: `Account unlocked by admin`,
      performedBy: admin.xID,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      success: true,
      message: 'Account unlocked successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unlocking account',
    });
  }
};

const loginInit = async (req, res) => {
  req.loginScope = 'tenant';
  return login(req, res);
};

const loginVerify = async (req, res) => {
  return verifyLoginOtp(req, res);
};

const loginResend = async (req, res) => {
  return resendLoginOtp(req, res);
};

/**
 * Forgot password - Request password reset link
 * POST /api/auth/forgot-password
 * Public endpoint - does not require authentication
 */
const forgotPassword = async (req, res) => authPasswordService.forgotPassword(req, res);

const forgotPasswordInit = async (req, res) => authPasswordService.forgotPasswordInit(req, res);

const forgotPasswordVerify = async (req, res) => authPasswordService.forgotPasswordVerify(req, res);

const forgotPasswordResetWithOtp = async (req, res) => authPasswordService.forgotPasswordResetWithOtp(req, res);

/**
 * Get all users (Admin only)
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    if (typeof res.set === 'function') {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
    } else if (typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Get requesting admin's firmId for same-firm filtering
    const adminFirmId = req.user.firmId;
    
    // Get all users in same firm, excluding password-related fields
    // Populate firm metadata for display
    const users = await User.find({
      firmId: adminFirmId,
      status: { $ne: 'deleted' },
    })
      .select('-passwordHash -passwordHistory -passwordSetupTokenHash -passwordResetTokenHash')
      .populate('firmId', 'firmId name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users.map(mapUserResponse),
      count: users.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
    });
  }
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 * 
 * CRITICAL: Refresh flow must rebuild all claims from trusted DB state.
 */
const refreshAccessToken = async (req, res) => authSessionService.refreshAccessToken(req, res);

/**
 * Verify TOTP code for MFA
 * POST /api/auth/verify-totp
 */
const verifyTotp = async (req, res) => authOtpServiceFacade.verifyTotp(req, res);

const completeMfaLogin = async (req, res) => authOtpServiceFacade.completeMfaLogin(req, res);

const generatePrimaryXid = async () => {
  for (let i = 0; i < 20; i += 1) {
    const candidate = `DK-${crypto.randomBytes(3).toString('hex').slice(0, 5).toUpperCase()}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ xid: candidate });
    if (!exists) return candidate;
  }
  throw new Error('XID_GENERATION_FAILED');
};

const ensureCanonicalXid = async (user) => {
  if (!user) return user;
  if (user.xid) return user;

  if (user.xID && /^DK-[A-Z0-9]{5}$/.test(user.xID)) {
    user.xid = user.xID;
  } else {
    user.xid = await generatePrimaryXid();
  }

  if (typeof user.save === 'function') {
    await user.save();
  } else {
    await User.updateOne({ _id: user._id }, { $set: { xid: user.xid } });
  }

  return user;
};

const issueAuthTokens = async (req, user) => {
  await ensureCanonicalXid(user);

  const accessToken = jwtService.generateAccessToken({
    userId: user._id.toString(),
    xid: user.xid,
    role: user.role || 'Employee',
    firmId: user.firmId ? user.firmId.toString() : null,
    defaultClientId: user.defaultClientId ? user.defaultClientId.toString() : null,
  });

  const { refreshToken } = await generateAndStoreRefreshToken({
    req,
    userId: user._id,
    firmId: user.firmId || null,
  });

  return { accessToken, refreshToken };
};

const authLoginService = createAuthLoginService({
  models: {
    User,
    LoginSession,
  },
  utils: {
    getSuperadminEnv,
    handleSuperadminLogin,
    validateTenantUserPreconditions,
    handlePasswordVerification,
    handlePostPasswordChecks,
    sendLoginOtpChallenge,
    getLoginOtpConfig,
    LOGIN_OTP_COOLDOWN_SECONDS,
    hashLoginSessionToken,
    clearExpiredLoginOtpLock,
    getLoginOtpLockSeconds,
    logLoginOtpEvent,
    clearLoginOtpState,
    persistLoginOtpState,
    logAuthAudit,
    DEFAULT_XID,
    DEFAULT_FIRM_ID,
    noteLoginFailure,
    clearCachedLoginOtpState,
    buildSuccessfulLoginPayload,
    normalizeFirmSlug,
    setAuthCookies: (...args) => authSessionService.setAuthCookies(...args),
  },
  services: {
    authOtpService,
  },
});

const authSessionService = createAuthSessionService({
  models: {
    RefreshToken,
    User,
  },
  utils: {
    getSession,
    isActiveStatus,
    noteRefreshTokenFailure,
    noteRefreshTokenUse,
    logAuthAudit,
    getFirmSlug,
    disconnectSocketsForUser: disconnectUserSockets,
    isSuperAdminRole,
    DEFAULT_FIRM_ID,
  },
  services: {
    jwtService,
  },
});

const authPasswordService = createAuthPasswordService({
  normalizeFirmSlug,
  Firm,
  User,
  emailService,
  isActiveStatus,
  FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES,
  logAuthAudit,
  FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS,
  FORGOT_PASSWORD_OTP_EXPIRY_MINUTES,
  FORGOT_PASSWORD_OTP_LOCK_MINUTES,
  authOtpService,
  SALT_ROUNDS,
  DEFAULT_XID,
  DEFAULT_FIRM_ID,
  clearForgotPasswordOtpState,
  generateLoginSessionToken,
  hashLoginSessionToken,
  validatePasswordStrength,
  PASSWORD_POLICY_MESSAGE,
  bcrypt,
});

const authOtpServiceFacade = authOtpService.createAuthOtpService({
  getRequestFirmId,
  User,
  getTwoFactorSecret,
  speakeasy,
  jwt,
  mongoose,
  getFirmSlug,
  ensureCanonicalXid,
  jwtService,
  generateAndStoreRefreshToken: (params) => authSessionService.generateAndStoreRefreshToken(params),
  handleSuccessfulLoginMonitoring,
  logAuthAudit,
  logSecurityAuditEvent,
  SECURITY_AUDIT_ACTIONS,
  DEFAULT_XID,
  DEFAULT_FIRM_ID,
  sendCentralOtp,
  verifyCentralOtp,
  issueAuthTokens,
  setAuthCookies: (...args) => authSessionService.setAuthCookies(...args),
});

const authSignupService = createAuthSignupService({
  signupService,
  getSession,
  mongoose,
  User,
});

const signupInit = async (req, res) => authSignupService.signupInit(req, res);

const signupVerify = async (req, res) => authSignupService.signupVerify(req, res);

const signupResend = async (req, res) => authSignupService.signupResend(req, res);

const sendOtpEndpoint = async (req, res) => authOtpServiceFacade.sendOtpEndpoint(req, res);

const verifyOtpEndpoint = async (req, res) => authOtpServiceFacade.verifyOtpEndpoint(req, res);


module.exports = {
  login: wrapWriteHandler(login),
  logout: wrapWriteHandler(logout),
  changePassword: wrapWriteHandler(changePassword),
  resetPassword: wrapWriteHandler(resetPassword),
  getProfile,
  updateProfile: wrapWriteHandler(updateProfile),
  createUser: wrapWriteHandler(createUser),
  activateUser: wrapWriteHandler(activateUser),
  deactivateUser: wrapWriteHandler(deactivateUser),
  setupAccount: wrapWriteHandler(setupAccount),
  resendSetup: wrapWriteHandler(resendSetup),
  resendCredentials: wrapWriteHandler(resendCredentials),
  resendLoginOtp: wrapWriteHandler(resendLoginOtp),
  loginInit: wrapWriteHandler(loginInit),
  loginVerify: wrapWriteHandler(loginVerify),
  loginResend: wrapWriteHandler(loginResend),
  resetPasswordWithToken: wrapWriteHandler(resetPasswordWithToken),
  // resendSetupEmail - REMOVED: Deprecated in PR #48, use admin.controller.resendInviteEmail instead
  updateUserStatus: wrapWriteHandler(updateUserStatus),
  unlockAccount: wrapWriteHandler(unlockAccount),
  forgotPassword: wrapWriteHandler(forgotPassword),
  forgotPasswordInit: wrapWriteHandler(forgotPasswordInit),
  forgotPasswordVerify: wrapWriteHandler(forgotPasswordVerify),
  forgotPasswordResetWithOtp: wrapWriteHandler(forgotPasswordResetWithOtp),
  getAllUsers,
  refreshAccessToken: wrapWriteHandler(refreshAccessToken), // NEW: JWT token refresh
  verifyTotp: wrapWriteHandler(verifyTotp),
  verifyLoginOtp: wrapWriteHandler(verifyLoginOtp),
  completeMfaLogin: wrapWriteHandler(completeMfaLogin),
  generateAndStoreRefreshToken,
  signupInit: wrapWriteHandler(signupInit),
  signupVerify: wrapWriteHandler(signupVerify),
  signupResend: wrapWriteHandler(signupResend),
  sendOtpEndpoint: wrapWriteHandler(sendOtpEndpoint),
  verifyOtpEndpoint: wrapWriteHandler(verifyOtpEndpoint),
};
