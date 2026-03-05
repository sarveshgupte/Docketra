#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

const mockResponse = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

async function testOtpBruteforceProtection() {
  const record = {
    email: 'alice@example.com',
    provider: 'manual',
    otpHash: 'hash',
    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    otpAttempts: 0,
    otpBlockedUntil: null,
    save: async () => {},
  };

  Module._load = function (request, parent, isMain) {
    if (request === 'bcrypt') return { hash: async () => 'h', compare: async () => false };
    if (request === '../models/TemporarySignup') return { findOne: async () => record };
    if (request === '../models/User.model') return { findOne: () => ({ lean: async () => null }) };
    if (request === '../models/AuthAudit.model') return { create: async () => ({}) };
    if (request === '../models/Firm.model') return { find: () => ({ session: () => ({ select: async () => [] }) }) };
    if (request === '../models/Client.model') return {};
    if (request === './clientIdGenerator') return { generateNextClientId: async () => 'C000001' };
    if (request === './xIDGenerator') return { generateNextXID: async () => 'X000001' };
    if (request === '../security/encryption.service') return { ensureTenantKey: async () => {} };
    if (request === './email.service') return { sendEmail: async () => ({ success: true }), sendFirmSetupEmail: async () => ({ success: true }) };
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signup.service');
  const signupService = require('../src/services/signup.service');

  for (let i = 0; i < 5; i += 1) {
    const result = await signupService.verifySignupOtp({ email: 'alice@example.com', otp: '000000' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 400);
  }

  const blocked = await signupService.verifySignupOtp({ email: 'alice@example.com', otp: '000000' });
  assert.strictEqual(blocked.status, 429, 'OTP verification should be blocked after 5 failed attempts');
  console.log('  ✓ OTP brute-force protection blocks after 5 failed attempts');
}

async function testOtpResendCooldownAndExpiry() {
  const resendRecord = {
    email: 'alice@example.com',
    provider: 'manual',
    otpLastSentAt: new Date(),
    otpResendCount: 1,
  };
  const expiredRecord = {
    email: 'alice@example.com',
    provider: 'manual',
    otpHash: 'hash',
    otpExpiresAt: new Date(Date.now() - 60 * 1000),
    otpAttempts: 0,
    otpBlockedUntil: null,
    save: async () => {},
  };

  Module._load = function (request, parent, isMain) {
    if (request === 'bcrypt') return { hash: async () => 'h', compare: async () => true };
    if (request === '../models/TemporarySignup') {
      return {
        findOne: async (query) => {
          if (query && query.email === 'alice@example.com' && query.provider === 'manual') return resendRecord;
          return expiredRecord;
        },
      };
    }
    if (request === '../models/User.model') return { findOne: () => ({ lean: async () => null }) };
    if (request === '../models/AuthAudit.model') return { create: async () => ({}) };
    if (request === '../models/Firm.model') return { find: () => ({ session: () => ({ select: async () => [] }) }) };
    if (request === '../models/Client.model') return {};
    if (request === './clientIdGenerator') return { generateNextClientId: async () => 'C000001' };
    if (request === './xIDGenerator') return { generateNextXID: async () => 'X000001' };
    if (request === '../security/encryption.service') return { ensureTenantKey: async () => {} };
    if (request === './email.service') return { sendEmail: async () => ({ success: true }), sendFirmSetupEmail: async () => ({ success: true }) };
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signup.service');
  const signupService = require('../src/services/signup.service');
  const cooldown = await signupService.resendSignupOtp({ email: 'alice@example.com' });
  assert.strictEqual(cooldown.status, 429);
  assert.strictEqual(cooldown.message, 'Please wait before requesting another OTP.');

  const expiry = await signupService.verifySignupOtp({ email: 'expired@example.com', otp: '000000' });
  assert.strictEqual(expiry.status, 400);
  assert.strictEqual(expiry.message, 'OTP has expired. Please request a new OTP.');
  console.log('  ✓ OTP resend cooldown and expiry enforcement are active');
}

async function testDuplicateCleanupAndSlugRetry() {
  const calls = { deleteMany: [], createMany: [], createFirmSlugs: [] };
  const fakeFirm = {
    _id: '507f1f77bcf86cd799439011',
    defaultClientId: null,
    bootstrapStatus: 'PENDING',
    save: async () => {},
  };

  Module._load = function (request, parent, isMain) {
    if (request === 'bcrypt') return { hash: async () => 'h', compare: async () => true };
    if (request === '../models/User.model') {
      return {
        findOne: () => ({ lean: async () => null }),
        create: async () => ([{ _id: '507f191e810c19729de860ea' }]),
      };
    }
    if (request === '../models/TemporarySignup') {
      return {
        deleteMany: async (...args) => { calls.deleteMany.push(args); },
        create: async (...args) => { calls.createMany.push(args); },
      };
    }
    if (request === '../models/AuthAudit.model') return { create: async () => ({}) };
    if (request === '../models/Firm.model') {
      return {
        find: () => ({ session: () => ({ select: async () => [] }) }),
        findOne: () => ({ sort: async () => null }),
        create: async (docs) => {
          const slug = docs[0].firmSlug;
          calls.createFirmSlugs.push(slug);
          if (calls.createFirmSlugs.length === 1) {
            const err = new Error('duplicate key');
            err.code = 11000;
            err.keyPattern = { firmSlug: 1 };
            throw err;
          }
          return [fakeFirm];
        },
      };
    }
    if (request === '../models/Client.model') return { create: async () => ([{ _id: '507f191e810c19729de860eb' }]) };
    if (request === './clientIdGenerator') return { generateNextClientId: async () => 'C000001' };
    if (request === './xIDGenerator') return { generateNextXID: async () => 'X000001' };
    if (request === '../security/encryption.service') return { ensureTenantKey: async () => {} };
    if (request === './email.service') return { sendEmail: async () => ({ success: true }), sendFirmSetupEmail: async () => ({ success: true }) };
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signup.service');
  const signupService = require('../src/services/signup.service');
  await signupService.initiateManualSignup({
    name: 'Alice',
    email: 'alice@example.com',
    password: 'Password123!',
    firmName: 'Acme Legal',
    phone: '9999999999',
    session: { id: 'session-1' },
  });

  const hasEmailDelete = calls.deleteMany.some((args) => args[0] && args[0].email === 'alice@example.com');
  assert.strictEqual(hasEmailDelete, true, 'initiate signup must clear duplicate temporary records by email');

  await signupService.createFirmAndAdmin({
    name: 'Alice',
    email: 'alice@example.com',
    firmName: 'Acme Legal',
    passwordHash: 'hashed',
    authProvider: 'password',
    session: { id: 'session-2' },
  });

  assert.deepStrictEqual(calls.createFirmSlugs, ['acme-legal', 'acme-legal-2']);
  console.log('  ✓ duplicate signup cleanup and slug retry collision handling verified');
}

async function testTenantIsolationGuardrails() {
  Module._load = function (request, parent, isMain) {
    if (request === '../models/User.model') {
      return { findOne: async () => null };
    }
    if (request === '../models/Category.model') {
      return {
        find: async (filter) => [{ _id: 'cat-1', firmId: filter.firmId }],
      };
    }
    if (request === '../models/Case.model') return {};
    if (request === 'mongoose') return originalLoad.apply(this, arguments);
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/user.controller');
  clearModule('../src/controllers/category.controller');
  const userController = require('../src/controllers/user.controller');
  const categoryController = require('../src/controllers/category.controller');

  const deniedRes = mockResponse();
  await userController.getUserById({ params: { id: 'u1' }, user: { role: 'Admin' } }, deniedRes);
  assert.strictEqual(deniedRes.statusCode, 403, 'missing firmId should be rejected for non-super-admin');

  let capturedFilter = null;
  Module._load = function (request, parent, isMain) {
    if (request === '../models/Category.model') {
      return {
        find: async (filter) => {
          capturedFilter = filter;
          return [];
        },
      };
    }
    if (request === '../models/Case.model') return {};
    if (request === 'mongoose') return originalLoad.apply(this, arguments);
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    return originalLoad.apply(this, arguments);
  };
  clearModule('../src/controllers/category.controller');
  const categoryControllerScoped = require('../src/controllers/category.controller');

  const okRes = mockResponse();
  await categoryControllerScoped.getCategories({ query: {}, user: { role: 'Admin', firmId: 'firm-123' } }, okRes);
  assert.strictEqual(capturedFilter.firmId, 'firm-123', 'category queries must include firmId for tenant users');
  console.log('  ✓ tenant query guardrails enforce firm scoping and missing-firm rejection');
}

async function run() {
  console.log('Running Phase 2 auth hardening tests...');
  try {
    await testOtpBruteforceProtection();
    await testOtpResendCooldownAndExpiry();
    await testDuplicateCleanupAndSlugRetry();
    await testTenantIsolationGuardrails();
    console.log('All Phase 2 auth hardening tests passed.');
  } catch (error) {
    console.error('Phase 2 auth hardening tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
