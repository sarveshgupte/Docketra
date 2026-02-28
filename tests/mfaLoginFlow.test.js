const assert = require('assert');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const RefreshToken = require('../src/models/RefreshToken.model');
const jwtService = require('../src/services/jwt.service');
const routeSchemas = require('../src/schemas/auth.routes.schema');
const { login, completeMfaLogin } = require('../src/controllers/auth.controller');

const createMockRes = () => {
  const body = {};
  const res = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.headersSent = true;
      Object.assign(body, payload);
      return this;
    },
  };
  return { res, body };
};

async function shouldRequireMfaBeforeIssuingTokens() {
  process.env.SUPERADMIN_XID = 'DIFFERENT_SUPERADMIN';
  process.env.JWT_SECRET = 'mfa-test-secret';

  const originalUserFindOne = User.findOne;
  const originalBcryptCompare = bcrypt.compare;
  const originalAccessToken = jwtService.generateAccessToken;
  const originalRefreshCreate = RefreshToken.create;

  let accessTokenCalled = false;
  let refreshTokenPersisted = false;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    role: 'SUPER_ADMIN',
    firmId: { toString: () => '507f1f77bcf86cd799439022' },
    status: 'ACTIVE',
    isActive: true,
    passwordHash: 'hashed-password',
    mustSetPassword: false,
    failedLoginAttempts: 0,
    lockUntil: null,
    forcePasswordReset: false,
    twoFactorSecret: 'BASE32SECRET2345',
    save: async () => {},
  });
  bcrypt.compare = async () => true;
  jwtService.generateAccessToken = () => {
    accessTokenCalled = true;
    return 'access-token';
  };
  RefreshToken.create = async () => {
    refreshTokenPersisted = true;
    return {};
  };

  const { res, body } = createMockRes();

  try {
    await login(
      {
        body: { xID: 'XMFA001', password: 'Correct#123' },
        firmId: '507f1f77bcf86cd799439022',
        firmSlug: 'firm-a',
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.findOne = originalUserFindOne;
    bcrypt.compare = originalBcryptCompare;
    jwtService.generateAccessToken = originalAccessToken;
    RefreshToken.create = originalRefreshCreate;
  }

  assert.strictEqual(body.success, true, 'Login should return success when MFA is required');
  assert.strictEqual(body.mfaRequired, true, 'Login must indicate MFA is required');
  assert.strictEqual(body.xID, 'XMFA001', 'Response must include xID for MFA completion');
  assert.strictEqual(accessTokenCalled, false, 'Access token must not be issued before MFA completion');
  assert.strictEqual(refreshTokenPersisted, false, 'Refresh token must not be persisted before MFA completion');
}

async function shouldCompleteMfaLoginAndIssueTokens() {
  const originalUserFindOne = User.findOne;
  const originalFirmFindOne = Firm.findOne;
  const originalTotpVerify = speakeasy.totp.verify;
  const originalAccessToken = jwtService.generateAccessToken;
  const originalGenerateRefreshToken = jwtService.generateRefreshToken;
  const originalHashRefreshToken = jwtService.hashRefreshToken;
  const originalGetRefreshTokenExpiry = jwtService.getRefreshTokenExpiry;
  const originalRefreshCreate = RefreshToken.create;
  const originalAuthAuditCreate = AuthAudit.create;

  const auditEvents = [];
  let refreshTokenPersisted = false;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    name: 'MFA User',
    email: 'mfa@example.com',
    role: 'ADMIN',
    firmId: { toString: () => '507f1f77bcf86cd799439022' },
    defaultClientId: { toString: () => '507f1f77bcf86cd799439033' },
    allowedCategories: [],
    isActive: true,
    mustSetPassword: false,
    passwordSetAt: null,
    forcePasswordReset: false,
    twoFactorSecret: 'BASE32SECRET2345',
  });
  Firm.findOne = async () => ({ firmSlug: 'firm-a' });
  speakeasy.totp.verify = () => true;
  jwtService.generateAccessToken = () => 'access-token';
  jwtService.generateRefreshToken = () => 'refresh-token';
  jwtService.hashRefreshToken = () => 'hashed-refresh-token';
  jwtService.getRefreshTokenExpiry = () => new Date(Date.now() + 60 * 60 * 1000);
  RefreshToken.create = async () => {
    refreshTokenPersisted = true;
    return {};
  };
  AuthAudit.create = async (doc) => {
    auditEvents.push(doc);
    return doc;
  };

  const { res, body } = createMockRes();

  try {
    await completeMfaLogin(
      {
        body: { xID: 'XMFA001', token: '123456' },
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.findOne = originalUserFindOne;
    Firm.findOne = originalFirmFindOne;
    speakeasy.totp.verify = originalTotpVerify;
    jwtService.generateAccessToken = originalAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
    jwtService.getRefreshTokenExpiry = originalGetRefreshTokenExpiry;
    RefreshToken.create = originalRefreshCreate;
    AuthAudit.create = originalAuthAuditCreate;
  }

  assert.strictEqual(body.success, true, 'MFA completion should succeed');
  assert.strictEqual(body.message, 'Login successful', 'MFA completion should return login success message');
  assert.strictEqual(body.accessToken, 'access-token', 'MFA completion should return access token');
  assert.strictEqual(body.refreshToken, 'refresh-token', 'MFA completion should return refresh token');
  assert.strictEqual(body.data.xID, 'XMFA001', 'MFA completion should return user payload');
  assert.strictEqual(refreshTokenPersisted, true, 'MFA completion should persist refresh token');
  assert.strictEqual(auditEvents.some((e) => e.actionType === 'MFA_LOGIN_SUCCESS'), true, 'MFA completion should log MFA_LOGIN_SUCCESS');
}

async function shouldRejectInvalidMfaToken() {
  const originalUserFindOne = User.findOne;
  const originalTotpVerify = speakeasy.totp.verify;
  const originalAccessToken = jwtService.generateAccessToken;

  let accessTokenCalled = false;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    status: 'ACTIVE',
    isActive: true,
    twoFactorSecret: 'BASE32SECRET2345',
  });
  speakeasy.totp.verify = () => false;
  jwtService.generateAccessToken = () => {
    accessTokenCalled = true;
    return 'access-token';
  };

  const { res, body } = createMockRes();

  try {
    await completeMfaLogin(
      {
        body: { xID: 'XMFA001', token: '000000' },
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.findOne = originalUserFindOne;
    speakeasy.totp.verify = originalTotpVerify;
    jwtService.generateAccessToken = originalAccessToken;
  }

  assert.strictEqual(res.statusCode, 401, 'Invalid MFA token should return 401');
  assert.strictEqual(body.success, false, 'Invalid MFA token should fail');
  assert.strictEqual(accessTokenCalled, false, 'Invalid MFA token must not issue JWT');
}

function shouldValidateCompleteMfaLoginSchema() {
  const schema = routeSchemas['POST /complete-mfa-login'].body;
  const valid = schema.safeParse({ xID: 'XMFA001', token: '123456' });
  const invalid = schema.safeParse({ xID: 'XMFA001' });

  assert.strictEqual(valid.success, true, 'Schema should accept xID and token');
  assert.strictEqual(invalid.success, false, 'Schema should reject missing token');
}

async function run() {
  try {
    await shouldRequireMfaBeforeIssuingTokens();
    await shouldCompleteMfaLoginAndIssueTokens();
    await shouldRejectInvalidMfaToken();
    shouldValidateCompleteMfaLoginSchema();
    console.log('\nMFA login flow tests passed.');
  } catch (error) {
    console.error('MFA login flow tests failed:', error.message);
    process.exit(1);
  }
}

run();
