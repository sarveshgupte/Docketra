#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createAuthPasswordService = require('../src/services/authPassword.service');
const GENERIC_INIT_MESSAGE = 'If the account exists, an OTP has been sent to email.';
const createMockRes = () => ({ statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(payload){ this.body = payload; return payload; } });

const createHarness = ({ failForgotOtpSend = false, throwOnVerify = false } = {}) => {
  const firms = [
    { _id: 'root-firm', name: 'Root Firm', firmSlug: 'gupte-opc', status: 'active', defaultClientId: 'workspace-firm', legacyFirmId: 'root-firm' },
    { _id: 'workspace-firm', name: 'Workspace Firm', firmSlug: 'workspace-firm', status: 'active', defaultClientId: 'workspace-firm', legacyFirmId: 'root-firm' },
    { _id: 'other-firm', name: 'Other Firm', firmSlug: 'other-firm', status: 'active', defaultClientId: 'other-workspace', legacyFirmId: 'other-firm' },
  ];
  const users = [
    { _id: 'user-a', email: 'alpha@example.com', name: 'Alpha', xID: 'X000001', firmId: 'root-firm', defaultClientId: 'workspace-firm', status: 'active', isActive: true, forgotPasswordOtpHash: null, forgotPasswordOtpExpiresAt: null, forgotPasswordOtpAttempts: 0, forgotPasswordOtpLastSentAt: null, forgotPasswordOtpLockedUntil: null, forgotPasswordOtpResendCount: 0, forgotPasswordResetTokenHash: null, forgotPasswordResetTokenExpiresAt: null, save: async function(){ return this; } },
  ];
  const sentForgotPasswordOtps = [];
  let tokenCounter = 0;
  const matchQuery = (record, query) => Object.entries(query).every(([k, v]) => {
    if (k === '$or') return v.some((sub) => matchQuery(record, sub));
    if (v && typeof v === 'object' && '$in' in v) return v.$in.map(String).includes(String(record[k]));
    return String(record[k]) === String(v);
  });
  const Firm = {
    findOne: (query) => ({ select: () => ({ lean: async () => firms.find((f) => matchQuery(f, query)) || null }) }),
    findById: (id) => ({ select: () => ({ lean: async () => firms.find((f) => String(f._id) === String(id)) || null }) }),
  };
  const User = {
    findOne: async (query) => users.find((u) => matchQuery(u, query)) || null,
    find: (query) => ({ limit: async (n) => users.filter((u) => matchQuery(u, query)).slice(0, n) }),
  };
  const service = createAuthPasswordService({
    normalizeFirmSlug: (v) => (v ? String(v).trim().toLowerCase() : null),
    Firm, User,
    emailService: {
      sendForgotPasswordOtpEmail: async (payload) => { if (failForgotOtpSend) throw new Error('provider-down'); sentForgotPasswordOtps.push(payload); },
      sendLoginOtpEmail: async () => {}, generateSecureToken: () => 'legacy-token', hashToken: (v) => `legacy-hash:${v}`, sendForgotPasswordEmail: async () => ({ success: true }), maskEmail: (email) => email,
    },
    isActiveStatus: (s) => s === 'active', FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES: 30, logAuthAudit: async () => {},
    FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS: 0, FORGOT_PASSWORD_OTP_EXPIRY_MINUTES: 10, FORGOT_PASSWORD_OTP_LOCK_MINUTES: 10,
    authOtpService: { generateOtp: () => '123456', hashOtp: async (otp) => `hash:${otp}`, verifyOtp: async (otp, hash) => { if (throwOnVerify) throw new Error('verify-failed'); return hash === `hash:${otp}`; }, incrementAttempts: (a, m) => ({ attempts: a + 1, exhausted: a + 1 >= m }) },
    SALT_ROUNDS: 10, DEFAULT_XID: 'X000001', DEFAULT_FIRM_ID: 'PLATFORM',
    clearForgotPasswordOtpState: (u) => { u.forgotPasswordOtpHash = null; u.forgotPasswordOtpExpiresAt = null; u.forgotPasswordOtpAttempts = 0; u.forgotPasswordOtpLastSentAt = null; u.forgotPasswordOtpLockedUntil = null; u.forgotPasswordOtpResendCount = 0; },
    generateLoginSessionToken: () => `reset-${++tokenCounter}`, hashLoginSessionToken: (v) => `token-hash:${v}`, validatePasswordStrength: () => true, PASSWORD_POLICY_MESSAGE: 'weak password', bcrypt: { hash: async (v) => `bcrypt:${v}` },
  });
  return { service, users, sentForgotPasswordOtps };
};
const reqFor = (body) => ({ body, ip: '127.0.0.1', get: () => 'test-agent', headers: { 'x-request-id': 'req-1' } });

(async () => {
  const { service, users, sentForgotPasswordOtps } = createHarness();
  const initRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc' }), initRes);
  assert.strictEqual(initRes.statusCode, 200);
  assert.strictEqual(initRes.body.message, GENERIC_INIT_MESSAGE);
  assert.strictEqual(sentForgotPasswordOtps.length, 1);
  assert.ok(users[0].forgotPasswordOtpHash);
  assert.ok(users[0].forgotPasswordOtpExpiresAt);
  assert.ok(users[0].forgotPasswordOtpLastSentAt);

  const verifyGoodRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc', otp: '123456' }), verifyGoodRes);
  assert.strictEqual(verifyGoodRes.statusCode, 200);
  const resetToken = verifyGoodRes.body.resetToken;

  const unknownRes = createMockRes();
  await service.forgotPasswordInit(reqFor({ identifier: 'unknown@example.com', firmSlug: 'gupte-opc' }), unknownRes);
  assert.strictEqual(unknownRes.statusCode, 200);
  assert.strictEqual(sentForgotPasswordOtps.length, 1);

  const resetOkRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc', resetToken, password: 'Strong#1234' }), resetOkRes);
  assert.strictEqual(resetOkRes.statusCode, 200);
  assert.strictEqual(users[0].forgotPasswordOtpHash, null);
  const resetReuseRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc', resetToken, password: 'Strong#1234' }), resetReuseRes);
  assert.strictEqual(resetReuseRes.statusCode, 401);

  await service.forgotPasswordInit(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc' }), createMockRes());
  const otpReuseVerifyRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc', otp: '123456' }), otpReuseVerifyRes);
  const crossToken = otpReuseVerifyRes.body.resetToken;
  const crossResetRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'X000001', firmSlug: 'other-firm', resetToken: crossToken, password: 'Strong#1234' }), crossResetRes);
  assert.strictEqual(crossResetRes.statusCode, 401);

  await service.forgotPasswordInit(reqFor({ identifier: 'alpha@example.com', firmSlug: 'gupte-opc' }), createMockRes());
  users[0].forgotPasswordOtpExpiresAt = new Date(Date.now() - 1000);
  const expiredOtpRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'gupte-opc', otp: '123456' }), expiredOtpRes);
  assert.strictEqual(expiredOtpRes.statusCode, 401);

  await service.forgotPasswordInit(reqFor({ identifier: 'alpha@example.com', firmSlug: 'gupte-opc' }), createMockRes());
  const verifyForExpTokenRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'gupte-opc', otp: '123456' }), verifyForExpTokenRes);
  users[0].forgotPasswordResetTokenExpiresAt = new Date(Date.now() - 1000);
  const expiredResetRes = createMockRes();
  await service.forgotPasswordResetWithOtp(reqFor({ identifier: 'alpha@example.com', firmSlug: 'gupte-opc', resetToken: verifyForExpTokenRes.body.resetToken, password: 'Strong#1234' }), expiredResetRes);
  assert.strictEqual(expiredResetRes.statusCode, 401);

  await service.forgotPasswordInit(reqFor({ identifier: 'alpha@example.com', firmSlug: 'gupte-opc' }), createMockRes());
  users[0].forgotPasswordOtpAttempts = 5;
  const lockedRes = createMockRes();
  await service.forgotPasswordVerify(reqFor({ identifier: 'alpha@example.com', firmSlug: 'gupte-opc', otp: '123456' }), lockedRes);
  assert.strictEqual(lockedRes.statusCode, 429);

  const { service: providerFailService } = createHarness({ failForgotOtpSend: true });
  const providerFailRes = createMockRes();
  await providerFailService.forgotPasswordInit(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc' }), providerFailRes);
  assert.strictEqual(providerFailRes.statusCode, 200);

  const { service: verifyThrowService } = createHarness({ throwOnVerify: true });
  await verifyThrowService.forgotPasswordInit(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc' }), createMockRes());
  const verifyThrowRes = createMockRes();
  await verifyThrowService.forgotPasswordVerify(reqFor({ identifier: 'X000001', firmSlug: 'gupte-opc', otp: '123456' }), verifyThrowRes);
  assert.strictEqual(verifyThrowRes.statusCode, 401);

  console.log('All auth forgot-password OTP reliability tests passed.');
})().catch((error) => {
  console.error('auth forgot-password OTP reliability tests failed:', error);
  process.exit(1);
});
