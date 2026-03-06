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
const { logAuthEvent } = require('./audit.service');

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_BLOCK_MINUTES = 15;
const MAX_RESEND_COUNT = 5;
const MAX_SLUG_COLLISION_RETRIES = 5;
const OTP_RESEND_COOLDOWN = 60;
const SYSTEM_EMAIL_DOMAIN = 'system.local';
const DEFAULT_BUSINESS_ADDRESS = 'Default Address';
const DEFAULT_CONTACT_NUMBER = '0000000000';

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
    await logAuthEvent({
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

/**
 * Generate a 6-digit numeric OTP using rejection sampling to avoid modulo bias.
 * @returns {string} 6-digit OTP string
 */
const generateOtp = () => {
  const max = 999999;
  const limit = max + 1; // 1000000
  // 3 bytes = 16777216 possible values; largest unbiased multiple of 1000000 is 16000000
  const threshold = Math.floor(16777216 / limit) * limit;
  let num;
  do {
    num = crypto.randomBytes(3).readUIntBE(0, 3);
  } while (num >= threshold);
  return String(num % limit).padStart(6, '0');
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

/**
 * Initiate a manual signup flow
 * @param {Object} params - { name, email, password, phone }
 * @returns {Promise<Object>} result
 */
const initiateManualSignup = async ({ name, email, password, phone, firmName, session = null, req = null }) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (await isEmailFirmOwner(normalizedEmail)) {
    return { success: false, status: 409, message: 'Email is already associated with a firm' };
  }

  await TemporarySignup.deleteMany({
    $or: [
      { otpExpiresAt: { $lt: new Date() } },
      { otpExpiry: { $lt: new Date() } },
    ],
  }, { session });

  // Remove any existing temporary signup for this email
  await TemporarySignup.deleteMany({ email: normalizedEmail }, { session });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const now = new Date();

  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await TemporarySignup.create({
    name: name.trim(),
    email: normalizedEmail,
    firmName: firmName.trim(),
    passwordHash,
    phone: phone || null,
    provider: 'manual',
    otpHash,
    otpExpiresAt,
    // Legacy compatibility field retained for old records/read paths.
    otpExpiry: otpExpiresAt,
    otpAttempts: 0,
    otpBlockedUntil: null,
    otpResendCount: 0,
    resendCount: 0,
    otpLastSentAt: now,
    lastOtpSentAt: now,
    isVerified: false,
  }, { session });

  // Send OTP email
  await emailService.sendEmail({
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
  });

  await logSignupAuthEvent({ eventType: 'SIGNUP_INITIATED', email: normalizedEmail, req });
  await logSignupAuthEvent({ eventType: 'OTP_SENT', email: normalizedEmail, req });

  return { success: true, message: 'OTP sent to your email' };
};

/**
 * Verify OTP for a temporary signup
 * @param {Object} params - { email, otp }
 * @returns {Promise<Object>} result
 */
const verifySignupOtp = async ({ email, otp, req = null }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await TemporarySignup.findOne({ email: normalizedEmail, provider: 'manual' });
  const nowMs = Date.now();

  if (!record) {
    return { success: false, status: 404, message: 'No signup request found. Please initiate signup first.' };
  }

  if (record.otpBlockedUntil && record.otpBlockedUntil.getTime() > nowMs) {
    const secondsRemaining = Math.ceil((record.otpBlockedUntil.getTime() - nowMs) / 1000);
    return {
      success: false,
      status: 429,
      message: `Too many incorrect OTP attempts. Please try again in ${secondsRemaining} seconds.`,
      retryAfterSeconds: secondsRemaining,
    };
  }

  if (record.otpBlockedUntil && record.otpBlockedUntil.getTime() <= nowMs) {
    record.otpAttempts = 0;
    record.otpBlockedUntil = null;
    await record.save();
  }

  const otpExpiry = resolveOtpExpiry(record);
  if (!otpExpiry || otpExpiry.getTime() < nowMs) {
    return { success: false, status: 400, message: 'OTP has expired. Please request a new OTP.' };
  }

  const isValid = await bcrypt.compare(otp, record.otpHash);
  if (!isValid) {
    record.otpAttempts = (record.otpAttempts ?? 0) + 1;
    if (record.otpAttempts >= MAX_OTP_ATTEMPTS) {
      record.otpBlockedUntil = new Date(Date.now() + OTP_BLOCK_MINUTES * 60 * 1000);
      const secondsRemaining = OTP_BLOCK_MINUTES * 60;
      await record.save();
      return {
        success: false,
        status: 429,
        message: `Too many incorrect OTP attempts. Please try again in ${secondsRemaining} seconds.`,
        retryAfterSeconds: secondsRemaining,
      };
    }
    await record.save();
    return { success: false, status: 400, message: 'Invalid OTP' };
  }

  record.isVerified = true;
  record.otpAttempts = 0;
  record.otpBlockedUntil = null;
  await record.save();
  const activeSession = typeof record.$session === 'function' ? record.$session() : null;
  await User.updateOne(
    { email: normalizedEmail, status: { $ne: 'deleted' } },
    {
      $set: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        verificationMethod: 'OTP',
      },
    },
    activeSession ? { session: activeSession } : undefined
  );
  await logSignupAuthEvent({ eventType: 'OTP_VERIFIED', email: normalizedEmail, req });

  return { success: true, message: 'Email verified successfully' };
};

/**
 * Resend OTP for a temporary signup
 * @param {Object} params - { email }
 * @returns {Promise<Object>} result
 */
const resendSignupOtp = async ({ email, req = null }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await TemporarySignup.findOne({ email: normalizedEmail, provider: 'manual' });

  if (!record) {
    return { success: false, status: 404, message: 'No signup request found. Please initiate signup first.' };
  }

  const resendCount = resolveOtpResendCount(record);
  if (resendCount >= MAX_RESEND_COUNT) {
    return { success: false, status: 429, message: 'Maximum resend limit reached. Please initiate signup again.' };
  }

  const lastOtpSentAt = resolveOtpLastSentAt(record);
  const now = new Date();
  const secondsSinceLastOtp = lastOtpSentAt ? (now.getTime() - lastOtpSentAt.getTime()) / 1000 : Number.POSITIVE_INFINITY;
  if (secondsSinceLastOtp < OTP_RESEND_COOLDOWN) {
    const secondsRemaining = Math.ceil(OTP_RESEND_COOLDOWN - secondsSinceLastOtp);
    return {
      success: false,
      status: 429,
      message: `Please wait ${secondsRemaining} seconds before requesting another OTP.`,
    };
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  record.otpHash = otpHash;
  record.otpExpiresAt = otpExpiresAt;
  record.otpExpiry = otpExpiresAt;
  record.otpAttempts = 0;
  record.otpBlockedUntil = null;
  record.otpResendCount = resendCount + 1;
  record.resendCount = resendCount + 1;
  record.otpLastSentAt = now;
  record.lastOtpSentAt = now;
  await record.save();

  await emailService.sendEmail({
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
  });

  await logSignupAuthEvent({ eventType: 'OTP_SENT', email: normalizedEmail, req, metadata: { resend: true } });

  return { success: true, message: 'New OTP sent to your email' };
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
    phoneNumber: phone || null,
    firmId: firm._id,
    defaultClientId: defaultClient._id,
    role: 'Admin',
    status: 'active',
    isActive: true,
    isSystem: true,
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

    // Send welcome email (non-blocking — failure does not affect signup result)
    try {
      await emailService.sendFirmSetupEmail({
        name: record.name,
        email: normalizedEmail,
        xid: result.adminXID,
        workspaceUrl: result.firmUrl,
        firmName: resolvedFirmName,
      });
    } catch (emailError) {
      console.error('[PUBLIC_SIGNUP] Failed to send welcome email:', emailError.message);
    }

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

module.exports = {
  initiateManualSignup,
  verifySignupOtp,
  resendSignupOtp,
  createFirmAndAdmin,
  completeSignup,
  generateOtp,
  isEmailFirmOwner,
  buildFirmUrl,
};
