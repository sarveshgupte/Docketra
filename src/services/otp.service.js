const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Otp = require('../models/Otp.model');
const User = require('../models/User.model');
const emailService = require('./email.service');

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_SECONDS = 60;
const OTP_VERIFICATION_TOKEN_EXPIRY = '10m';

const normalizeIdentifier = async ({ email, xid, xID, XID, identifier }) => {
  const raw = identifier ? String(identifier).trim() : null;

  if (email || (raw && raw.includes('@'))) {
    return String(email || raw).trim().toLowerCase();
  }

  const normalizedXid = String(xID || XID || xid || raw || '').trim().toUpperCase();
  if (!normalizedXid) throw new Error('IDENTIFIER_REQUIRED');

  const user = await User.findOne({
    $or: [{ xID: normalizedXid }, { xid: normalizedXid }],
  }).select('primary_email email');
  if (!user) throw new Error('IDENTIFIER_NOT_FOUND');

  const canonicalEmail = String(user.primary_email || user.email || '').trim().toLowerCase();
  if (!canonicalEmail) throw new Error('IDENTIFIER_NOT_FOUND');

  return canonicalEmail;
};

const generateOtpCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const sendOtp = async ({ email, xid, xID, XID, identifier, purpose }) => {
  const resolvedIdentifier = await normalizeIdentifier({ email, xid, xID, XID, identifier });

  const latestOtp = await Otp.findOne({ identifier: resolvedIdentifier, purpose }).sort({ created_at: -1 });
  if (latestOtp && (Date.now() - new Date(latestOtp.created_at).getTime()) < (OTP_RATE_LIMIT_SECONDS * 1000)) {
    const error = new Error('OTP_RATE_LIMITED');
    error.retryAfterSeconds = OTP_RATE_LIMIT_SECONDS;
    throw error;
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    identifier: resolvedIdentifier,
    code,
    purpose,
    expires_at: expiresAt,
    attempts: 0,
    is_used: false,
  });

  await emailService.sendLoginOtpEmail({
    email: resolvedIdentifier,
    otp: code,
    expiryMinutes: OTP_EXPIRY_MINUTES,
  });

  return {
    identifier: resolvedIdentifier,
    expiresAt,
    retryAfterSeconds: OTP_RATE_LIMIT_SECONDS,
  };
};

const verifyOtp = async ({ identifier, code, purpose }) => {
  const rawIdentifier = identifier.trim();
  const isEmail = rawIdentifier.includes('@');
  let normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier.toUpperCase();

  if (!isEmail) {
    const user = await User.findOne({
      $or: [{ xID: normalizedIdentifier }, { xid: normalizedIdentifier }],
    }).select('primary_email email');
    if (!user) throw new Error('IDENTIFIER_NOT_FOUND');
    normalizedIdentifier = (user.primary_email || user.email || '').toLowerCase();
  }

  const otp = await Otp.findOne({
    identifier: normalizedIdentifier,
    purpose,
    is_used: false,
  }).sort({ created_at: -1 });

  if (!otp) throw new Error('OTP_NOT_FOUND');
  if (otp.expires_at.getTime() < Date.now()) throw new Error('OTP_EXPIRED');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new Error('OTP_ATTEMPTS_EXCEEDED');

  if (otp.code !== code) {
    otp.attempts += 1;
    await otp.save();
    throw new Error('OTP_INVALID');
  }

  otp.is_used = true;
  await otp.save();

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET_MISSING');

  const jti = crypto.randomUUID();
  const verificationToken = jwt.sign({
    type: 'otp_verification',
    identifier: normalizedIdentifier,
    purpose,
    jti,
  }, secret, {
    expiresIn: OTP_VERIFICATION_TOKEN_EXPIRY,
    issuer: 'docketra',
    audience: 'docketra-api',
    algorithm: 'HS256',
  });

  return {
    identifier: normalizedIdentifier,
    verificationToken,
    expiresIn: OTP_VERIFICATION_TOKEN_EXPIRY,
    jti,
  };
};

module.exports = {
  sendOtp,
  verifyOtp,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
};
