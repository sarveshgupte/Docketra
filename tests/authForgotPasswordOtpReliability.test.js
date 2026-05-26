#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createAuthPasswordService = require('../src/services/authPassword.service');

const GENERIC_INIT_MESSAGE = 'If the account exists, an OTP has been sent to email.';

const createMockRes = () => ({ statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(payload){ this.body = payload; return payload; } });

const createHarness = ({ failForgotOtpSend = false, throwOnVerify = false } = {}) => {
  const firms = [{ _id: 'firm-a', name: 'Firm A', firmSlug: 'firm-a', status: 'active' }];
  const users = [{ _id: 'user-a', email: 'alpha@example.com', name: 'Alpha', xID: 'X111111', firmId: 'firm-a', status: 'active', isActive: true, forgotPasswordOtpHash: null, forgotPasswordOtpExpiresAt: null, forgotPasswordOtpAttempts: 0, forgotPasswordOtpLastSentAt: null, forgotPasswordOtpLockedUntil: null, forgotPasswordOtpResendCount: 0, forgotPasswordResetTokenHash: null, forgotPasswordResetTokenExpiresAt: null, save: async function(){ return this; } }];
  const sentForgotPasswordOtps = [];
  const matchQuery = (record, query) => Object.entries(query).every(([k, v]) => record[k] === v);
  const service = createAuthPasswordService({
    normalizeFirmSlug: (v) => (v ? String(v).trim().toLowerCase() : null),
    Firm: { findOne: (q) => ({ select: () => ({ lean: async () => firms.find((f) => matchQuery(f, q)) || null }) }), findById: (id) => ({ select: () => ({ lean: async () => firms.find((f) => f._id === id) || null }) }) },
    User: { findOne: async (q) => users.find((u) => matchQuery(u, q)) || null, find: (q) => ({ limit: async (n) => users.filter((u) => matchQuery(u, q)).slice(0, n) }) },
    emailService: {
      sendForgotPasswordOtpEmail: async (payload) => { if (failForgotOtpSend) throw new Error('provider-down'); sentForgotPasswordOtps.push(payload); },
      sendLoginOtpEmail: async () => {}, generateSecureToken: () => 'legacy-token', hashToken: (v) => `legacy-hash:${v}`, sendForgotPasswordEmail: async () => ({ success: true }), maskEmail: (email) => email,
    },
    isActiveStatus: (s) => s === 'active', FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES: 30, logAuthAudit: async () => {},
    FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS: 0, FORGOT_PASSWORD_OTP_EXPIRY_MINUTES: 10, FORGOT_PASSWORD_OTP_LOCK_MINUTES: 10,
    authOtpService: { generateOtp: () => '123456', hashOtp: async (otp) => `hash:${otp}`, verifyOtp: async (otp, hash) => { if (throwOnVerify) throw new Error('verify-failed'); return hash === `hash:${otp}`; }, incrementAttempts: (a, m) => ({ attempts: a + 1, exhausted: a + 1 >= m }) },
    SALT_ROUNDS: 10, DEFAULT_XID: 'X000001', DEFAULT_FIRM_ID: 'PLATFORM',
    clearForgotPasswordOtpState: (u) => { u.forgotPasswordOtpHash = null; u.forgotPasswordOtpExpiresAt = null; u.forgotPasswordOtpAttempts = 0; u.forgotPasswordOtpLastSentAt = null; u.forgotPasswordOtpLockedUntil = null; u.forgotPasswordOtpResendCount = 0; },
    generateLoginSessionToken: () => 'reset-1', hashLoginSessionToken: (v) => `token-hash:${v}`, validatePasswordStrength: () => true, PASSWORD_POLICY_MESSAGE: 'weak password', bcrypt: { hash: async (v) => `bcrypt:${v}` },
  });
  return { service, users, sentForgotPasswordOtps };
};
const reqFor = (body) => ({ body, ip: '127.0.0.1', get: () => 'test-agent', headers: { 'x-request-id': 'req-1' } });

(async () => {
  const { service, users, sentForgotPasswordOtps } = createHarness();
  const initRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a' }), initRes);
  assert.strictEqual(initRes.statusCode, 200);
  assert.strictEqual(initRes.body.message, GENERIC_INIT_MESSAGE);
  assert.strictEqual(sentForgotPasswordOtps.length, 1);

  const unknownRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'unknown@example.com', firmSlug: 'firm-a' }), unknownRes);
  assert.strictEqual(unknownRes.statusCode, 200);
  assert.strictEqual(sentForgotPasswordOtps.length, 1);

  const goodVerify = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', otp: '123456' }), goodVerify);
  assert.strictEqual(goodVerify.statusCode, 200);

  users[0].forgotPasswordOtpHash = 'hash:999999';
  users[0].forgotPasswordOtpExpiresAt = new Date(Date.now() + 60000);
  const badVerify = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', otp: '123456' }), badVerify);
  assert.strictEqual(badVerify.statusCode, 401);

  const missingOtpState = createMockRes();
  users[0].forgotPasswordOtpHash = null;
  users[0].forgotPasswordOtpExpiresAt = null;
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', otp: '123456' }), missingOtpState);
  assert.strictEqual(missingOtpState.statusCode, 401);

  const { service: serviceWithProviderFailure } = createHarness({ failForgotOtpSend: true });
  const providerFailRes = createMockRes();
  await serviceWithProviderFailure.forgotPasswordInit(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a' }), providerFailRes);
  assert.strictEqual(providerFailRes.statusCode, 200);

  const { service: serviceWithVerifyThrow } = createHarness({ throwOnVerify: true });
  const verifyThrowRes = createMockRes();
  await serviceWithVerifyThrow.forgotPasswordInit(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a' }), createMockRes());
  await serviceWithVerifyThrow.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'firm-a', otp: '123456' }), verifyThrowRes);
  assert.strictEqual(verifyThrowRes.statusCode, 401);

  console.log('All auth forgot-password OTP reliability tests passed.');
})().catch((error) => {
  console.error('auth forgot-password OTP reliability tests failed:', error);
  process.exit(1);
});
