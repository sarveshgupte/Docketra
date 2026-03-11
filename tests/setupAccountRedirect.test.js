#!/usr/bin/env node
const assert = require('assert');

const { setupAccount } = require('../src/controllers/auth.controller');
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const emailService = require('../src/services/email.service');

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

async function shouldReturnFirmSlugRedirectAfterSetup() {
  const originalHashToken = emailService.hashToken;
  const originalUserFindOne = User.findOne;
  const originalUserFindOneAndUpdate = User.findOneAndUpdate;
  const originalFirmUpdateOne = Firm.updateOne;
  const originalFirmFindById = Firm.findById;

  emailService.hashToken = () => 'hashed-token';

  const nowFuture = new Date(Date.now() + 60 * 60 * 1000);
  const existingUser = {
    _id: '507f1f77bcf86cd799439011',
    setupTokenHash: 'hashed-token',
    setupTokenExpiresAt: nowFuture,
    setupTokenUsedAt: null,
    firmId: '507f1f77bcf86cd799439012',
  };

  const updatedUser = {
    _id: existingUser._id,
    firmId: existingUser.firmId,
    firmSlug: null,
  };

  User.findOne = async () => existingUser;
  User.findOneAndUpdate = async () => updatedUser;
  Firm.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });
  Firm.findById = () => ({
    select: async () => ({ firmSlug: 'gupta-opc' }),
  });

  const req = { body: { token: 'plain-token', password: 'StrongPass123!' }, skipTransaction: true };
  const res = createRes();
  let nextError = null;
  await setupAccount(req, res, (err) => { nextError = err; });

  assert.strictEqual(nextError, null);

  const payload = res.body?.body || res.body;
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(payload.success, true);
  assert.strictEqual(payload.firmSlug, 'gupta-opc');
  assert.strictEqual(payload.redirectUrl, '/gupta-opc/login');
  console.log('✓ setup-account returns firm-scoped redirect for invited users');

  emailService.hashToken = originalHashToken;
  User.findOne = originalUserFindOne;
  User.findOneAndUpdate = originalUserFindOneAndUpdate;
  Firm.updateOne = originalFirmUpdateOne;
  Firm.findById = originalFirmFindById;
}

async function shouldFallbackToGenericLoginWhenFirmSlugMissing() {
  const originalHashToken = emailService.hashToken;
  const originalUserFindOne = User.findOne;
  const originalUserFindOneAndUpdate = User.findOneAndUpdate;
  const originalFirmUpdateOne = Firm.updateOne;
  const originalFirmFindById = Firm.findById;

  emailService.hashToken = () => 'hashed-token';

  const nowFuture = new Date(Date.now() + 60 * 60 * 1000);
  const existingUser = {
    _id: '507f1f77bcf86cd799439111',
    setupTokenHash: 'hashed-token',
    setupTokenExpiresAt: nowFuture,
    setupTokenUsedAt: null,
    firmId: '507f1f77bcf86cd799439222',
  };

  const updatedUser = {
    _id: existingUser._id,
    firmId: existingUser.firmId,
    firmSlug: null,
  };

  User.findOne = async () => existingUser;
  User.findOneAndUpdate = async () => updatedUser;
  Firm.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });
  Firm.findById = () => ({
    select: async () => null,
  });

  const req = { body: { token: 'plain-token', password: 'StrongPass123!' }, skipTransaction: true };
  const res = createRes();
  let nextError = null;
  await setupAccount(req, res, (err) => { nextError = err; });

  assert.strictEqual(nextError, null);

  const payload = res.body?.body || res.body;
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(payload.success, true);
  assert.strictEqual(payload.firmSlug, null);
  assert.strictEqual(payload.redirectUrl, '/login');
  console.log('✓ setup-account falls back to /login when firm slug is unavailable');

  emailService.hashToken = originalHashToken;
  User.findOne = originalUserFindOne;
  User.findOneAndUpdate = originalUserFindOneAndUpdate;
  Firm.updateOne = originalFirmUpdateOne;
  Firm.findById = originalFirmFindById;
}

async function run() {
  try {
    await shouldReturnFirmSlugRedirectAfterSetup();
    await shouldFallbackToGenericLoginWhenFirmSlugMissing();
    console.log('\n✅ Setup account redirect tests passed.');
    process.exit(0);
  } catch (error) {
    console.error('✗ Setup account redirect tests failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
