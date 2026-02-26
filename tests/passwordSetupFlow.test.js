#!/usr/bin/env node
const assert = require('assert');
const jwt = require('jsonwebtoken');

const { setPassword } = require('../src/controllers/auth.controller');
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const AuthAudit = require('../src/models/AuthAudit.model');

const createRes = () => ({
  statusCode: 200,
  body: null,
  headersSent: false,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    this.headersSent = true;
    return this;
  },
});

async function shouldSetPasswordUsingTokenFirmContext() {
  const originalUserFindOne = User.findOne;
  const originalFirmFindOne = Firm.findOne;
  const originalSecret = process.env.JWT_PASSWORD_SETUP_SECRET;
  const originalAuthAuditCreate = AuthAudit.create;

  process.env.JWT_PASSWORD_SETUP_SECRET = 'test-password-setup-secret';
  const token = jwt.sign(
    { userId: '507f1f77bcf86cd799439011', firmId: '507f1f77bcf86cd799439012', type: 'PASSWORD_SETUP' },
    process.env.JWT_PASSWORD_SETUP_SECRET,
    { expiresIn: '24h' }
  );

  let userLookup = null;
  let saveCalled = false;
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    xID: 'X000001',
    firmId: '507f1f77bcf86cd799439012',
    status: 'INVITED',
    passwordHash: null,
    mustSetPassword: true,
    save: async () => { saveCalled = true; },
  };

  User.findOne = async (query) => {
    userLookup = query;
    return mockUser;
  };
  Firm.findOne = async () => ({ firmSlug: 'acme' });
  AuthAudit.create = async () => {};

  const req = { body: { token, password: 'MyStrongPassword123!' }, ip: '127.0.0.1', get: () => 'test-agent', skipTransaction: true };
  const res = createRes();
  let nextError = null;
  await setPassword(req, res, (err) => { nextError = err; });

  assert.strictEqual(nextError, null);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.message, 'Password set successfully');
  assert.deepStrictEqual(userLookup, {
    _id: '507f1f77bcf86cd799439011',
    firmId: '507f1f77bcf86cd799439012',
  });
  assert.strictEqual(saveCalled, true);
  assert.strictEqual(mockUser.status, 'ACTIVE');
  assert.strictEqual(mockUser.isActive, true);
  assert.strictEqual(typeof mockUser.passwordHash, 'string');
  assert.notStrictEqual(mockUser.passwordHash, 'MyStrongPassword123!');
  console.log('✓ setup-password resolves user by token userId + firmId and activates account');

  User.findOne = originalUserFindOne;
  Firm.findOne = originalFirmFindOne;
  AuthAudit.create = originalAuthAuditCreate;
  process.env.JWT_PASSWORD_SETUP_SECRET = originalSecret;
}

async function shouldRejectInvalidTokenType() {
  const originalUserFindOne = User.findOne;
  const originalSecret = process.env.JWT_PASSWORD_SETUP_SECRET;

  process.env.JWT_PASSWORD_SETUP_SECRET = 'test-password-setup-secret';
  const token = jwt.sign(
    { userId: '507f1f77bcf86cd799439011', firmId: '507f1f77bcf86cd799439012', type: 'PASSWORD_RESET' },
    process.env.JWT_PASSWORD_SETUP_SECRET,
    { expiresIn: '24h' }
  );

  User.findOne = async () => {
    throw new Error('should not query user for invalid token type');
  };

  const req = { body: { token, password: 'MyStrongPassword123!' }, skipTransaction: true };
  const res = createRes();
  let nextError = null;
  await setPassword(req, res, (err) => { nextError = err; });

  assert.strictEqual(nextError, null);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.message, 'Invalid token type');
  console.log('✓ setup-password rejects tokens that are not PASSWORD_SETUP');

  User.findOne = originalUserFindOne;
  process.env.JWT_PASSWORD_SETUP_SECRET = originalSecret;
}

async function run() {
  try {
    await shouldSetPasswordUsingTokenFirmContext();
    await shouldRejectInvalidTokenType();
    console.log('\n✅ Password setup flow tests passed.');
    process.exit(0);
  } catch (error) {
    console.error('✗ Password setup flow tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
