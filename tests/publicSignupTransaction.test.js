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

async function run() {
  console.log('Running public signup transaction tests...');
  try {
    await testRouteWrapsWriteSignupHandlers();
    await testControllerForwardsTransactionSession();
    await testServiceWritesUseSession();
    console.log('All public signup transaction tests passed.');
  } catch (error) {
    console.error('publicSignupTransaction tests failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
}

run();
