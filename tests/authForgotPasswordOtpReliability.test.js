#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createAuthPasswordService = require('../src/services/authPassword.service');

const GENERIC_INIT_MESSAGE = 'If the account exists, an OTP has been sent to email.';

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return payload; },
});

const createHarness = () => {
  const firms = [
    { _id: 'firm-a', name: 'Firm A', firmSlug: 'firm-a', status: 'active' },
    { _id: 'firm-b', name: 'Firm B', firmSlug: 'firm-b', status: 'active' },
  ];
  const users = [
    {
      _id: 'user-a',
      email: 'alpha@example.com',
      name: 'Alpha',
      xID: 'X111111',
      firmId: 'firm-a',
      status: 'active',
      isActive: true,
      forgotPasswordOtpHash: null,
      forgotPasswordOtpExpiresAt: null,
      forgotPasswordOtpAttempts: 0,
      forgotPasswordOtpLastSentAt: null,
      forgotPasswordOtpLockedUntil: null,
      forgotPasswordOtpResendCount: 0,
      forgotPasswordResetTokenHash: null,
      forgotPasswordResetTokenExpiresAt: null,
      save: async function save() { return this; },
    },
    {
      _id: 'user-b',
      email: 'beta@example.com',
      name: 'Beta',
      xID: 'X222222',
      firmId: 'firm-b',
      status: 'active',
      isActive: true,
      forgotPasswordOtpHash: null,
      forgotPasswordOtpExpiresAt: null,
      forgotPasswordOtpAttempts: 0,
      forgotPasswordOtpLastSentAt: null,
      forgotPasswordOtpLockedUntil: null,
      forgotPasswordOtpResendCount: 0,
      forgotPasswordResetTokenHash: null,
      forgotPasswordResetTokenExpiresAt: null,
      save: async function save() { return this; },
    },
  ];

  const sentForgotPasswordOtps = [];
  const sentLoginOtps = [];
  let tokenCounter = 0;

  const matchQuery = (record, query) => Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && '$ne' in value) return record[key] !== value.$ne;
    return record[key] === value;
  });

  const Firm = {
    findOne: (query) => ({
      select: () => ({
        lean: async () => firms.find((f) => matchQuery(f, query)) || null,
      }),
    }),
    findById: (id) => ({
      select: () => ({
        lean: async () => firms.find((f) => f._id === id) || null,
      }),
    }),
  };

  const User = {
    findOne: async (query) => users.find((u) => matchQuery(u, query)) || null,
    find: (query) => ({ limit: async (n) => users.filter((u) => matchQuery(u, query)).slice(0, n) }),
  };

  const service = createAuthPasswordService({
    normalizeFirmSlug: (value) => (value ? String(value).trim().toLowerCase() : null),
    Firm,
    User,
    emailService: {
      sendForgotPasswordOtpEmail: async (payload) => { sentForgotPasswordOtps.push(payload); },
      sendLoginOtpEmail: async (payload) => { sentLoginOtps.push(payload); },
      generateSecureToken: () => 'legacy-token',
      hashToken: (value) => `legacy-hash:${value}`,
      sendForgotPasswordEmail: async () => ({ success: true }),
      maskEmail: (email) => email,
    },
    isActiveStatus: (status) => status === 'active',
    FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES: 30,
    logAuthAudit: async () => {},
    FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS: 0,
    FORGOT_PASSWORD_OTP_EXPIRY_MINUTES: 10,
    FORGOT_PASSWORD_OTP_LOCK_MINUTES: 10,
    authOtpService: {
      generateOtp: () => '123456',
      hashOtp: async (otp) => `hash:${otp}`,
      verifyOtp: async (otp, hash) => hash === `hash:${otp}`,
      incrementAttempts: (attempts, max) => {
        const next = attempts + 1;
        return { attempts: next, exhausted: next >= max };
      },
    },
    SALT_ROUNDS: 10,
    DEFAULT_XID: 'X000001',
    DEFAULT_FIRM_ID: 'PLATFORM',
    clearForgotPasswordOtpState: (user) => {
      user.forgotPasswordOtpHash = null;
      user.forgotPasswordOtpExpiresAt = null;
      user.forgotPasswordOtpAttempts = 0;
      user.forgotPasswordOtpLastSentAt = null;
      user.forgotPasswordOtpLockedUntil = null;
      user.forgotPasswordOtpResendCount = 0;
    },
    generateLoginSessionToken: () => `reset-${++tokenCounter}`,
    hashLoginSessionToken: (value) => `token-hash:${value}`,
    validatePasswordStrength: () => true,
    PASSWORD_POLICY_MESSAGE: 'weak password',
    bcrypt: { hash: async (value) => `bcrypt:${value}` },
  });

  return { service, users, sentForgotPasswordOtps, sentLoginOtps };
};

const reqFor = (body) => ({ body, ip: '127.0.0.1', get: () => 'test-agent' });

async function run() {
  console.log('Running auth forgot-password OTP reliability tests...');
  const { service, users, sentForgotPasswordOtps, sentLoginOtps } = createHarness();

  const initXidRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'X111111', firmSlug: 'firm-a' }), initXidRes);
  assert.strictEqual(initXidRes.statusCode, 200);
  assert.strictEqual(initXidRes.body.success, true);
  assert.strictEqual(initXidRes.body.message, GENERIC_INIT_MESSAGE);
  console.log('  ✓ firm init succeeds with xID and safe response');

  const initEmailRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a' }), initEmailRes);
  assert.strictEqual(initEmailRes.statusCode, 200);
  assert.strictEqual(initEmailRes.body.success, true);
  assert.strictEqual(initEmailRes.body.message, GENERIC_INIT_MESSAGE);
  assert.strictEqual(sentForgotPasswordOtps.length, 2);
  assert.strictEqual(sentLoginOtps.length, 0);
  assert.match(sentForgotPasswordOtps[0].firmName, /Firm A/i);
  assert.match(sentForgotPasswordOtps[0].firmSlug, /firm-a/i);
  console.log('  ✓ firm init succeeds with email and safe response');

  const initUnknownRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'unknown@example.com', firmSlug: 'firm-a' }), initUnknownRes);
  assert.deepStrictEqual(initUnknownRes.body, { success: true, message: GENERIC_INIT_MESSAGE });
  console.log('  ✓ unknown identifier returns generic safe init response');

  const verifyGoodRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', otp: '123456' }), verifyGoodRes);
  assert.strictEqual(verifyGoodRes.statusCode, 200);
  assert.strictEqual(verifyGoodRes.body.success, true);
  const resetToken = verifyGoodRes.body.resetToken;
  assert.ok(resetToken);
  console.log('  ✓ verify succeeds with valid OTP');

  const verifyBadRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', otp: '000000' }), verifyBadRes);
  assert.strictEqual(verifyBadRes.statusCode, 401);
  console.log('  ✓ verify rejects invalid OTP');

  const resetOkRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', resetToken, password: 'Strong#1234' }), resetOkRes);
  assert.strictEqual(resetOkRes.statusCode, 200);
  assert.strictEqual(resetOkRes.body.success, true);
  const userA = users.find((u) => u._id === 'user-a');
  assert.strictEqual(userA.forgotPasswordOtpHash, null);
  assert.strictEqual(userA.forgotPasswordOtpExpiresAt, null);
  assert.strictEqual(userA.forgotPasswordOtpAttempts, 0);
  assert.strictEqual(userA.forgotPasswordOtpLockedUntil, null);
  assert.strictEqual(userA.forgotPasswordOtpResendCount, 0);
  assert.strictEqual(userA.forgotPasswordResetTokenHash, null);
  assert.strictEqual(userA.forgotPasswordResetTokenExpiresAt, null);
  console.log('  ✓ reset succeeds and clears OTP/reset state');

  const resetReuseRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', resetToken, password: 'Strong#1234' }), resetReuseRes);
  assert.strictEqual(resetReuseRes.statusCode, 401);
  console.log('  ✓ reset token cannot be reused');

  const otpReuseRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', otp: '123456' }), otpReuseRes);
  assert.strictEqual(otpReuseRes.statusCode, 401);
  console.log('  ✓ OTP cannot be reused after successful reset');

  const initCrossRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'X111111', firmSlug: 'firm-a' }), initCrossRes);
  const verifyCrossRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'X111111', firmSlug: 'firm-a', otp: '123456' }), verifyCrossRes);
  const crossToken = verifyCrossRes.body.resetToken;
  const resetCrossTenantRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'X111111', firmSlug: 'firm-b', resetToken: crossToken, password: 'Strong#1234' }), resetCrossTenantRes);
  assert.strictEqual(resetCrossTenantRes.statusCode, 401);
  console.log('  ✓ cross-tenant reset attempt is blocked');

  const initExpiryRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'X222222', firmSlug: 'firm-b' }), initExpiryRes);
  const userB = users.find((u) => u._id === 'user-b');
  userB.forgotPasswordOtpExpiresAt = new Date(Date.now() - 1000);
  const verifyExpiredRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'X222222', firmSlug: 'firm-b', otp: '123456' }), verifyExpiredRes);
  assert.strictEqual(verifyExpiredRes.statusCode, 401);

  await service.forgotPasswordInit(reqFor({ identifier: 'X222222', firmSlug: 'firm-b' }), createMockRes());
  const verifyForExpiryRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'X222222', firmSlug: 'firm-b', otp: '123456' }), verifyForExpiryRes);
  const expiringToken = verifyForExpiryRes.body.resetToken;
  userB.forgotPasswordResetTokenExpiresAt = new Date(Date.now() - 1000);
  const resetExpiredRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'X222222', firmSlug: 'firm-b', resetToken: expiringToken, password: 'Strong#1234' }), resetExpiredRes);
  assert.strictEqual(resetExpiredRes.statusCode, 401);
  console.log('  ✓ expired OTP and reset token are rejected');

  await service.forgotPasswordInit(reqFor({ identifier: 'X222222', firmSlug: 'firm-b' }), createMockRes());
  userB.forgotPasswordOtpAttempts = 5;
  const lockedRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'X222222', firmSlug: 'firm-b', otp: '123456' }), lockedRes);
  assert.strictEqual(lockedRes.statusCode, 429);
  console.log('  ✓ locked OTP state rejects verify attempts');

  console.log('All auth forgot-password OTP reliability tests passed.');
}

run().catch((error) => {
  console.error('auth forgot-password OTP reliability tests failed:', error);
  process.exit(1);
});
