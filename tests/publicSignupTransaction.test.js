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

async function testRouteWrapsWriteSignupHandlers() {
  const authLimiter = (req, res, next) => next();
  const signupLimiter = (req, res, next) => next();
  const initiateSignup = async () => ({ success: true });
  const wrappedHandlers = [];

  Module._load = function (request, parent, isMain) {
    if (request === '../middleware/rateLimiters') return { authLimiter, signupLimiter };
    if (request === '../controllers/publicSignup.controller') {
      return {
        initiateSignup,
        verifyOtp: async () => ({}),
        resendOtp: async () => ({}),
        completeSignup: async () => ({}),
      };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => {
        const wrapped = async (req, res, next) => fn(req, res, next);
        wrapped.original = fn;
        wrappedHandlers.push(wrapped);
        return wrapped;
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/routes/publicSignup.routes');
  const router = require('../src/routes/publicSignup.routes');
  const initiateLayer = router.stack.find((layer) => layer.route?.path === '/initiate-signup');
  const googleLayer = router.stack.find((layer) => layer.route?.path === '/google-auth');
  const completeLayer = router.stack.find((layer) => layer.route?.path === '/complete-signup');
  assert.ok(initiateLayer, 'initiate-signup route should exist');
  assert.strictEqual(googleLayer, undefined, 'google-auth route should not exist');
  assert.ok(completeLayer, 'complete-signup route should exist');

  const initiateHandlers = initiateLayer.route.stack.map((item) => item.handle);
  assert.strictEqual(initiateHandlers[0], authLimiter, 'authLimiter should remain first middleware');
  assert.strictEqual(initiateHandlers[1], signupLimiter, 'signupLimiter should be second middleware for initiate-signup');
  assert.strictEqual(initiateHandlers[2].original, initiateSignup, 'initiate-signup should be wrapped with wrapWriteHandler');

  const completeHandlers = completeLayer.route.stack.map((item) => item.handle);
  assert.strictEqual(completeHandlers[0], authLimiter, 'authLimiter should remain first middleware');
  assert.strictEqual(typeof completeHandlers[1].original, 'function', 'complete-signup should be wrapped with wrapWriteHandler');

  assert.strictEqual(wrappedHandlers.length, 2, 'two write handlers should be wrapped');
  console.log('  ✓ wraps public signup write routes with wrapWriteHandler');
}

async function testControllerForwardsTransactionSession() {
  const captured = {};
  const mockSignupService = {
    initiateManualSignup: async (payload) => {
      captured.payload = payload;
      return { success: true, message: 'OTP sent to your email' };
    },
  };

  Module._load = function (request, parent, isMain) {
    if (request === '../services/signup.service') return mockSignupService;
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/publicSignup.controller');
  const { initiateSignup } = require('../src/controllers/publicSignup.controller');
  const session = { id: 'session-1' };
  const result = await initiateSignup({
    body: { name: 'Alice', email: 'alice@example.com', password: 'password123', phone: '9999999999', firmName: 'Acme Legal' },
    transactionSession: { session },
    ip: '127.0.0.1',
  }, {});

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.statusCode, 201);
  assert.strictEqual(result.requiresOtpVerification, true);
  assert.strictEqual(captured.payload.session, session, 'controller should pass active transaction session to service');
  assert.strictEqual(captured.payload.firmName, 'Acme Legal', 'controller should pass firmName for temporary signup');
  console.log('  ✓ forwards req.transactionSession.session to initiateManualSignup');
}

async function testServiceWritesUseSession() {
  const captured = { deleteMany: null, create: null };
  const mockUser = {
    findOne: () => ({
      lean: async () => null,
    }),
  };
  const mockTemporarySignup = {
    deleteMany: async (...args) => { captured.deleteMany = args; },
    create: async (...args) => { captured.create = args; },
  };

  Module._load = function (request, parent, isMain) {
    if (request === '../models/User.model') return mockUser;
    if (request === '../models/TemporarySignup') return mockTemporarySignup;
    if (request === '../models/AuthAudit.model') return { create: async () => ({}) };
    if (request === './email.service') return { sendEmail: async () => ({ success: true }) };
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signup.service');
  const signupService = require('../src/services/signup.service');
  const session = { id: 'session-2' };
  await signupService.initiateManualSignup({
    name: 'Alice',
    email: 'alice@example.com',
    password: 'password123',
    firmName: 'Acme Legal',
    phone: '9999999999',
    session,
  });

  assert.deepStrictEqual(captured.deleteMany[1], { session }, 'deleteMany should receive the session option');
  assert.deepStrictEqual(captured.create[1], { session }, 'create should receive the session option');
  console.log('  ✓ passes { session } to TemporarySignup write operations');
}

async function testCreateFirmAndAdminTracksVerificationAndConsent() {
  const captured = { users: [] };
  const session = { id: 'session-3' };
  let firmCounter = 0;

  const mockFirmModel = {
    findOne: () => ({ sort: async () => null }),
    find: () => ({
      session: () => ({
        select: async () => [],
      }),
    }),
    create: async ([firmDoc]) => {
      firmCounter += 1;
      return [{
        ...firmDoc,
        _id: `firm-${firmCounter}`,
        save: async () => {},
      }];
    },
  };

  Module._load = function (request, parent, isMain) {
    if (request === '../models/Firm.model') return mockFirmModel;
    if (request === '../models/Client.model') {
      return {
        create: async () => ([{ _id: 'client-1' }]),
      };
    }
    if (request === '../models/User.model') {
      return {
        findOne: () => ({ lean: async () => null }),
        create: async ([userDoc]) => {
          captured.users.push(userDoc);
          return [{ ...userDoc, _id: `user-${captured.users.length}` }];
        },
        updateOne: async () => ({ matchedCount: 0 }),
      };
    }
    if (request === '../models/TemporarySignup') {
      return {};
    }
    if (request === './clientIdGenerator') {
      return { generateNextClientId: async () => 'C000001' };
    }
    if (request === './xIDGenerator') {
      return { generateNextXID: async () => 'X000001' };
    }
    if (request === '../security/encryption.service') {
      return { ensureTenantKey: async () => ({}) };
    }
    if (request === './email.service') {
      return { sendEmail: async () => ({ success: true }) };
    }
    if (request === './audit.service') {
      return { logAuthEvent: async () => ({}) };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signup.service');
  const signupService = require('../src/services/signup.service');

  await signupService.createFirmAndAdmin({
    name: 'Alice',
    email: 'alice@example.com',
    firmName: 'Acme Legal',
    passwordHash: 'hash',
    phone: '9999999999',
    authProvider: 'password',
    session,
    req: {
      ip: '203.0.113.5',
      headers: { 'user-agent': 'Mozilla/5.0 Test Browser' },
    },
  });

  await signupService.createFirmAndAdmin({
    name: 'Bob',
    email: 'bob@example.com',
    firmName: 'Acme Legal',
    passwordHash: null,
    phone: null,
    authProvider: 'google',
    googleSubject: 'google-subject',
    session,
    req: {
      ip: '198.51.100.7',
      headers: { 'user-agent': 'Chrome Test' },
    },
  });

  assert.strictEqual(captured.users.length, 2, 'expected two created admin users');
  assert.strictEqual(captured.users[0].emailVerified, true, 'OTP signup should mark email verified');
  assert.strictEqual(captured.users[0].verificationMethod, 'OTP', 'password flow should mark OTP method');
  assert.strictEqual(captured.users[0].termsAccepted, true, 'password flow should persist legal consent');
  assert.strictEqual(captured.users[0].termsVersion, 'v1.0', 'password flow should persist terms version');
  assert.strictEqual(captured.users[0].signupIP, '203.0.113.5', 'password flow should persist signup IP');
  assert.strictEqual(captured.users[0].signupUserAgent, 'Mozilla/5.0 Test Browser', 'password flow should persist user agent');
  assert.strictEqual(captured.users[1].verificationMethod, 'GOOGLE', 'google flow should mark GOOGLE verification method');
  assert.strictEqual(captured.users[1].authProviders.google.googleId, 'google-subject', 'google flow should persist google subject');
  console.log('  ✓ tracks verification and legal consent metadata when creating signup admins');
}

async function run() {
  console.log('Running public signup transaction tests...');
  try {
    await testRouteWrapsWriteSignupHandlers();
    await testControllerForwardsTransactionSession();
    await testServiceWritesUseSession();
    await testCreateFirmAndAdminTracksVerificationAndConsent();
    console.log('All public signup transaction tests passed.');
  } catch (error) {
    console.error('publicSignupTransaction tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
