const assert = require('assert');
const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const RefreshToken = require('../src/models/RefreshToken.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const AuditLog = require('../src/models/AuditLog.model');
const emailService = require('../src/services/email.service');
const jwtService = require('../src/services/jwt.service');

const controllerModulePath = require.resolve('../src/controllers/auth.controller');
const tenantResolverModulePath = require.resolve('../src/middleware/tenantResolver');
const firmRoutesModulePath = require.resolve('../src/routes/firm.routes');

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

const restoreModuleCache = (modulePath, original) => {
  delete require.cache[modulePath];
  if (original) {
    require.cache[modulePath] = original;
  }
};

async function shouldMountFirmScopedApiRoutes() {
  const originalControllerCache = require.cache[controllerModulePath];
  const originalTenantResolverCache = require.cache[tenantResolverModulePath];
  const originalFirmRoutesCache = require.cache[firmRoutesModulePath];

  try {
    delete require.cache[controllerModulePath];
    delete require.cache[tenantResolverModulePath];
    delete require.cache[firmRoutesModulePath];

    require.cache[controllerModulePath] = {
      id: controllerModulePath,
      filename: controllerModulePath,
      loaded: true,
      exports: {
        login: (req, res) => res.json({ route: 'login', firmSlug: req.params.firmSlug }),
        verifyLoginOtp: (req, res) => res.json({ route: 'verify-otp', firmSlug: req.params.firmSlug }),
      },
    };
    require.cache[tenantResolverModulePath] = {
      id: tenantResolverModulePath,
      filename: tenantResolverModulePath,
      loaded: true,
      exports: (req, _res, next) => {
        req.firmId = '507f1f77bcf86cd799439022';
        req.firmIdString = 'FIRM001';
        req.firmSlug = req.params.firmSlug;
        req.firmName = 'Firm A';
        req.firm = { status: 'active' };
        next();
      },
    };

    const firmRoutes = require('../src/routes/firm.routes');
    const app = express();
    app.use(express.json());
    app.use('/api/:firmSlug', firmRoutes);

    const loginResponse = await request(app)
      .post('/api/firm-a/login')
      .send({ xid: 'X000001', password: 'Correct#123' });
    assert.strictEqual(loginResponse.status, 200);
    assert.strictEqual(loginResponse.body.route, 'login');
    assert.strictEqual(loginResponse.body.firmSlug, 'firm-a');

    const verifyOtpResponse = await request(app)
      .post('/api/firm-a/verify-otp')
      .send({ loginToken: 'token', otp: '123456' });
    assert.strictEqual(verifyOtpResponse.status, 200);
    assert.strictEqual(verifyOtpResponse.body.route, 'verify-otp');
    assert.strictEqual(verifyOtpResponse.body.firmSlug, 'firm-a');
  } finally {
    restoreModuleCache(controllerModulePath, originalControllerCache);
    restoreModuleCache(tenantResolverModulePath, originalTenantResolverCache);
    restoreModuleCache(firmRoutesModulePath, originalFirmRoutesCache);
  }
}

async function shouldRequireEmailOtpForFirmScopedLogin() {
  const { login } = require('../src/controllers/auth.controller');
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'firm-login-otp-secret';

  const originalUserFindOne = User.findOne;
  const originalFirmCountDocuments = Firm.countDocuments;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalSendLoginOtpEmail = emailService.sendLoginOtpEmail;

  const passwordHash = await bcrypt.hash('Correct#123', 4);
  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'X000001',
    name: 'Tenant User',
    email: 'tenant@example.com',
    role: 'Admin',
    firmId: { toString: () => '507f1f77bcf86cd799439022' },
    defaultClientId: { toString: () => '507f1f77bcf86cd799439033' },
    status: 'active',
    isActive: true,
    passwordHash,
    mustSetPassword: false,
    failedLoginAttempts: 0,
    lockUntil: null,
    forcePasswordReset: false,
    allowedCategories: [],
    save: async () => {},
  };

  let deliveredOtp = null;

  User.findOne = async () => user;
  Firm.countDocuments = async () => 1;
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
        body: { xid: 'X000001', password: 'Correct#123' },
        params: { firmSlug: 'firm-a' },
        firmId: '507f1f77bcf86cd799439022',
        firmSlug: 'firm-a',
        firmName: 'Firm A',
        loginScope: 'tenant',
        skipTransaction: true,
        ip: '127.0.0.1',
        get: () => 'agent',
      },
      res,
      () => {}
    );
  } finally {
    User.findOne = originalUserFindOne;
    Firm.countDocuments = originalFirmCountDocuments;
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    emailService.sendLoginOtpEmail = originalSendLoginOtpEmail;
    process.env.JWT_SECRET = originalJwtSecret;
  }

  assert.strictEqual(body.success, true, 'Password login should succeed when OTP is required');
  assert.strictEqual(body.otpRequired, true, 'Password login should require OTP');
  assert(body.loginToken, 'Password login should return a temporary login token');
  assert.strictEqual(body.resendCooldownSeconds, 3, 'Development login should expose a short OTP resend cooldown');
  assert.strictEqual(body.accessToken, undefined, 'Access token must not be issued before OTP verification');
  assert(/^\d{6}$/.test(deliveredOtp), 'A 6 digit OTP must be sent');
  assert(user.loginOtpHash && user.loginOtpHash !== deliveredOtp, 'OTP must be stored as a hash');
  assert(user.loginOtpExpiresAt instanceof Date, 'OTP expiry must be stored');
  assert.strictEqual(user.loginOtpAttempts, 0, 'OTP attempts must reset when challenge is created');
  assert.strictEqual(user.loginOtpResendCount, 0, 'Initial OTP should reset resend count');
  assert.strictEqual(user.loginOtpLockedUntil, null, 'Initial OTP should not be locked');
  const decodedLoginToken = jwt.verify(body.loginToken, 'firm-login-otp-secret');
  assert.strictEqual(decodedLoginToken.userId, '507f1f77bcf86cd799439011');
  assert.strictEqual(decodedLoginToken.firmId, '507f1f77bcf86cd799439022');
  assert.strictEqual(decodedLoginToken.firmSlug, 'firm-a');
  assert.strictEqual(decodedLoginToken.loginStage, 'email-otp');
}

async function shouldVerifyEmailOtpAndIssueTokens() {
  const { verifyLoginOtp } = require('../src/controllers/auth.controller');
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'firm-login-otp-secret';

  const originalUserFindOne = User.findOne;
  const originalFirmFindOne = Firm.findOne;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalAccessToken = jwtService.generateAccessToken;
  const originalGenerateRefreshToken = jwtService.generateRefreshToken;
  const originalHashRefreshToken = jwtService.hashRefreshToken;
  const originalGetRefreshTokenExpiry = jwtService.getRefreshTokenExpiry;
  const originalRefreshCreate = RefreshToken.create;

  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'X000001',
    name: 'Tenant User',
    email: 'tenant@example.com',
    role: 'Admin',
    firmId: { toString: () => '507f1f77bcf86cd799439022' },
    defaultClientId: { toString: () => '507f1f77bcf86cd799439033' },
    status: 'active',
    isActive: true,
    loginOtpHash: await bcrypt.hash('123456', 4),
    loginOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    loginOtpAttempts: 0,
    loginOtpLastSentAt: new Date(),
    mustSetPassword: false,
    forcePasswordReset: false,
    allowedCategories: [],
    save: async () => {},
  };

  User.findOne = async () => user;
  Firm.findOne = async () => ({ firmSlug: 'firm-a' });
  AuthAudit.create = async () => ({});
  AuditLog.create = async () => ({});
  jwtService.generateAccessToken = () => 'access-token';
  jwtService.generateRefreshToken = () => 'refresh-token';
  jwtService.hashRefreshToken = () => 'hashed-refresh-token';
  jwtService.getRefreshTokenExpiry = () => new Date(Date.now() + 60 * 60 * 1000);
  RefreshToken.create = async () => ({});

  const loginToken = jwt.sign(
    {
      userId: '507f1f77bcf86cd799439011',
      firmId: '507f1f77bcf86cd799439022',
      firmSlug: 'firm-a',
      role: 'Admin',
      loginStage: 'email-otp',
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  const { res, body } = createMockRes();

  try {
    await verifyLoginOtp(
      {
        body: { loginToken, otp: '123456' },
        params: { firmSlug: 'firm-a' },
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
    Firm.findOne = originalFirmFindOne;
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    jwtService.generateAccessToken = originalAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
    jwtService.getRefreshTokenExpiry = originalGetRefreshTokenExpiry;
    RefreshToken.create = originalRefreshCreate;
    process.env.JWT_SECRET = originalJwtSecret;
  }

  assert.strictEqual(body.success, true, 'OTP verification should succeed');
  assert.strictEqual(body.accessToken, 'access-token', 'OTP verification should issue an access token');
  assert.strictEqual(body.refreshToken, 'refresh-token', 'OTP verification should issue a refresh token');
  assert.strictEqual(body.data.xID, 'X000001', 'OTP verification should return tenant user details');
  assert.strictEqual(body.data.firmSlug, 'firm-a', 'OTP verification should preserve firm slug');
  assert.strictEqual(user.loginOtpHash, null, 'OTP hash should be cleared after successful verification');
  assert.strictEqual(user.loginOtpExpiresAt, null, 'OTP expiry should be cleared after successful verification');
  assert.strictEqual(user.loginOtpAttempts, 0, 'OTP attempts should reset after successful verification');
}

async function shouldBlockAfterMaxInvalidOtpAttempts() {
  const { verifyLoginOtp } = require('../src/controllers/auth.controller');
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.JWT_SECRET = 'firm-login-otp-secret';
  process.env.NODE_ENV = 'production';

  const originalUserFindOne = User.findOne;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;

  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'X000001',
    email: 'tenant@example.com',
    role: 'Admin',
    firmId: { toString: () => '507f1f77bcf86cd799439022' },
    status: 'active',
    isActive: true,
    loginOtpHash: await bcrypt.hash('654321', 4),
    loginOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    loginOtpAttempts: 4,
    loginOtpLastSentAt: new Date(),
    save: async () => {},
  };

  User.findOne = async () => user;
  AuthAudit.create = async () => ({});
  AuditLog.create = async () => ({});

  const loginToken = jwt.sign(
    {
      userId: '507f1f77bcf86cd799439011',
      firmId: '507f1f77bcf86cd799439022',
      firmSlug: 'firm-a',
      role: 'Admin',
      loginStage: 'email-otp',
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  const { res, body } = createMockRes();

  try {
    await verifyLoginOtp(
      {
        body: { loginToken, otp: '000000' },
        params: { firmSlug: 'firm-a' },
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
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.strictEqual(res.statusCode, 429, 'Fifth invalid OTP attempt should be rate limited');
  assert.strictEqual(body.success, false, 'Invalid OTP should fail');
  assert.strictEqual(body.remainingAttempts, 0, 'No attempts should remain after the fifth invalid OTP');
  assert.strictEqual(body.error, 'Too many attempts. Try again later.', 'Rate limit response should use the secure OTP lock message');
  assert(user.loginOtpHash, 'OTP hash should remain present while the lock is active');
  assert(user.loginOtpExpiresAt instanceof Date, 'OTP expiry should remain present while the lock is active');
  assert.strictEqual(user.loginOtpAttempts, 5, 'OTP attempt counter should increment to the configured production max');
  assert(user.loginOtpLockedUntil instanceof Date, 'OTP flow should record when the user is locked out');
}

async function shouldResendOtpWithDevelopmentCooldown() {
  const { resendLoginOtp } = require('../src/controllers/auth.controller');
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';

  const originalUserFindOne = User.findOne;
  const originalFirmFindOne = Firm.findOne;
  const originalAuthAuditCreate = AuthAudit.create;
  const originalAuditLogCreate = AuditLog.create;
  const originalSendLoginOtpEmail = emailService.sendLoginOtpEmail;

  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    xID: 'X000001',
    name: 'Tenant User',
    email: 'tenant@example.com',
    role: 'Admin',
    firmId: '507f1f77bcf86cd799439022',
    status: 'active',
    isActive: true,
    loginOtpHash: await bcrypt.hash('654321', 4),
    loginOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    loginOtpAttempts: 4,
    loginOtpResendCount: 2,
    loginOtpLastSentAt: new Date(Date.now() - 10 * 1000),
    loginOtpLockedUntil: new Date(Date.now() - 2 * 1000),
    save: async () => {},
  };

  let deliveredOtp = null;

  User.findOne = async () => user;
  Firm.findOne = async () => ({
    _id: '507f1f77bcf86cd799439022',
    firmSlug: 'firm-a',
    name: 'Firm A',
    status: 'active',
  });
  AuthAudit.create = async () => ({});
  AuditLog.create = async () => ({});
  emailService.sendLoginOtpEmail = async ({ otp }) => {
    deliveredOtp = otp;
    return { success: true };
  };

  const { res, body } = createMockRes();

  try {
    await resendLoginOtp(
      {
        body: { xID: 'X000001', firmSlug: 'firm-a' },
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
    AuthAudit.create = originalAuthAuditCreate;
    AuditLog.create = originalAuditLogCreate;
    emailService.sendLoginOtpEmail = originalSendLoginOtpEmail;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.strictEqual(body.success, true, 'OTP resend should succeed for a valid tenant user');
  assert.strictEqual(body.message, 'OTP resent successfully');
  assert.strictEqual(body.resendCooldownSeconds, 3, 'Development resend should return the short cooldown');
  assert(/^\d{6}$/.test(deliveredOtp), 'Resend should send a fresh 6 digit OTP');
  assert(user.loginOtpHash && user.loginOtpHash !== deliveredOtp, 'Resent OTP must be stored hashed');
  assert.strictEqual(user.loginOtpAttempts, 0, 'Resend should reset OTP attempts');
  assert.strictEqual(user.loginOtpResendCount, 3, 'Resend should increment resend count');
  assert.strictEqual(user.loginOtpLockedUntil, null, 'Resend should clear an expired OTP lock');
}

async function run() {
  try {
    await shouldMountFirmScopedApiRoutes();
    await shouldRequireEmailOtpForFirmScopedLogin();
    await shouldVerifyEmailOtpAndIssueTokens();
    await shouldBlockAfterMaxInvalidOtpAttempts();
    await shouldResendOtpWithDevelopmentCooldown();
    console.log('Firm-scoped login OTP tests passed.');
  } catch (error) {
    console.error('Firm-scoped login OTP tests failed:', error);
    process.exit(1);
  }
}

run();
