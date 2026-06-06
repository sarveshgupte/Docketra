const assert = require('assert');

process.env.JWT_SECRET = 'test-jwt-secret-placeholder-value-32ch';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
process.env.DISABLE_GOOGLE_AUTH = 'true';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuu0Lz3M0RtZpmjHtkobaN6D2PfYZ7RUTy';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
process.env.GOOGLE_CLIENT_ID = 'google-client-id';
process.env.MASTER_ENCRYPTION_KEY = 'mfa-security-key';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { encrypt } = require('../src/utils/encryption');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const AuditLog = require('../src/models/AuditLog.model');
const RefreshToken = require('../src/models/RefreshToken.model');
const LoginSession = require('../src/models/LoginSession.model');
const emailService = require('../src/services/email.service');
const jwtService = require('../src/services/jwt.service');
const routeSchemas = require('../src/schemas/auth.routes.schema');
const { login, completeMfaLogin } = require('../src/controllers/auth.controller');

const createMockRes = () => {
  const body = {};
  const cookies = {};
  const res = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value) {
      cookies[name] = value;
      return this;
    },
    json(payload) {
      this.headersSent = true;
      Object.assign(body, payload);
      return this;
    },
  };
  return { res, body, cookies };
};

async function shouldRequireEmailOtpBeforeIssuingTokens() {
  const originalSuperadminXid = process.env.SUPERADMIN_XID;
  const originalJwtSecret = process.env.JWT_SECRET;
  const testJwtSecret = 'mfa-test-secret';
  process.env.SUPERADMIN_XID = 'DIFFERENT_SUPERADMIN';
  process.env.JWT_SECRET = testJwtSecret;

  const originalUserFind = User.find;
  const originalUserFindOne = User.findOne;
  const originalUserUpdateOne = User.updateOne;
  const originalBcryptCompare = bcrypt.compare;
  const originalAccessToken = jwtService.generateAccessToken;
  const originalRefreshCreate = RefreshToken.create;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalSendLoginOtpEmail = emailService.sendLoginOtpEmail;
  const originalLoginSessionDeleteMany = LoginSession.deleteMany;
  const originalLoginSessionCreate = LoginSession.create;
  const originalClientFindOne = Client.findOne;

  let accessTokenCalled = false;
  let refreshTokenPersisted = false;
  let deliveredOtp = null;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    role: 'SUPER_ADMIN',
    name: 'MFA User',
    email: 'mfa@example.com',
    firmId: { toString: () => 'firm-id-placeholder' },
    status: 'active',
    isActive: true,
    passwordHash: 'hashed-password',
    mustSetPassword: false,
    failedLoginAttempts: 0,
    lockUntil: null,
    forcePasswordReset: false,
    twoFactorSecret: 'BASE32SECRET2345',
    save: async () => {},
  });
  User.find = async () => [await User.findOne()];
  User.updateOne = async () => ({ acknowledged: true });
  LoginSession.deleteMany = async () => ({});
  LoginSession.create = async () => ({});
  Client.findOne = () => ({
    select() { return this; },
    session() { return this; },
    lean: async () => ({
      _id: 'firm-id-placeholder',
      firmId: 'firm-id-placeholder',
      firmSlug: 'firm-a',
      businessName: 'Firm A',
      status: 'active',
    }),
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
  AuthAudit.create = async () => ({});
  AuditLog.create = async () => ({});
  emailService.sendLoginOtpEmail = async ({ otp }) => {
    deliveredOtp = otp;
    return { success: true };
  };

  const { res, body } = createMockRes();

  try {
    await login(
      {
        body: { xID: 'XMFA001', password: 'Correct#123' },
        firmId: 'firm-id-placeholder',
        firmSlug: 'firm-a',
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    process.env.SUPERADMIN_XID = originalSuperadminXid;
    process.env.JWT_SECRET = originalJwtSecret;
    User.find = originalUserFind;
    User.findOne = originalUserFindOne;
    User.updateOne = originalUserUpdateOne;
    bcrypt.compare = originalBcryptCompare;
    jwtService.generateAccessToken = originalAccessToken;
    RefreshToken.create = originalRefreshCreate;
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    emailService.sendLoginOtpEmail = originalSendLoginOtpEmail;
    LoginSession.deleteMany = originalLoginSessionDeleteMany;
    LoginSession.create = originalLoginSessionCreate;
    Client.findOne = originalClientFindOne;
  }

  assert.strictEqual(body.success, true, 'Login should return success when OTP is required');
  assert.strictEqual(body.otpRequired, true, 'Login must indicate OTP is required');
  assert(body.loginToken, 'Response must include loginToken for OTP completion');
  assert.strictEqual(body.xID, undefined, 'Response must not include xID in OTP challenge');
  assert.strictEqual(body.loginToken.length, 64, 'loginToken must be a 64-char hex string');
  assert(/^\d{6}$/.test(deliveredOtp), 'Login should send a 6 digit OTP');
  assert.strictEqual(accessTokenCalled, false, 'Access token must not be issued before MFA completion');
  assert.strictEqual(refreshTokenPersisted, false, 'Refresh token must not be persisted before MFA completion');
}

async function shouldCompleteMfaLoginAndIssueTokens() {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalMasterKey = process.env.MASTER_ENCRYPTION_KEY;
  process.env.JWT_SECRET = 'mfa-test-secret';
  process.env.MASTER_ENCRYPTION_KEY = 'mfa-security-key';
  const originalUserFind = User.find;
  const originalUserFindOne = User.findOne;
  const originalUserUpdateOne = User.updateOne;
  const originalFirmFindOne = Firm.findOne;
  const originalTotpVerify = speakeasy.totp.verify;
  const originalAccessToken = jwtService.generateAccessToken;
  const originalGenerateRefreshToken = jwtService.generateRefreshToken;
  const originalHashRefreshToken = jwtService.hashRefreshToken;
  const originalGetRefreshTokenExpiry = jwtService.getRefreshTokenExpiry;
  const originalRefreshCreate = RefreshToken.create;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalLoginSessionFindOne = LoginSession.findOne;
  const originalLoginSessionUpdateOne = LoginSession.updateOne;
  const originalClientFindOne = Client.findOne;

  const auditEvents = [];
  let refreshTokenPersisted = false;
  let observedTotpSecret = null;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    name: 'MFA User',
    email: 'mfa@example.com',
    role: 'ADMIN',
    firmId: { toString: () => 'firm-id-placeholder' },
    defaultClientId: { toString: () => '507f1f77bcf86cd799439033' },
    allowedCategories: [],
    isActive: true,
    mustSetPassword: false,
    passwordSetAt: null,
    forcePasswordReset: false,
    twoFactorSecret: encrypt('BASE32SECRET2345'),
  });
  User.find = async () => [await User.findOne()];
  User.updateOne = async () => ({ acknowledged: true });
  LoginSession.findOne = async () => ({
    _id: 'session-id',
    userId: '507f1f77bcf86cd799439011',
    tokenHash: 'hashed-login-token',
    consumedAt: null,
  });
  LoginSession.updateOne = async () => ({});
  Client.findOne = () => ({
    select() { return this; },
    session() { return this; },
    lean: async () => ({
      _id: 'firm-id-placeholder',
      firmId: 'firm-id-placeholder',
      firmSlug: 'firm-a',
      businessName: 'Firm A',
      status: 'active',
    }),
  });
  Firm.findOne = async () => ({ firmSlug: 'firm-a' });
  speakeasy.totp.verify = ({ secret }) => {
    observedTotpSecret = secret;
    return true;
  };
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
  AuditLog.create = async () => ({});

  const { res, body, cookies } = createMockRes();
  const preAuthToken = jwt.sign(
    {
      userId: '507f1f77bcf86cd799439011',
      firmId: 'firm-id-placeholder',
      role: 'ADMIN',
      mfaStage: true,
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  try {
    await completeMfaLogin(
      {
        body: { token: '123456', preAuthToken },
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.find = originalUserFind;
    User.findOne = originalUserFindOne;
    User.updateOne = originalUserUpdateOne;
    Firm.findOne = originalFirmFindOne;
    speakeasy.totp.verify = originalTotpVerify;
    jwtService.generateAccessToken = originalAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
    jwtService.getRefreshTokenExpiry = originalGetRefreshTokenExpiry;
    RefreshToken.create = originalRefreshCreate;
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    LoginSession.findOne = originalLoginSessionFindOne;
    LoginSession.updateOne = originalLoginSessionUpdateOne;
    Client.findOne = originalClientFindOne;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.MASTER_ENCRYPTION_KEY = originalMasterKey;
  }

  assert.strictEqual(body.success, true, 'MFA completion should succeed');
  assert.strictEqual(body.message, 'Login successful', 'MFA completion should return login success message');
  assert.strictEqual(cookies.accessToken, 'access-token', 'MFA completion should set access token cookie');
  assert.strictEqual(cookies.refreshToken, 'refresh-token', 'MFA completion should set refresh token cookie');
  assert.strictEqual(body.data.xID, 'XMFA001', 'MFA completion should return user payload');
  assert.strictEqual(refreshTokenPersisted, true, 'MFA completion should persist refresh token');
  assert.strictEqual(observedTotpSecret, 'BASE32SECRET2345', 'MFA completion must decrypt stored MFA secret before TOTP validation');
  assert.strictEqual(auditEvents.some((e) => e.actionType === 'MFA_LOGIN_SUCCESS'), true, 'MFA completion should log MFA_LOGIN_SUCCESS');
}

async function shouldRejectInvalidMfaToken() {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalMasterKey = process.env.MASTER_ENCRYPTION_KEY;
  process.env.JWT_SECRET = 'mfa-test-secret';
  process.env.MASTER_ENCRYPTION_KEY = 'mfa-security-key';
  const originalUserFind = User.find;
  const originalUserFindOne = User.findOne;
  const originalUserUpdateOne = User.updateOne;
  const originalTotpVerify = speakeasy.totp.verify;
  const originalAccessToken = jwtService.generateAccessToken;
  const originalLoginSessionFindOne = LoginSession.findOne;
  const originalClientFindOne = Client.findOne;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;

  let accessTokenCalled = false;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    status: 'ACTIVE',
    isActive: true,
    twoFactorSecret: encrypt('BASE32SECRET2345'),
  });
  User.find = async () => [await User.findOne()];
  User.updateOne = async () => ({ acknowledged: true });
  LoginSession.findOne = async () => ({
    _id: 'session-id',
    userId: '507f1f77bcf86cd799439011',
    tokenHash: 'hashed-login-token',
    consumedAt: null,
  });
  Client.findOne = () => ({
    select() { return this; },
    session() { return this; },
    lean: async () => ({
      _id: 'firm-id-placeholder',
      firmId: 'firm-id-placeholder',
      firmSlug: 'firm-a',
      businessName: 'Firm A',
      status: 'active',
    }),
  });
  speakeasy.totp.verify = () => false;
  AuthAudit.create = async () => ({});
  AuditLog.create = async () => ({});
  jwtService.generateAccessToken = () => {
    accessTokenCalled = true;
    return 'access-token';
  };

  const { res, body } = createMockRes();
  const preAuthToken = jwt.sign(
    {
      userId: '507f1f77bcf86cd799439011',
      firmId: 'firm-id-placeholder',
      role: 'ADMIN',
      mfaStage: true,
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  try {
    await completeMfaLogin(
      {
        body: { token: '000000', preAuthToken },
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.find = originalUserFind;
    User.findOne = originalUserFindOne;
    User.updateOne = originalUserUpdateOne;
    speakeasy.totp.verify = originalTotpVerify;
    jwtService.generateAccessToken = originalAccessToken;
    LoginSession.findOne = originalLoginSessionFindOne;
    Client.findOne = originalClientFindOne;
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.MASTER_ENCRYPTION_KEY = originalMasterKey;
  }

  assert.strictEqual(res.statusCode, 401, 'Invalid MFA token should return 401');
  assert.strictEqual(body.success, false, 'Invalid MFA token should fail');
  assert.strictEqual(accessTokenCalled, false, 'Invalid MFA token must not issue JWT');
}

async function shouldRejectMissingPreAuthToken() {
  const originalUserFind = User.find;
  const originalUserFindOne = User.findOne;
  const originalTotpVerify = speakeasy.totp.verify;

  let userLookupCalled = false;
  User.findOne = async () => {
    userLookupCalled = true;
    return null;
  };
  User.find = async () => [await User.findOne()];
  speakeasy.totp.verify = () => true;

  const { res, body } = createMockRes();

  try {
    await completeMfaLogin(
      {
        body: { token: '123456' },
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.find = originalUserFind;
    User.findOne = originalUserFindOne;
    speakeasy.totp.verify = originalTotpVerify;
  }

  assert.strictEqual(res.statusCode, 401, 'Missing preAuthToken should return 401');
  assert.strictEqual(body.success, false, 'Missing preAuthToken should fail');
  assert.strictEqual(userLookupCalled, false, 'Missing preAuthToken must fail before user lookup');
}

function shouldValidateCompleteMfaLoginSchema() {
  const schema = routeSchemas['POST /complete-mfa-login'].body;
  const valid = schema.safeParse({ token: '123456', preAuthToken: 'pre-auth-jwt' });
  const invalid = schema.safeParse({ token: '123456' });

  assert.strictEqual(valid.success, true, 'Schema should accept token and preAuthToken');
  assert.strictEqual(invalid.success, false, 'Schema should reject missing preAuthToken');
}

async function run() {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    await shouldRequireEmailOtpBeforeIssuingTokens();
    await shouldCompleteMfaLoginAndIssueTokens();
    await shouldRejectInvalidMfaToken();
    await shouldRejectMissingPreAuthToken();
    shouldValidateCompleteMfaLoginSchema();
    console.log('\nMFA login flow tests passed.');
  } catch (error) {
    console.error('MFA login flow tests failed:', error.message);
    process.exit(1);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
}

run();
