const assert = require('assert');

const authControllerPath = require.resolve('../src/controllers/auth.controller');
const userControllerPath = require.resolve('../src/controllers/user.controller');
const otpServicePath = require.resolve('../src/services/otp.service');
const jwtServicePath = require.resolve('../src/services/jwt.service');
const userModelPath = require.resolve('../src/models/User.model');
const authIdentityPath = require.resolve('../src/models/AuthIdentity.model');
const refreshTokenPath = require.resolve('../src/models/RefreshToken.model');
const firmModelPath = require.resolve('../src/models/Firm.model');
const signupServicePath = require.resolve('../src/services/signup.service');
const emailServicePath = require.resolve('../src/services/email/sendWelcomeEmail');
const xIdGeneratorPath = require.resolve('../src/services/xIDGenerator');
const googleapisPath = require.resolve('googleapis');
const mongoosePath = require.resolve('mongoose');

const clear = (path) => { delete require.cache[path]; };

const createRes = () => {
  const state = { statusCode: 200, body: null };
  const res = {
    headersSent: false,
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      this.headersSent = true;
      return this;
    },
  };
  return { res, state };
};

function bootstrapAuthController(overrides = {}) {
  [
    authControllerPath,
    otpServicePath,
    jwtServicePath,
    signupServicePath,
    emailServicePath,
  ].forEach(clear);

  const otpService = require('../src/services/otp.service');
  otpService.sendOtp = overrides.sendOtpImpl || (async () => ({}));
  otpService.verifyOtp = overrides.verifyOtpImpl || (async () => ({}));

  const jwtService = require('../src/services/jwt.service');
  jwtService.generateAccessToken = () => 'access-token';
  jwtService.generateRefreshToken = () => 'refresh-token';
  jwtService.hashRefreshToken = () => 'hashed-refresh-token';

  const mongoose = require('mongoose');
  mongoose.startSession = async () => ({
    async withTransaction(fn) { await fn(); },
    async endSession() {},
  });

  const User = require('../src/models/User.model');
  User.findOne = overrides.userFindOneImpl || (async () => null);
  User.findById = overrides.userFindByIdImpl || (async () => null);
  User.exists = async () => false;
  User.updateOne = async () => ({ acknowledged: true });
  User.create = overrides.userCreateImpl || (async () => [{
    _id: 'u-created',
    xid: 'DK-NEW01',
    xID: 'X000001',
    primary_email: 'new@example.com',
    email: 'new@example.com',
    isOnboarded: false,
    role: 'Employee',
    save: async () => {},
  }]);

  const Firm = require('../src/models/Firm.model');
  Firm.countDocuments = overrides.firmCountDocumentsImpl || (async () => 0);

  const AuthIdentity = require('../src/models/AuthIdentity.model');
  AuthIdentity.findOne = overrides.authIdentityFindOneImpl || (async () => null);
  AuthIdentity.create = overrides.authIdentityCreateImpl || (async () => [{ _id: 'identity' }]);

  const RefreshToken = require('../src/models/RefreshToken.model');
  RefreshToken.create = async () => ({ _id: 'refresh' });

  const signupService = require('../src/services/signup.service');
  signupService.createFirmAndAdmin = overrides.createFirmAndAdminImpl || (async () => ({
    userId: 'u1',
    firmSlug: 'firm-slug',
  }));

  const welcomeEmail = require('../src/services/email/sendWelcomeEmail');
  welcomeEmail.sendWelcomeEmail = overrides.sendWelcomeEmailImpl || (async () => {});

  const xIDGenerator = require('../src/services/xIDGenerator');
  xIDGenerator.generateNextXID = overrides.generateNextXIDImpl || (async () => 'X000321');

  const { google } = require('googleapis');
  const originalVerify = google.auth.OAuth2.prototype.verifyIdToken;
  google.auth.OAuth2.prototype.verifyIdToken = overrides.verifyIdTokenImpl || (async () => ({
    getPayload: () => ({ email: 'google@example.com', name: 'Google User', sub: 'google-sub' }),
  }));

  process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz123456';
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
  process.env.DISABLE_GOOGLE_AUTH = 'true';
  process.env.ENCRYPTION_PROVIDER = 'disabled';
  process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuu0Lz3M0RtZpmjHtkobaN6D2PfYZ7RUTy';
  process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
  process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
  process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';

  const controller = require('../src/controllers/auth.controller');
  return {
    controller,
    restoreGoogle: () => {
      google.auth.OAuth2.prototype.verifyIdToken = originalVerify;
    },
  };
}

function bootstrapUserController(overrides = {}) {
  [
    userControllerPath,
    jwtServicePath,
    emailServicePath,
  ].forEach(clear);

  const mongoose = require('mongoose');
  mongoose.startSession = async () => ({
    async withTransaction(fn) { await fn(); },
    async endSession() {},
  });

  const User = require('../src/models/User.model');
  User.findById = overrides.userFindByIdImpl;

  const queryStub = {
    sort() { return this; },
    select() { return this; },
    session: async () => null,
  };

  const Firm = require('../src/models/Firm.model');
  Firm.findOne = overrides.firmFindOneImpl || (() => queryStub);
  Firm.create = overrides.firmCreateImpl || (async () => [{ _id: 'firm-1', firmSlug: 'firm-slug-1' }]);

  const jwtService = require('../src/services/jwt.service');
  jwtService.generateAccessToken = () => 'profile-token';

  const welcomeEmail = require('../src/services/email/sendWelcomeEmail');
  welcomeEmail.sendWelcomeEmail = overrides.sendWelcomeEmailImpl || (async () => {});

  return require('../src/controllers/user.controller');
}

async function testEmailSignupSendsWelcomeAfterOnboarding() {
  let welcomeSent = false;

  const createdUser = {
    _id: 'u1',
    xID: 'X000001',
    xid: 'DK-EML01',
    primary_email: 'email@example.com',
    email: 'email@example.com',
    isOnboarded: true,
    firmId: 'firm-1',
    role: 'Admin',
  };

  const { controller, restoreGoogle } = bootstrapAuthController({
    userFindOneImpl: async () => null,
    userFindByIdImpl: () => ({ session: async () => createdUser }),
    sendWelcomeEmailImpl: async () => { welcomeSent = true; },
    verifyOtpImpl: async () => ({ ok: true }),
  });

  const { res, state } = createRes();
  await controller.signupWithEmail({
    body: {
      email: 'email@example.com',
      password: 'Pass#123456',
      firmName: 'Email Firm',
      otp: '123456',
    },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    get: () => 'test-agent',
  }, res);
  restoreGoogle();

  assert.strictEqual(state.statusCode, 201);
  assert.strictEqual(state.body.success, true);
  assert.strictEqual(welcomeSent, true);
}

async function testGoogleLoginLinksExistingEmailAndNoDuplicate() {
  let userCreateCalled = false;
  let identityCreateCalled = false;

  const { controller, restoreGoogle } = bootstrapAuthController({
    userFindOneImpl: async () => ({
      _id: 'u1',
      xid: 'DK-EXIST',
      xID: 'X000111',
      primary_email: 'existing@example.com',
      email: 'existing@example.com',
      isOnboarded: true,
      role: 'Employee',
      save: async () => {},
    }),
    userCreateImpl: async () => { userCreateCalled = true; return []; },
    authIdentityFindOneImpl: async () => null,
    authIdentityCreateImpl: async () => { identityCreateCalled = true; return { _id: 'identity' }; },
    verifyIdTokenImpl: async () => ({
      getPayload: () => ({ email: 'existing@example.com', name: 'Existing User', sub: 'google-existing' }),
    }),
  });

  const { res, state } = createRes();
  await controller.googleTokenLogin({ body: { idToken: 'id-token' }, ip: '127.0.0.1', get: () => 'agent' }, res);
  restoreGoogle();

  assert.strictEqual(state.statusCode, 200);
  assert.strictEqual(state.body.success, true);
  assert.strictEqual(identityCreateCalled, true);
  assert.strictEqual(userCreateCalled, false);
}

async function testGoogleLoginNewUserRequiresOnboardingAndNo409() {
  let welcomeCount = 0;
  let userCreateArgs = null;

  const createdUser = {
    _id: 'u-new',
    xID: 'X000321',
    xid: 'DK-NEW01',
    primary_email: 'new-google@example.com',
    email: 'new-google@example.com',
    isOnboarded: false,
    role: 'Employee',
    save: async () => {},
  };

  let findCount = 0;
  const { controller, restoreGoogle } = bootstrapAuthController({
    userFindOneImpl: async () => {
      findCount += 1;
      return findCount === 1 ? null : createdUser;
    },
    userCreateImpl: async (docs) => {
      userCreateArgs = docs[0];
      return [createdUser];
    },
    authIdentityFindOneImpl: async () => null,
    authIdentityCreateImpl: async () => ({ _id: 'identity-new' }),
    sendWelcomeEmailImpl: async () => { welcomeCount += 1; },
    verifyIdTokenImpl: async () => ({
      getPayload: () => ({ email: 'new-google@example.com', name: 'New Google', sub: 'google-new-sub' }),
    }),
  });

  const { res, state } = createRes();
  await controller.googleTokenLogin({ body: { idToken: 'id-token' }, ip: '127.0.0.1', get: () => 'agent' }, res);
  restoreGoogle();

  assert.strictEqual(state.statusCode, 200, 'google login should not return 409');
  assert.strictEqual(state.body.success, true);
  assert.strictEqual(state.body.data.isOnboarded, false);
  assert.strictEqual(userCreateArgs.passwordHash, null);
  assert.strictEqual(userCreateArgs.isOnboarded, false);
  assert.strictEqual(welcomeCount, 0, 'google login must not send welcome email');
}

async function testCompleteProfileSendsWelcomeOnFalseToTrueTransition() {
  let welcomeSent = false;
  const user = {
    _id: 'u-google',
    name: 'Google New',
    primary_email: 'google-new@example.com',
    email: 'google-new@example.com',
    xid: 'DK-CP001',
    isOnboarded: false,
    firmId: null,
    save: async () => {},
  };

  const controller = bootstrapUserController({
    userFindByIdImpl: () => ({ session: async () => user }),
    sendWelcomeEmailImpl: async () => { welcomeSent = true; },
    firmCreateImpl: async () => [{ _id: 'firm-42', firmSlug: 'new-firm' }],
  });

  const { res, state } = createRes();
  await controller.completeProfile({
    user: { _id: 'u-google' },
    body: { name: 'Google New', firmName: 'New Firm', phoneNumber: '+1 555 555 5555' },
  }, res);

  assert.strictEqual(state.statusCode, 200);
  assert.strictEqual(state.body.success, true);
  assert.strictEqual(state.body.data.isOnboarded, true);
  assert.strictEqual(welcomeSent, true);
}

async function run() {
  try {
    await testEmailSignupSendsWelcomeAfterOnboarding();
    await testGoogleLoginLinksExistingEmailAndNoDuplicate();
    await testGoogleLoginNewUserRequiresOnboardingAndNo409();
    await testCompleteProfileSendsWelcomeOnFalseToTrueTransition();
    console.log('authOnboardingParity tests passed');
  } catch (error) {
    console.error('authOnboardingParity tests failed:', error);
    process.exit(1);
  } finally {
    [
      authControllerPath,
      userControllerPath,
      otpServicePath,
      jwtServicePath,
      userModelPath,
      authIdentityPath,
      refreshTokenPath,
      firmModelPath,
      signupServicePath,
      emailServicePath,
      xIdGeneratorPath,
      googleapisPath,
      mongoosePath,
    ].forEach(clear);
  }
}

run();
