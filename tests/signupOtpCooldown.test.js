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

async function testResendOtpReturnsWaitTimeAnd429() {
  const resendRecord = {
    email: 'alice@example.com',
    provider: 'manual',
    name: 'Alice',
    otpLastSentAt: new Date(Date.now() - 18 * 1000),
    otpResendCount: 1,
    save: async () => {},
  };

  Module._load = function (request, parent, isMain) {
    if (request === 'bcrypt') return { hash: async () => 'h', compare: async () => true };
    if (request === '../models/TemporarySignup') return { findOne: async () => resendRecord };
    if (request === '../models/User.model') return { findOne: () => ({ lean: async () => null }) };
    if (request === '../models/AuthAudit.model') return { create: async () => ({}) };
    if (request === '../models/Firm.model') return { find: () => ({ session: () => ({ select: async () => [] }) }) };
    if (request === '../models/Client.model') return {};
    if (request === './clientIdGenerator') return { generateNextClientId: async () => 'C000001' };
    if (request === './xIDGenerator') return { generateNextXID: async () => 'X000001' };
    if (request === '../security/encryption.service') return { ensureTenantKey: async () => {} };
    if (request === './email.service') return { sendEmail: async () => ({ success: true }), sendFirmSetupEmail: async () => ({ success: true }) };
    if (request === './signupRateLimit.service') {
      return {
        consumeSignupQuota: async () => ({ allowed: true }),
        consumeOtpAttempt: async () => ({ allowed: true }),
        clearOtpAttempts: async () => {},
      };
    }
    if (request === './redisLock.service') {
      return {
        acquireLock: async () => ({ acquired: true }),
        releaseLock: async () => {},
      };
    }
    if (request === './audit.service') return { logAuthEvent: async () => ({}) };
    if (request === './jwt.service') return { generateAccessToken: () => 'token' };
    if (request === '../utils/log') return { info: () => {}, warn: () => {}, error: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signup.service');
  const signupService = require('../src/services/signup.service');
  const result = await signupService.resendSignupOtp({ email: 'alice@example.com' });

  assert.strictEqual(result.status, 429);
  assert.match(result.message, /^Please wait \d+ seconds before requesting another OTP\.$/);
  console.log('  ✓ resend OTP cooldown returns 429 with remaining-seconds message');
}

async function run() {
  console.log('Running signup OTP cooldown tests...');
  try {
    await testResendOtpReturnsWaitTimeAnd429();
    console.log('All signup OTP cooldown tests passed.');
  } catch (error) {
    console.error('signupOtpCooldown tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
