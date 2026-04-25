#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createAuthPasswordService = require('../src/services/authPassword.service');

const createMockRes = () => {
  const payloads = [];
  return {
    statusCode: 200,
    payloads,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      payloads.push(payload);
      return payload;
    },
  };
};

async function shouldAllowGenericForgotPasswordInitWithUniqueFirmUser() {
  const sentEmails = [];
  const users = [{
    _id: 'u1',
    email: 'user@example.com',
    name: 'User',
    xID: 'X100001',
    firmId: 'f1',
    status: 'active',
    isActive: true,
    save: async function save() { return this; },
  }];

  const service = createAuthPasswordService({
    normalizeFirmSlug: (v) => (v ? String(v).toLowerCase() : null),
    Firm: {
      findById: (id) => ({
        select: () => ({ lean: async () => ({ _id: id, name: 'Acme', firmSlug: 'acme' }) }),
      }),
      findOne: () => ({ select: () => ({ lean: async () => null }) }),
    },
    User: {
      find: () => ({ limit: async () => users }),
      findOne: async ({ email }) => users.find((u) => u.email === email) || null,
    },
    emailService: {
      sendLoginOtpEmail: async (payload) => { sentEmails.push(payload); },
    },
    isActiveStatus: () => true,
    FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES: 30,
    logAuthAudit: async () => {},
    FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS: 30,
    FORGOT_PASSWORD_OTP_EXPIRY_MINUTES: 10,
    FORGOT_PASSWORD_OTP_LOCK_MINUTES: 10,
    authOtpService: { generateOtp: () => '123456', hashOtp: async () => 'hash', verifyOtp: async () => true, incrementAttempts: (a) => ({ attempts: a + 1, exhausted: false }) },
    SALT_ROUNDS: 10,
    DEFAULT_XID: 'SUPERADMIN',
    DEFAULT_FIRM_ID: 'PLATFORM',
    clearForgotPasswordOtpState: () => {},
    generateLoginSessionToken: () => 'reset-session',
    hashLoginSessionToken: (v) => `hash:${v}`,
    validatePasswordStrength: () => true,
    PASSWORD_POLICY_MESSAGE: 'weak',
    bcrypt: { hash: async () => 'password-hash' },
  });

  const req = { body: { email: 'user@example.com' }, get: () => 'jest', ip: '127.0.0.1' };
  const res = createMockRes();

  await service.forgotPasswordInit(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payloads[0].success, true);
  assert.strictEqual(res.payloads[0].firmSlug, 'acme');
  assert.strictEqual(sentEmails.length, 1);
  console.log('  ✓ forgot-password init resolves unique firm context when firmSlug is omitted');
}

async function shouldAllowForgotPasswordInitWithXidIdentifier() {
  const sentEmails = [];
  const users = [{
    _id: 'u1',
    email: 'user@example.com',
    name: 'User',
    xID: 'X100001',
    firmId: 'f1',
    status: 'active',
    isActive: true,
    save: async function save() { return this; },
  }];

  const service = createAuthPasswordService({
    normalizeFirmSlug: (v) => (v ? String(v).toLowerCase() : null),
    Firm: {
      findById: (id) => ({
        select: () => ({ lean: async () => ({ _id: id, name: 'Acme', firmSlug: 'acme' }) }),
      }),
      findOne: () => ({ select: () => ({ lean: async () => null }) }),
    },
    User: {
      find: () => ({ limit: async () => users }),
      findOne: async ({ xID }) => users.find((u) => u.xID === xID) || null,
    },
    emailService: {
      sendLoginOtpEmail: async (payload) => { sentEmails.push(payload); },
    },
    isActiveStatus: () => true,
    FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES: 30,
    logAuthAudit: async () => {},
    FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS: 30,
    FORGOT_PASSWORD_OTP_EXPIRY_MINUTES: 10,
    FORGOT_PASSWORD_OTP_LOCK_MINUTES: 10,
    authOtpService: { generateOtp: () => '123456', hashOtp: async () => 'hash', verifyOtp: async () => true, incrementAttempts: (a) => ({ attempts: a + 1, exhausted: false }) },
    SALT_ROUNDS: 10,
    DEFAULT_XID: 'SUPERADMIN',
    DEFAULT_FIRM_ID: 'PLATFORM',
    clearForgotPasswordOtpState: () => {},
    generateLoginSessionToken: () => 'reset-session',
    hashLoginSessionToken: (v) => `hash:${v}`,
    validatePasswordStrength: () => true,
    PASSWORD_POLICY_MESSAGE: 'weak',
    bcrypt: { hash: async () => 'password-hash' },
  });

  const req = { body: { identifier: 'x100001' }, get: () => 'jest', ip: '127.0.0.1' };
  const res = createMockRes();

  await service.forgotPasswordInit(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payloads[0].success, true);
  assert.strictEqual(res.payloads[0].firmSlug, 'acme');
  assert.strictEqual(sentEmails.length, 1);
  console.log('  ✓ forgot-password init accepts xID identifier');
}

async function shouldRequireOptionalMiddlewareOnForgotPasswordOtpRoutes() {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8');
  assert(source.includes("attachOptionalFirmFromSlug, forgotPasswordInit"));
  assert(source.includes("attachOptionalFirmFromSlug, forgotPasswordVerify"));
  assert(source.includes("attachOptionalFirmFromSlug, forgotPasswordResetWithOtp"));
  console.log('  ✓ auth routes wire optional firm resolver for forgot-password OTP flow');
}

async function run() {
  console.log('Running forgot-password firm context tests...');
  await shouldAllowGenericForgotPasswordInitWithUniqueFirmUser();
  await shouldAllowForgotPasswordInitWithXidIdentifier();
  await shouldRequireOptionalMiddlewareOnForgotPasswordOtpRoutes();
  console.log('All forgot-password firm context tests passed.');
}

run().catch((error) => {
  console.error('authForgotPasswordFirmContext tests failed:', error);
  process.exit(1);
});
