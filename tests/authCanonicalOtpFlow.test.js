const assert = require('assert');
const bcrypt = require('bcrypt');

const controllerPath = require.resolve('../src/controllers/auth.controller');
const otpServicePath = require.resolve('../src/services/otp.service');
const jwtServicePath = require.resolve('../src/services/jwt.service');
const userModelPath = require.resolve('../src/models/User.model');
const authIdentityPath = require.resolve('../src/models/AuthIdentity.model');
const refreshTokenPath = require.resolve('../src/models/RefreshToken.model');
const googleapisPath = require.resolve('googleapis');

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

function bootstrapController({ sendOtpImpl, verifyOtpImpl, verifyIdTokenImpl, userFindOneImpl, userCreateImpl, authIdentityFindOneImpl, authIdentityCreateImpl }) {
  clear(controllerPath);
  clear(otpServicePath);

  const otpService = require('../src/services/otp.service');
  otpService.sendOtp = sendOtpImpl;
  otpService.verifyOtp = verifyOtpImpl;

  const jwtService = require('../src/services/jwt.service');
  jwtService.generateAccessToken = () => 'access-token';
  jwtService.generateRefreshToken = () => 'refresh-token';
  jwtService.hashRefreshToken = () => 'hashed-refresh-token';

  const User = require('../src/models/User.model');
  const AuthIdentity = require('../src/models/AuthIdentity.model');
  const RefreshToken = require('../src/models/RefreshToken.model');

  User.findOne = userFindOneImpl;
  User.exists = async () => false;
  User.create = userCreateImpl || (async () => { throw new Error('User.create should not be called'); });
  User.updateOne = async () => ({ acknowledged: true });

  AuthIdentity.findOne = authIdentityFindOneImpl;
  AuthIdentity.create = authIdentityCreateImpl || (async () => ({ _id: 'identity' }));

  RefreshToken.create = async () => ({ _id: 'refresh' });

  const { google } = require('googleapis');
  const originalVerify = google.auth.OAuth2.prototype.verifyIdToken;
  google.auth.OAuth2.prototype.verifyIdToken = verifyIdTokenImpl;

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

async function testLoginWithoutOtpReturns202() {
  const password = 'Password#123';
  const hash = await bcrypt.hash(password, 10);
  let sendOtpCalled = false;

  const { controller, restoreGoogle } = bootstrapController({
    sendOtpImpl: async () => { sendOtpCalled = true; return {}; },
    verifyOtpImpl: async () => ({}),
    verifyIdTokenImpl: async () => ({ getPayload: () => ({ email: 'g@example.com', sub: 'g-sub' }) }),
    userFindOneImpl: async (query) => {
      if (query.xid === 'DK-ABCDE') {
        return { _id: 'u1', xid: 'DK-ABCDE', primary_email: 'user@example.com', passwordHash: hash, role: 'Employee', firmId: 'firm-1', save: async () => {} };
      }
      return null;
    },
    authIdentityFindOneImpl: async () => ({ password_hash: hash }),
  });

  const { res, state } = createRes();
  await controller.universalLogin({ body: { xid: 'DK-ABCDE', password }, ip: '127.0.0.1', get: () => 'agent' }, res);
  restoreGoogle();

  assert.strictEqual(state.statusCode, 202);
  assert.strictEqual(state.body.success, true);
  assert.strictEqual(state.body.otpRequired, true);
  assert.strictEqual(sendOtpCalled, true);
}

async function testLoginWithWrongOtpFails() {
  const password = 'Password#123';
  const hash = await bcrypt.hash(password, 10);

  const { controller, restoreGoogle } = bootstrapController({
    sendOtpImpl: async () => ({}),
    verifyOtpImpl: async () => { throw new Error('OTP_INVALID'); },
    verifyIdTokenImpl: async () => ({ getPayload: () => ({ email: 'g@example.com', sub: 'g-sub' }) }),
    userFindOneImpl: async () => ({ _id: 'u1', xid: 'DK-ABCDE', primary_email: 'user@example.com', passwordHash: hash, role: 'Employee', firmId: 'firm-1', save: async () => {} }),
    authIdentityFindOneImpl: async () => ({ password_hash: hash }),
  });

  const { res, state } = createRes();
  await controller.universalLogin({ body: { xid: 'DK-ABCDE', password, otp: '000000' }, ip: '127.0.0.1', get: () => 'agent' }, res);
  restoreGoogle();

  assert.strictEqual(state.statusCode, 400);
  assert.strictEqual(state.body.success, false);
}

async function testLoginWithCorrectOtpSucceeds() {
  const password = 'Password#123';
  const hash = await bcrypt.hash(password, 10);

  const { controller, restoreGoogle } = bootstrapController({
    sendOtpImpl: async () => ({}),
    verifyOtpImpl: async () => ({ verificationToken: 'ok' }),
    verifyIdTokenImpl: async () => ({ getPayload: () => ({ email: 'g@example.com', sub: 'g-sub' }) }),
    userFindOneImpl: async () => ({ _id: 'u1', xid: 'DK-ABCDE', primary_email: 'user@example.com', passwordHash: hash, role: 'Employee', firmId: 'firm-1', save: async () => {} }),
    authIdentityFindOneImpl: async () => ({ password_hash: hash }),
  });

  const { res, state } = createRes();
  await controller.universalLogin({ body: { email: 'user@example.com', password, otp: '123456' }, ip: '127.0.0.1', get: () => 'agent' }, res);
  restoreGoogle();

  assert.strictEqual(state.statusCode, 200);
  assert.strictEqual(state.body.success, true);
  assert.strictEqual(state.body.data.accessToken, 'access-token');
  assert.strictEqual(state.body.data.refreshToken, 'refresh-token');
  assert.strictEqual(state.body.data.xid, 'DK-ABCDE');
}

async function testGoogleLoginAndNoDuplicateUsers() {
  let userCreateCalled = false;
  let identityCreateCalled = false;

  const { controller, restoreGoogle } = bootstrapController({
    sendOtpImpl: async () => ({}),
    verifyOtpImpl: async () => ({}),
    verifyIdTokenImpl: async () => ({ getPayload: () => ({ email: 'google@example.com', sub: 'google-sub' }) }),
    userFindOneImpl: async () => ({ _id: 'u1', xid: 'DK-GOOG1', primary_email: 'google@example.com', role: 'Employee', save: async () => {} }),
    userCreateImpl: async () => { userCreateCalled = true; return null; },
    authIdentityFindOneImpl: async () => null,
    authIdentityCreateImpl: async () => { identityCreateCalled = true; return { _id: 'new-identity' }; },
  });

  const { res, state } = createRes();
  await controller.googleTokenLogin({ body: { idToken: 'id-token' }, ip: '127.0.0.1', get: () => 'agent' }, res);
  restoreGoogle();

  assert.strictEqual(state.statusCode, 200);
  assert.strictEqual(state.body.success, true);
  assert.strictEqual(state.body.data.xid, 'DK-GOOG1');
  assert.strictEqual(identityCreateCalled, true, 'google identity should link to existing account');
  assert.strictEqual(userCreateCalled, false, 'existing email must not create duplicate user');
}

async function run() {
  try {
    await testLoginWithoutOtpReturns202();
    await testLoginWithWrongOtpFails();
    await testLoginWithCorrectOtpSucceeds();
    await testGoogleLoginAndNoDuplicateUsers();
    console.log('authCanonicalOtpFlow tests passed');
  } catch (error) {
    console.error('authCanonicalOtpFlow tests failed:', error);
    process.exit(1);
  } finally {
    [controllerPath, otpServicePath, jwtServicePath, userModelPath, authIdentityPath, refreshTokenPath, googleapisPath].forEach(clear);
  }
}

run();
