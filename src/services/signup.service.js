const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const TemporarySignup = require('../models/TemporarySignup');
const { generateNextClientId } = require('./clientIdGenerator');
const { generateNextXID } = require('./xIDGenerator');
const { ensureTenantKey } = require('../security/encryption.service');
const { slugify } = require('../utils/slugify');
const emailService = require('./email.service');
const jwtService = require('./jwt.service');
const config = require('../config/config');
const log = require('../utils/log');
const { acquireLock, releaseLock } = require('./redisLock.service');
const { safeAuditLog, safeQueueEmail } = require('./safeSideEffects.service');
const {
  consumeSignupQuota,
  consumeOtpAttempt,
  consumeOtpResendQuota,
  clearOtpAttempts,
} = require('./signupRateLimit.service');

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = config.security.rateLimit.otpVerifyPerMinute;
const OTP_BLOCK_MINUTES = Math.max(1, Math.ceil(config.security.rateLimit.otpVerifyBlockSeconds / 60));
const MAX_RESEND_COUNT = config.security.rateLimit.signupOtpMaxResends;
const MAX_SLUG_COLLISION_RETRIES = 5;
const OTP_RESEND_COOLDOWN = config.security.rateLimit.otpResendCooldownSeconds;
const SYSTEM_EMAIL_DOMAIN = 'system.local';
const DEFAULT_BUSINESS_ADDRESS = 'Default Address';
const DEFAULT_CONTACT_NUMBER = '0000000000';
const PHONE_REGEX = /^[0-9]{10}$/;
const EMAIL_ENUMERATION_SAFE_MESSAGE = 'If the details are valid, a verification code will be sent shortly.';
const GENERIC_VERIFICATION_FAILURE_MESSAGE = 'Verification failed';
const MIN_PUBLIC_RESPONSE_MS = 350;
const DUMMY_BCRYPT_HASH = '$2b$10$7EqJtq98hPqEX7fNZaFWoOhi8sB0QYfJOLLm1Aun1vDLteA94ppI.';
const OTP_RATE_LIMIT_MESSAGE = 'Too many OTP attempts. Try again later.';

const logSignupAuthEvent = async ({
  eventType,
  email,
  req = null,
  userId = null,
  firmId = null,
  metadata = null,
}) => {
  try {
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    await safeAuditLog({
      eventType,
      xID: normalizedEmail || 'UNKNOWN',
      firmId: firmId ? String(firmId) : 'PLATFORM',
      userId: userId || null,
      description: `Auth event: ${eventType}`,
      performedBy: normalizedEmail || 'SYSTEM',
      req,
      metadata: {
        eventType,
        email: normalizedEmail,
        userId: userId ? String(userId) : null,
        firmId: firmId ? String(firmId) : null,
        ipAddress: req?.ip || null,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  } catch (error) {
    console.error(`[PUBLIC_SIGNUP][AUDIT] Failed to record ${eventType}:`, error.message);
  }
};

const resolveOtpExpiry = (record) => record.otpExpiresAt || record.otpExpiry;
const resolveOtpLastSentAt = (record) => record.otpLastSentAt || record.lastOtpSentAt;
const resolveOtpResendCount = (record) => record.otpResendCount ?? record.resendCount ?? 0;
const resolveConsumedAt = (record) => record.consumedAt || record.consumed_at;
const normalizePhone = (phone) => (typeof phone === 'string' ? phone.trim() : '');

const enforceMinimumDuration = async (startedAt, minimumMs = MIN_PUBLIC_RESPONSE_MS) => {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minimumMs) {
    await new Promise((resolve) => setTimeout(resolve, minimumMs - elapsed));
  }
};

/**
 * Generate a 6-digit numeric OTP using crypto.randomInt (CSPRNG-backed in Node crypto).
 * @returns {string} 6-digit OTP string
 */
const generateOtp = () => {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
};

/**
 * Check if email already belongs to an admin system user (firm owner)
 * @param {string} email
 * @returns {Promise<boolean>}
 */
const isEmailFirmOwner = async (email) => {
  const existing = await User.findOne({
    email: email.toLowerCase().trim(),
    isSystem: true,
    role: 'Admin',
    status: { $ne: 'deleted' },
  }).lean();
  return !!existing;
};

const findExistingSignupUser = async ({ email, phone, session = null }) => {
  const userQuery = User.findOne({
    status: { $ne: 'deleted' },
    $or: [
      { email: email.toLowerCase().trim() },
      { phoneNumber: normalizePhone(phone) },
    ],
  });

  if (session) {
    userQuery.session(session);
  }

  return userQuery.lean();
};

/**
 * Initiate a manual signup flow
 * @param {Object} params - { name, email, password, phone }
 * @returns {Promise<Object>} result
 */
const initiateSignup = async ({
  name,
  email,
  password,
  phone,
  firmName,
  session = null,
  req = null,
}) => {
  const startedAt = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone = normalizePhone(phone);
  const quota = await consumeSignupQuota({ email: normalizedEmail, ip: req?.ip });
  if (!quota.allowed) {
    return { success: false, status: 429, message: 'Too many requests. Please try again later.' };
  }

  if (!PHONE_REGEX.test(normalizedPhone)) {
    return { success: false, status: 400, message: 'Phone number must be 10 digits' };
  }

  const existingUser = await findExistingSignupUser({
    email: normalizedEmail,
    phone: normalizedPhone,
    session,
  });

  await TemporarySignup.deleteMany({
    $or: [
      { otpExpiresAt: { $lt: new Date() } },
      { otpExpiry: { $lt: new Date() } },
    ],
  }, { session });

  // Remove any existing temporary signup for this email
  await TemporarySignup.deleteMany({ email: normalizedEmail }, { session });

  if (existingUser) {
    log.warn('SIGNUP_FAILED', { req, email: normalizedEmail, reason: 'EMAIL_OR_PHONE_IN_USE' });
    await enforceMinimumDuration(startedAt);
    return { success: false, status: 409, message: 'Email or phone number already registered' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);

  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await TemporarySignup.create({
    name: name.trim(),
    email: normalizedEmail,
    firmName: firmName.trim(),
    passwordHash,
    phone: normalizedPhone,
    provider: 'manual',
    otpHash,
    otpExpiresAt,
    // Legacy compatibility field retained for old records/read paths.
    otpExpiry: otpExpiresAt,
    otpAttempts: 0,
    attemptCount: 0,
    otpBlockedUntil: null,
    otpResendCount: 0,
    resendCount: 0,
    otpLastSentAt: new Date(),
    lastOtpSentAt: new Date(),
    isVerified: false,
    consumedAt: null,
  }, { session });

  // Send OTP email
  await safeQueueEmail({
    context: req,
    operation: 'EMAIL_QUEUE',
    payload: { action: 'SIGNUP_OTP_EMAIL', tenantId: null, email: normalizedEmail },
    execute: async () => emailService.sendEmail({
      to: normalizedEmail,
      subject: 'Docketra Signup – Verify Your Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${name.trim()},</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1976D2; margin: 20px 0;">${otp}</p>
          <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br>Docketra Team</p>
        </div>
      `,
      text: `Hello ${name.trim()},\n\nYour verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nBest regards,\nDocketra Team`,
    }),
  });

  await logSignupAuthEvent({ eventType: 'SIGNUP_INITIATED', email: normalizedEmail, req });
  await logSignupAuthEvent({ eventType: 'OTP_SENT', email: normalizedEmail, req });
  log.info('OTP_SENT', { req, email: normalizedEmail, event: 'OTP_SENT' });
  await enforceMinimumDuration(startedAt);

  return { success: true, message: EMAIL_ENUMERATION_SAFE_MESSAGE };
};

/**
 * Verify OTP for a temporary signup
 * @param {Object} params - { email, otp }
 * @returns {Promise<Object>} result
 */
const verifyOtp = async ({ email, otp, session = null, req = null }) => {
  if (!session) {
    throw new Error('Transaction session is required');
  }

  const startedAt = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  let otpAttempt;
  try {
    otpAttempt = await consumeOtpAttempt({ email: normalizedEmail, ip: req?.ip });
  } catch (error) {
    if (error.message === OTP_RATE_LIMIT_MESSAGE) {
      return { success: false, status: 429, message: OTP_RATE_LIMIT_MESSAGE };
    }
    throw error;
  }
  if (!otpAttempt.allowed) {
    return { success: false, status: 429, message: OTP_RATE_LIMIT_MESSAGE };
  }

  const lock = await acquireLock({ key: `tenant_bootstrap_lock:${normalizedEmail}`, ttlSeconds: 30 });
  if (!lock.acquired) {
    return { success: false, status: 409, message: 'Signup already in progress' };
  }

  try {
    const record = await TemporarySignup.findOne({ email: normalizedEmail, provider: 'manual' }).session(session);
    if (!record) {
      await enforceMinimumDuration(startedAt);
      return { success: false, status: 400, message: GENERIC_VERIFICATION_FAILURE_MESSAGE };
    }

    if (resolveConsumedAt(record)) {
      await enforceMinimumDuration(startedAt);
      return { success: false, status: 400, message: GENERIC_VERIFICATION_FAILURE_MESSAGE };
    }

    const otpExpiry = resolveOtpExpiry(record);
    if (!otpExpiry || otpExpiry.getTime() < Date.now()) {
      await enforceMinimumDuration(startedAt);
      return { success: false, status: 400, message: GENERIC_VERIFICATION_FAILURE_MESSAGE };
    }

    const nextAttemptCount = (record.attemptCount ?? record.attempt_count ?? record.otpAttempts ?? 0) + 1;
    // Canonical counter is attemptCount (attempt_count alias). otpAttempts is retained for backward compatibility.
    record.otpAttempts = nextAttemptCount;
    record.attemptCount = nextAttemptCount;

    const otpHashToCompare = record.otpHash || DUMMY_BCRYPT_HASH;
    const isValid = await bcrypt.compare(otp, otpHashToCompare);
    if (!record.otpHash || !isValid) {
      if (record.otpAttempts >= MAX_OTP_ATTEMPTS) {
        record.otpBlockedUntil = new Date(Date.now() + OTP_BLOCK_MINUTES * 60 * 1000);
      }
      await record.save({ session });
      log.warn('SIGNUP_FAILED', { req, email: normalizedEmail, reason: 'INVALID_OTP' });
      await enforceMinimumDuration(startedAt);
      return { success: false, status: 400, message: GENERIC_VERIFICATION_FAILURE_MESSAGE };
    }

    const tenant = await createTenant({
      name: record.name,
      email: normalizedEmail,
      firmName: record.firmName,
      passwordHash: record.passwordHash || null,
      phone: record.phone || null,
      session,
      req,
    });

    const consumedAt = new Date();
    record.isVerified = true;
    record.otpAttempts = 0;
    record.attemptCount = 0;
    record.otpBlockedUntil = null;
    record.consumedAt = consumedAt;
    await record.save({ session });

    await clearOtpAttempts({ email: normalizedEmail, ip: req?.ip });
    await logSignupAuthEvent({ eventType: 'OTP_VERIFIED', email: normalizedEmail, req, userId: tenant.userId, firmId: tenant.firmId });
    await logSignupAuthEvent({
      eventType: 'SIGNUP_COMPLETED',
      email: normalizedEmail,
      req,
      userId: tenant.userId,
      firmId: tenant.firmId,
      metadata: { firmSlug: tenant.firmSlug },
    });
    log.info('OTP_VERIFIED', { req, email: normalizedEmail, firmSlug: tenant.firmSlug });
    log.info('SIGNUP_COMPLETED', { req, email: normalizedEmail, firmSlug: tenant.firmSlug, xid: tenant.xid });
    try {
      await safeQueueEmail({
        context: req,
        operation: 'EMAIL_QUEUE',
        payload: { action: 'SIGNUP_WELCOME_EMAIL', tenantId: String(tenant.firmId), email: normalizedEmail },
        execute: async () => sendSignupWelcomeEmail({
          name: record.name,
          email: normalizedEmail,
          xid: tenant.xid,
          firmName: record.firmName,
          firmSlug: tenant.firmSlug,
          req,
        }),
      });
    } catch (emailError) {
      console.error('[PUBLIC_SIGNUP] Failed to queue welcome email after OTP verification:', emailError.message);
    }

    const token = jwtService.generateAccessToken({
      userId: String(tenant.userId),
      role: 'Admin',
      firmId: String(tenant.firmId),
      firmSlug: tenant.firmSlug,
      defaultClientId: String(tenant.defaultClientId),
      isSuperAdmin: false,
    });

    await enforceMinimumDuration(startedAt);
    return {
      success: true,
      message: 'Signup successful',
      token,
      xid: tenant.xid,
      firmSlug: tenant.firmSlug,
      firmUrl: tenant.firmUrl,
      redirectPath: `/${tenant.firmSlug}/login`,
    };
  } catch (error) {
    log.error('SIGNUP_FAILED', { req, email: normalizedEmail, reason: 'VERIFY_OTP_ERROR', error: error.message });
    await enforceMinimumDuration(startedAt);
    throw error;
  } finally {
    await releaseLock(lock);
  }
};

/**
 * Resend OTP for a temporary signup
 * @param {Object} params - { email }
 * @returns {Promise<Object>} result
 */
const resendOtp = async ({ email, req = null }) => {
  const startedAt = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  const resendQuota = await consumeOtpResendQuota({ email: normalizedEmail, ip: req?.ip });
  if (!resendQuota.allowed) {
    return { success: false, status: 429, message: 'Too many OTP resend requests. Please try again later.' };
  }
  const record = await TemporarySignup.findOne({ email: normalizedEmail, provider: 'manual' });

  if (!record) {
    await enforceMinimumDuration(startedAt);
    return { success: true, message: EMAIL_ENUMERATION_SAFE_MESSAGE };
  }

  const resendCount = resolveOtpResendCount(record);
  if (resendCount >= MAX_RESEND_COUNT) {
    return { success: false, status: 429, message: 'Maximum resend limit reached. Please initiate signup again.' };
  }

  const lastOtpSentAt = resolveOtpLastSentAt(record);
  if (lastOtpSentAt) {
    const secondsSinceLastOtp = (Date.now() - lastOtpSentAt.getTime()) / 1000;
    if (secondsSinceLastOtp < OTP_RESEND_COOLDOWN) {
      const waitSeconds = Math.ceil(OTP_RESEND_COOLDOWN - secondsSinceLastOtp);
      return {
        success: false,
        status: 429,
        message: `Please wait ${waitSeconds} seconds before requesting another OTP.`,
      };
    }
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  record.otpHash = otpHash;
  record.otpExpiresAt = otpExpiresAt;
  record.otpExpiry = otpExpiresAt;
  record.otpAttempts = 0;
  record.attemptCount = 0;
  record.otpBlockedUntil = null;
  record.otpResendCount = resendCount + 1;
  record.resendCount = resendCount + 1;
  record.otpLastSentAt = new Date();
  record.lastOtpSentAt = new Date();
  record.consumedAt = null;
  await record.save();

  await safeQueueEmail({
    context: req,
    operation: 'EMAIL_QUEUE',
    payload: { action: 'SIGNUP_OTP_RESEND_EMAIL', tenantId: null, email: normalizedEmail },
    execute: async () => emailService.sendEmail({
      to: normalizedEmail,
      subject: 'Docketra Signup – Your New Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${record.name},</h2>
          <p>Your new verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1976D2; margin: 20px 0;">${otp}</p>
          <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br>Docketra Team</p>
        </div>
      `,
      text: `Hello ${record.name},\n\nYour new verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nBest regards,\nDocketra Team`,
    }),
  });

  await logSignupAuthEvent({ eventType: 'OTP_SENT', email: normalizedEmail, req, metadata: { resend: true } });
  log.info('OTP_SENT', { req, email: normalizedEmail, event: 'OTP_RESENT' });
  await enforceMinimumDuration(startedAt);

  return { success: true, message: EMAIL_ENUMERATION_SAFE_MESSAGE };
};

const generateUniqueSlug = async (firmName, session, retryOffset = 0) => {
  let firmSlug = slugify(firmName.trim());
  const originalSlug = firmSlug;
  const existingSlugs = await Firm.find({
    firmSlug: { $regex: new RegExp(`^${originalSlug}(?:-\\d+)?$`) },
  }).session(session).select('firmSlug');

  if (existingSlugs.length > 0 || retryOffset > 0) {
    const maxSuffix = existingSlugs.reduce((max, doc) => {
      const match = doc.firmSlug.match(/-(\d+)$/);
      const suffixNumber = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, suffixNumber);
    }, 0);
    firmSlug = `${originalSlug}-${maxSuffix + retryOffset + 1}`;
  }
  return firmSlug;
};

/**
 * Generate the next firmId (FIRM001, FIRM002, etc.)
 * @param {object} session - MongoDB session
 * @returns {Promise<string>} firmId
 */
const generateFirmId = async (session) => {
  const lastFirm = await Firm.findOne({}, {}, { session }).sort({ createdAt: -1 });
  let firmNumber = 1;
  if (lastFirm && lastFirm.firmId) {
    const match = lastFirm.firmId.match(/FIRM(\d+)/);
    if (match) {
      firmNumber = parseInt(match[1], 10) + 1;
    }
  }
  return `FIRM${firmNumber.toString().padStart(3, '0')}`;
};

/**
 * Build firm URL based on available configuration
 * @param {string} firmSlug
 * @returns {string} firmUrl
 */
const buildFirmUrl = (firmSlug) => {
  const appRootDomain = process.env.APP_ROOT_DOMAIN;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (appRootDomain) {
    return `https://${firmSlug}.${appRootDomain}`;
  }
  return `${frontendUrl}/${firmSlug}/login`;
};

const sendSignupWelcomeEmail = async ({
  name,
  email,
  firmName,
  xid,
  firmSlug,
  req = null,
}) => {
  const workspaceUrl = buildFirmUrl(firmSlug);
  try {
    const emailResult = await emailService.sendFirmSetupEmail({
      name,
      email,
      xid,
      workspaceUrl,
      firmName,
      context: req,
    });

    if (!emailResult?.success) {
      const failureMessage = emailResult.error || 'Unknown email error';
      console.error('[PUBLIC_SIGNUP] Failed to send welcome email:', failureMessage);
      return { success: false, error: failureMessage };
    }

    console.info('[PUBLIC_SIGNUP] Welcome email sent successfully', {
      email,
      firmSlug,
      xid,
      queued: Boolean(emailResult?.queued),
      messageId: emailResult?.messageId || null,
    });
    return { success: true };
  } catch (emailError) {
    console.error('[PUBLIC_SIGNUP] Failed to send welcome email:', emailError.message);
    return { success: false, error: emailError.message };
  }
};

const createFirmAndAdmin = async ({
  name,
  email,
  firmName,
  passwordHash = null,
  phone = null,
  authProvider,
  googleSubject = null,
  session = null,
  req = null,
}) => {
  if (!session) {
    throw new Error('Transaction session is required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedFirmName = firmName.trim();
  const firmId = await generateFirmId(session);
  let firm = null;
  let firmSlug = null;
  let lastFirmCreateError = null;

  for (let attempt = 0; attempt < MAX_SLUG_COLLISION_RETRIES; attempt += 1) {
    firmSlug = await generateUniqueSlug(normalizedFirmName, session, attempt);
    try {
      [firm] = await Firm.create([{
        firmId,
        name: normalizedFirmName,
        firmSlug,
        plan: 'starter',
        maxUsers: 2,
        status: 'active',
        bootstrapStatus: 'PENDING',
      }], { session });
      break;
    } catch (error) {
      const duplicateSlug = error?.code === 11000 && (error?.keyPattern?.firmSlug || String(error?.message || '').includes('firmSlug'));
      if (!duplicateSlug) {
        throw error;
      }
      lastFirmCreateError = error;
    }
  }

  if (!firm) {
    throw lastFirmCreateError || new Error('Unable to create firm with unique slug');
  }

  await ensureTenantKey(String(firm._id), { session });

  const clientId = await generateNextClientId(firm._id, session);
  const [defaultClient] = await Client.create([{
    clientId,
    businessName: normalizedFirmName,
    businessAddress: DEFAULT_BUSINESS_ADDRESS,
    primaryContactNumber: DEFAULT_CONTACT_NUMBER,
    businessEmail: `${firmId.toLowerCase()}@${SYSTEM_EMAIL_DOMAIN}`,
    firmId: firm._id,
    isSystemClient: true,
    isInternal: true,
    createdBySystem: true,
    isActive: true,
    status: 'ACTIVE',
    createdByXid: 'SELF_SIGNUP',
    createdBy: normalizedEmail,
    storageType: 'docketra',
    storageProvider: null,
    storageConfig: null,
  }], { session });

  firm.defaultClientId = defaultClient._id;
  await firm.save({ session });

  const adminXID = await generateNextXID(firm._id, session);
  const isGoogleAuth = authProvider === 'google';
  const now = new Date();
  const [adminUser] = await User.create([{
    xID: adminXID,
    name: name.trim(),
    email: normalizedEmail,
    phoneNumber: normalizePhone(phone) || null,
    firmId: firm._id,
    defaultClientId: defaultClient._id,
    role: 'Admin',
    status: 'active',
    isActive: true,
    isSystem: true,
    isPrimaryAdmin: true,
    emailVerified: true,
    emailVerifiedAt: now,
    verificationMethod: isGoogleAuth ? 'GOOGLE' : 'OTP',
    termsAccepted: true,
    termsAcceptedAt: now,
    termsVersion: 'v1.0',
    signupIP: req?.ip || null,
    signupUserAgent: req?.headers?.['user-agent'] || null,
    passwordSet: authProvider === 'password',
    passwordHash: passwordHash || null,
    mustSetPassword: authProvider !== 'password',
    mustChangePassword: false,
    inviteSentAt: new Date(),
    authProviders: {
      local: {
        passwordHash: passwordHash || null,
        passwordSet: authProvider === 'password',
      },
      google: {
        googleId: authProvider === 'google' ? googleSubject : null,
        linkedAt: authProvider === 'google' ? now : null,
      },
    },
  }], { session });

  firm.bootstrapStatus = 'COMPLETED';
  await firm.save({ session });

  const firmUrl = buildFirmUrl(firmSlug);

  return {
    adminXID,
    firmSlug,
    firmUrl,
    firmId: firm._id,
    userId: adminUser._id,
    defaultClientId: defaultClient._id,
  };
};

const createTenant = async ({
  name,
  email,
  firmName,
  passwordHash,
  phone,
  session,
  req = null,
}) => {
  const existing = await findExistingSignupUser({
    email,
    phone,
    session,
  });

  if (existing) {
    const conflict = new Error('Email or phone number already registered');
    conflict.statusCode = 409;
    throw conflict;
  }

  const created = await createFirmAndAdmin({
    name,
    email,
    firmName,
    passwordHash: passwordHash || null,
    phone: phone || null,
    authProvider: 'password',
    session,
    req,
  });

  return {
    xid: created.adminXID,
    firmSlug: created.firmSlug,
    firmUrl: created.firmUrl,
    firmId: created.firmId,
    userId: created.userId,
    defaultClientId: created.defaultClientId,
  };
};

/**
 * Complete signup — transactional firm + admin creation
 * @param {Object} params - { email, firmName }
 * @returns {Promise<Object>} result with xid and firmUrl
 */
const completeSignup = async ({ email, firmName, session, req = null }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await TemporarySignup.findOne({ email: normalizedEmail, isVerified: true });

  if (!record) {
    return { success: false, status: 400, message: 'No verified signup found. Please complete verification first.' };
  }
  if (resolveConsumedAt(record)) {
    return { success: false, status: 400, message: 'Verification failed' };
  }

  const resolvedFirmName = (firmName || record.firmName || '').trim();
  if (!resolvedFirmName) {
    return { success: false, status: 400, message: 'Firm name is required' };
  }

  try {
    if (record.provider !== 'manual') {
      return { success: false, status: 400, message: 'Unsupported signup provider' };
    }

    const result = await createFirmAndAdmin({
      name: record.name,
      email: normalizedEmail,
      firmName: resolvedFirmName,
      passwordHash: record.passwordHash || null,
      phone: record.phone || null,
      authProvider: 'password',
      session,
      req,
    });
    await TemporarySignup.deleteOne({ _id: record._id }, { session });
    await logSignupAuthEvent({
      eventType: 'SIGNUP_COMPLETED',
      email: normalizedEmail,
      req,
      metadata: { firmSlug: result.firmSlug },
    });

    await safeQueueEmail({
      context: req,
      operation: 'EMAIL_QUEUE',
      payload: { action: 'SIGNUP_WELCOME_EMAIL', tenantId: String(result.firmId || ''), email: normalizedEmail },
      execute: async () => sendSignupWelcomeEmail({
        name: record.name,
        email: normalizedEmail,
        xid: result.adminXID,
        firmName: resolvedFirmName,
        firmSlug: result.firmSlug,
        req,
      }),
    });

    return {
      success: true,
      message: 'Signup successful',
      xid: result.adminXID,
      firmUrl: result.firmUrl,
      firmSlug: result.firmSlug,
      redirectPath: `/${result.firmSlug}/login`,
    };
  } catch (error) {
    console.error('[PUBLIC_SIGNUP] Complete signup failed:', error.message);
    return { success: false, status: 500, message: 'Signup failed. Please try again.' };
  }
};

const resendCredentialsEmail = async ({ email, req = null }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const responseMessage = 'If an account exists, credentials have been sent to your email.';

  const adminUser = await User.findOne({
    email: normalizedEmail,
    isSystem: true,
    role: 'Admin',
    status: { $ne: 'deleted' },
  }).select('name email xID firmId').lean();

  if (!adminUser) {
    console.warn('[PUBLIC_SIGNUP] resendCredentials requested for unknown email');
    return { success: true, message: responseMessage };
  }

  const firm = await Firm.findById(adminUser.firmId).select('name firmSlug').lean();
  if (!firm || !firm.firmSlug) {
    console.error('[PUBLIC_SIGNUP] Unable to resend credentials email. Firm context missing.', {
      firmId: adminUser.firmId ? String(adminUser.firmId) : null,
    });
    return { success: true, message: responseMessage };
  }

  const emailResult = await sendSignupWelcomeEmail({
    name: adminUser.name,
    email: normalizedEmail,
    xid: adminUser.xID,
    firmName: firm.name,
    firmSlug: firm.firmSlug,
    req,
  });
  if (!emailResult.success) {
    console.error('[PUBLIC_SIGNUP] resendCredentials email delivery failed', {
      firmId: adminUser.firmId ? String(adminUser.firmId) : null,
      reason: emailResult.error || 'Unknown email error',
    });
  }

  return { success: true, message: responseMessage };
};

module.exports = {
  initiateSignup,
  verifyOtp,
  resendOtp,
  createTenant,
  createFirmAndAdmin,
  completeSignup,
  generateOtp,
  isEmailFirmOwner,
  buildFirmUrl,
  resendCredentialsEmail,
  // Backward-compatible aliases
  initiateManualSignup: initiateSignup,
  verifySignupOtp: verifyOtp,
  resendSignupOtp: resendOtp,
};
