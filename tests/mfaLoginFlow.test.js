const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { encrypt } = require('../src/utils/encryption');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const AuditLog = require('../src/models/AuditLog.model');
const RefreshToken = require('../src/models/RefreshToken.model');
const emailService = require('../src/services/email.service');
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

async function shouldRequireEmailOtpBeforeIssuingTokens() {
  const originalSuperadminXid = process.env.SUPERADMIN_XID;
  const originalJwtSecret = process.env.JWT_SECRET;
  const testJwtSecret = 'mfa-test-secret';
  process.env.SUPERADMIN_XID = 'DIFFERENT_SUPERADMIN';
  process.env.JWT_SECRET = testJwtSecret;

  const originalUserFindOne = User.findOne;
  const originalBcryptCompare = bcrypt.compare;
  const originalAccessToken = jwtService.generateAccessToken;
  const originalRefreshCreate = RefreshToken.create;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalSendLoginOtpEmail = emailService.sendLoginOtpEmail;

  let accessTokenCalled = false;
  let refreshTokenPersisted = false;
  let deliveredOtp = null;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    role: 'SUPER_ADMIN',
    name: 'MFA User',
    email: 'mfa@example.com',
    firmId: { toString: () => '507f1f77bcf86cd799439022' },
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
    process.env.SUPERADMIN_XID = originalSuperadminXid;
    process.env.JWT_SECRET = originalJwtSecret;
    User.findOne = originalUserFindOne;
    bcrypt.compare = originalBcryptCompare;
    jwtService.generateAccessToken = originalAccessToken;
    RefreshToken.create = originalRefreshCreate;
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    emailService.sendLoginOtpEmail = originalSendLoginOtpEmail;
  }

  assert.strictEqual(body.success, true, 'Login should return success when OTP is required');
  assert.strictEqual(body.otpRequired, true, 'Login must indicate OTP is required');
  assert(body.loginToken, 'Response must include loginToken for OTP completion');
  assert.strictEqual(body.xID, undefined, 'Response must not include xID in OTP challenge');
  const decodedLoginToken = jwt.verify(body.loginToken, testJwtSecret);
  assert.strictEqual(decodedLoginToken.userId, '507f1f77bcf86cd799439011', 'loginToken must include userId');
  assert.strictEqual(decodedLoginToken.firmId, '507f1f77bcf86cd799439022', 'loginToken must include firmId');
  assert.strictEqual(decodedLoginToken.role, 'SUPER_ADMIN', 'loginToken must include role');
  assert.strictEqual(decodedLoginToken.loginStage, 'email-otp', 'loginToken must include OTP stage marker');
  assert(/^\d{6}$/.test(deliveredOtp), 'Login should send a 6 digit OTP');
  assert.strictEqual(accessTokenCalled, false, 'Access token must not be issued before MFA completion');
  assert.strictEqual(refreshTokenPersisted, false, 'Refresh token must not be persisted before MFA completion');
}

async function shouldCompleteMfaLoginAndIssueTokens() {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalSecurityKey = process.env.SECURITY_ENCRYPTION_KEY;
  process.env.JWT_SECRET = 'mfa-test-secret';
  process.env.SECURITY_ENCRYPTION_KEY = 'mfa-security-key';
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
  let observedTotpSecret = null;

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
    twoFactorSecret: encrypt('BASE32SECRET2345'),
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

  const { res, body } = createMockRes();
  const preAuthToken = jwt.sign(
    {
      userId: '507f1f77bcf86cd799439011',
      firmId: '507f1f77bcf86cd799439022',
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
    User.findOne = originalUserFindOne;
    Firm.findOne = originalFirmFindOne;
    speakeasy.totp.verify = originalTotpVerify;
    jwtService.generateAccessToken = originalAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
    jwtService.getRefreshTokenExpiry = originalGetRefreshTokenExpiry;
    RefreshToken.create = originalRefreshCreate;
    AuthAudit.create = originalAuthAuditCreate;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.SECURITY_ENCRYPTION_KEY = originalSecurityKey;
  }

  assert.strictEqual(body.success, true, 'MFA completion should succeed');
  assert.strictEqual(body.message, 'Login successful', 'MFA completion should return login success message');
  assert.strictEqual(body.accessToken, 'access-token', 'MFA completion should return access token');
  assert.strictEqual(body.refreshToken, 'refresh-token', 'MFA completion should return refresh token');
  assert.strictEqual(body.data.xID, 'XMFA001', 'MFA completion should return user payload');
  assert.strictEqual(refreshTokenPersisted, true, 'MFA completion should persist refresh token');
  assert.strictEqual(observedTotpSecret, 'BASE32SECRET2345', 'MFA completion must decrypt stored MFA secret before TOTP validation');
  assert.strictEqual(auditEvents.some((e) => e.actionType === 'MFA_LOGIN_SUCCESS'), true, 'MFA completion should log MFA_LOGIN_SUCCESS');
}

async function shouldRejectInvalidMfaToken() {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalSecurityKey = process.env.SECURITY_ENCRYPTION_KEY;
  process.env.JWT_SECRET = 'mfa-test-secret';
  process.env.SECURITY_ENCRYPTION_KEY = 'mfa-security-key';
  const originalUserFindOne = User.findOne;
  const originalTotpVerify = speakeasy.totp.verify;
  const originalAccessToken = jwtService.generateAccessToken;

  let accessTokenCalled = false;

  User.findOne = async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'XMFA001',
    status: 'ACTIVE',
    isActive: true,
    twoFactorSecret: encrypt('BASE32SECRET2345'),
  });
  speakeasy.totp.verify = () => false;
  jwtService.generateAccessToken = () => {
    accessTokenCalled = true;
    return 'access-token';
  };

  const { res, body } = createMockRes();
  const preAuthToken = jwt.sign(
    {
      userId: '507f1f77bcf86cd799439011',
      firmId: '507f1f77bcf86cd799439022',
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
    User.findOne = originalUserFindOne;
    speakeasy.totp.verify = originalTotpVerify;
    jwtService.generateAccessToken = originalAccessToken;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.SECURITY_ENCRYPTION_KEY = originalSecurityKey;
  }

  assert.strictEqual(res.statusCode, 401, 'Invalid MFA token should return 401');
  assert.strictEqual(body.success, false, 'Invalid MFA token should fail');
  assert.strictEqual(accessTokenCalled, false, 'Invalid MFA token must not issue JWT');
}

async function shouldRejectMissingPreAuthToken() {
  const originalUserFindOne = User.findOne;
  const originalTotpVerify = speakeasy.totp.verify;

  let userLookupCalled = false;
  User.findOne = async () => {
    userLookupCalled = true;
    return null;
  };
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
