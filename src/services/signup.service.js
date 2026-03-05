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
const RefreshToken = require('../models/RefreshToken.model');

const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const MAX_RESEND_COUNT = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const SYSTEM_EMAIL_DOMAIN = 'system.local';
const DEFAULT_BUSINESS_ADDRESS = 'Default Address';
const DEFAULT_CONTACT_NUMBER = '0000000000';

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
const initiateManualSignup = async ({ name, email, password, phone, session = null }) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (await isEmailFirmOwner(normalizedEmail)) {
    return { success: false, status: 409, message: 'Email is already associated with a firm' };
  }

  // Remove any existing temporary signup for this email
  await TemporarySignup.deleteMany({ email: normalizedEmail }, { session });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);

  await TemporarySignup.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    phone: phone || null,
    provider: 'manual',
    otpHash,
    otpExpiry: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    otpAttempts: 0,
    resendCount: 0,
    lastOtpSentAt: new Date(),
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

  return { success: true, message: 'OTP sent to your email' };
};

/**
 * Verify OTP for a temporary signup
 * @param {Object} params - { email, otp }
 * @returns {Promise<Object>} result
 */
const verifySignupOtp = async ({ email, otp }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await TemporarySignup.findOne({ email: normalizedEmail, provider: 'manual' });

  if (!record) {
    return { success: false, status: 404, message: 'No signup request found. Please initiate signup first.' };
  }

  if (record.otpAttempts >= MAX_OTP_ATTEMPTS) {
    return { success: false, status: 429, message: 'Too many OTP attempts. Please initiate signup again.' };
  }

  if (!record.otpExpiry || record.otpExpiry < new Date()) {
    return { success: false, status: 400, message: 'OTP has expired. Please request a new one.' };
  }

  record.otpAttempts += 1;

  const isValid = await bcrypt.compare(otp, record.otpHash);
  if (!isValid) {
    await record.save();
    return { success: false, status: 400, message: 'Invalid OTP' };
  }

  record.isVerified = true;
  await record.save();

  return { success: true, message: 'Email verified successfully' };
};

/**
 * Resend OTP for a temporary signup
 * @param {Object} params - { email }
 * @returns {Promise<Object>} result
 */
const resendSignupOtp = async ({ email }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await TemporarySignup.findOne({ email: normalizedEmail, provider: 'manual' });

  if (!record) {
    return { success: false, status: 404, message: 'No signup request found. Please initiate signup first.' };
  }

  if (record.resendCount >= MAX_RESEND_COUNT) {
    return { success: false, status: 429, message: 'Maximum resend limit reached. Please initiate signup again.' };
  }

  if (record.lastOtpSentAt && (Date.now() - record.lastOtpSentAt.getTime()) < RESEND_COOLDOWN_SECONDS * 1000) {
    return { success: false, status: 429, message: `Please wait ${RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP.` };
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);

  record.otpHash = otpHash;
  record.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  record.otpAttempts = 0;
  record.resendCount += 1;
  record.lastOtpSentAt = new Date();
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

  return { success: true, message: 'New OTP sent to your email' };
};

/**
 * Google OAuth signup flow
 * @param {Object} params - { name, email }
 * @returns {Promise<Object>} result
 */
const googleSignup = async ({ name, email }) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (await isEmailFirmOwner(normalizedEmail)) {
    return { success: false, status: 409, message: 'Email is already associated with a firm' };
  }

  // Remove any existing temporary signup for this email
  await TemporarySignup.deleteMany({ email: normalizedEmail });

  await TemporarySignup.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: null,
    provider: 'google',
    isVerified: true,
  });

  return { success: true, message: 'Google account verified. Please complete signup.' };
};

/**
 * Generate a unique firm slug, appending -1, -2, etc. if needed.
 * @param {string} firmName
 * @param {object} session - MongoDB session
 * @returns {Promise<string>} unique slug
 */
const generateUniqueSlug = async (firmName, session) => {
  let firmSlug = slugify(firmName.trim());
  const originalSlug = firmSlug;
  const existingSlugs = await Firm.find({
    firmSlug: { $regex: new RegExp(`^${originalSlug}(?:-\\d+)?$`) },
  }).session(session).select('firmSlug');

  if (existingSlugs.length > 0) {
    const maxSuffix = existingSlugs.reduce((max, doc) => {
      const match = doc.firmSlug.match(/-(\d+)$/);
      const suffixNumber = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, suffixNumber);
    }, 0);
    firmSlug = `${originalSlug}-${maxSuffix + 1}`;
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

const generateAndStoreRefreshToken = async ({ req, userId, firmId, session }) => {
  const refreshToken = jwtService.generateRefreshToken();
  const tokenHash = jwtService.hashRefreshToken(refreshToken);
  const expiresAt = jwtService.getRefreshTokenExpiry();

  await RefreshToken.create([{
    tokenHash,
    userId,
    firmId: firmId ? String(firmId) : null,
    expiresAt,
    ipAddress: req?.ip,
    userAgent: req?.get?.('user-agent'),
  }], { session });

  return refreshToken;
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
  const firmSlug = await generateUniqueSlug(normalizedFirmName, session);
  const firmId = await generateFirmId(session);

  const [firm] = await Firm.create([{
    firmId,
    name: normalizedFirmName,
    firmSlug,
    plan: 'starter',
    maxUsers: 2,
    status: 'active',
    bootstrapStatus: 'PENDING',
  }], { session });

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
    status: 'active',
    createdByXid: 'SELF_SIGNUP',
    createdBy: normalizedEmail,
  }], { session });

  firm.defaultClientId = defaultClient._id;
  await firm.save({ session });

  const adminXID = await generateNextXID(firm._id, session);
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
        linkedAt: authProvider === 'google' ? new Date() : null,
      },
    },
  }], { session });

  firm.bootstrapStatus = 'COMPLETED';
  await firm.save({ session });

  const accessToken = jwtService.generateAccessToken({
    userId: adminUser._id.toString(),
    firmId: firm._id.toString(),
    firmSlug,
    defaultClientId: defaultClient._id.toString(),
    role: adminUser.role,
  });
  const refreshToken = await generateAndStoreRefreshToken({
    req,
    userId: adminUser._id,
    firmId: firm._id,
    session,
  });

  const firmUrl = buildFirmUrl(firmSlug);

  return {
    adminXID,
    firmSlug,
    firmUrl,
    accessToken,
    refreshToken,
  };
};

const signupWithPassword = async ({ name, email, password, firmName, phone, session, req }) => {
  const normalizedEmail = email.toLowerCase().trim();
  if (await isEmailFirmOwner(normalizedEmail)) {
    return { success: false, status: 409, message: 'Email is already associated with a firm' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await createFirmAndAdmin({
    name,
    email: normalizedEmail,
    firmName,
    passwordHash,
    phone: phone || null,
    authProvider: 'password',
    session,
    req,
  });

  try {
    await emailService.sendFirmSetupEmail({
      email: normalizedEmail,
      name: name.trim(),
      xid: result.adminXID,
      firmName: firmName.trim(),
      workspaceUrl: result.firmUrl,
    });
  } catch (emailError) {
    console.error('[PUBLIC_SIGNUP] Failed to send setup email:', emailError.message);
  }

  return {
    success: true,
    message: 'Signup successful',
    xid: result.adminXID,
    firmUrl: result.firmUrl,
    firmSlug: result.firmSlug,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    redirectPath: `/app/firm/${result.firmSlug}/dashboard`,
  };
};

const signupWithGoogle = async ({ name, email, firmName, googleSubject, session, req }) => {
  const normalizedEmail = email.toLowerCase().trim();
  if (await isEmailFirmOwner(normalizedEmail)) {
    return { success: false, status: 409, message: 'Email is already associated with a firm' };
  }

  const result = await createFirmAndAdmin({
    name,
    email: normalizedEmail,
    firmName,
    authProvider: 'google',
    googleSubject,
    session,
    req,
  });

  try {
    await emailService.sendFirmSetupEmail({
      email: normalizedEmail,
      name: name.trim(),
      xid: result.adminXID,
      firmName: firmName.trim(),
      workspaceUrl: result.firmUrl,
    });
  } catch (emailError) {
    console.error('[PUBLIC_SIGNUP] Failed to send setup email:', emailError.message);
  }

  return {
    success: true,
    message: 'Signup successful',
    xid: result.adminXID,
    firmUrl: result.firmUrl,
    firmSlug: result.firmSlug,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    redirectPath: `/app/firm/${result.firmSlug}/dashboard`,
  };
};

/**
 * Complete signup — transactional firm + admin creation
 * @param {Object} params - { email, firmName }
 * @returns {Promise<Object>} result with xid and firmUrl
 */
const completeSignup = async ({ email, firmName, session, req }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await TemporarySignup.findOne({ email: normalizedEmail, isVerified: true });

  if (!record) {
    return { success: false, status: 400, message: 'No verified signup found. Please complete verification first.' };
  }

  if (!firmName || !firmName.trim()) {
    return { success: false, status: 400, message: 'Firm name is required' };
  }

  try {
    let authProvider = null;
    if (record.provider === 'manual') {
      authProvider = 'password';
    } else if (record.provider === 'google') {
      authProvider = 'google';
    } else {
      return { success: false, status: 400, message: 'Unsupported signup provider' };
    }

    const result = await createFirmAndAdmin({
      name: record.name,
      email: normalizedEmail,
      firmName,
      passwordHash: record.passwordHash || null,
      phone: record.phone || null,
      authProvider,
      session,
      req,
    });
    await TemporarySignup.deleteOne({ _id: record._id }, { session });

    // Send welcome email (non-blocking — failure does not affect signup result)
    try {
      await emailService.sendFirmSetupEmail({
        name: record.name,
        email: normalizedEmail,
        xid: result.adminXID,
        workspaceUrl: result.firmUrl,
        firmName: firmName.trim(),
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
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      redirectPath: `/app/firm/${result.firmSlug}/dashboard`,
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
  signupWithPassword,
  signupWithGoogle,
  createFirmAndAdmin,
  googleSignup,
  completeSignup,
  generateOtp,
  isEmailFirmOwner,
  buildFirmUrl,
};
