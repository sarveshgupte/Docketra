const assert = require('assert');
const createAuthLoginService = require('../src/services/authLogin.service');

function createRes() {
  const state = { statusCode: 200, body: null };
  return {
    state,
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return payload;
    },
    setHeader() {},
  };
}

async function run() {
  const loginSession = { _id: 'ls-1', userId: 'u-1', firmId: 'f-1', expiresAt: new Date(Date.now() + 60_000), consumedAt: null };
  const user = {
    _id: 'u-1',
    firmId: 'f-1',
    xID: 'DK-TEST',
    status: 'active',
    isActive: true,
    email: 'x@example.com',
    loginOtpHash: 'hash',
    loginOtpExpiresAt: new Date(Date.now() + 60_000),
    loginOtpAttempts: 0,
  };
  let cookieSet = false;
  let cookiePayload = null;
  const service = createAuthLoginService({
    models: {
      User: { findOne: async () => user },
      LoginSession: {
        findOne: async () => loginSession,
        updateOne: async () => ({}),
      },
    },
    utils: {
      getSuperadminEnv: () => ({ normalizedXID: null }),
      handleSuperadminLogin: async () => {},
      validateTenantUserPreconditions: async () => false,
      handlePasswordVerification: async () => true,
      handlePostPasswordChecks: async () => false,
      sendLoginOtpChallenge: async () => 'lt',
      getLoginOtpConfig: () => ({ maxAttempts: 5, lockMinutes: 1 }),
      LOGIN_OTP_COOLDOWN_SECONDS: 30,
      hashLoginSessionToken: () => 'hash-ls',
      clearExpiredLoginOtpLock: async () => {},
      getLoginOtpLockSeconds: () => 0,
      logLoginOtpEvent: () => {},
      clearLoginOtpState: (u) => { u.loginOtpHash = null; },
      persistLoginOtpState: async () => {},
      logAuthAudit: async () => {},
      DEFAULT_XID: 'DK-TEST',
      DEFAULT_FIRM_ID: 'f-1',
      noteLoginFailure: async () => {},
      clearCachedLoginOtpState: async () => {},
      normalizeFirmSlug: (v) => v,
      buildSuccessfulLoginPayload: async () => ({
        success: true,
        accessToken: 'access',
        refreshToken: 'refresh',
        data: { role: 'admin' },
      }),
      setAuthCookies: (_res, payload) => { cookieSet = true; cookiePayload = payload; },
    },
    services: {
      authOtpService: {
        verifyOtp: async () => true,
      },
    },
  });

  const req = { body: { otp: '123456', loginToken: 'token' }, firmId: 'f-1', firmSlug: 'firm-a', ip: '127.0.0.1', get: () => 'ua' };
  const res = createRes();
  await service.verifyLoginOtp(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(cookieSet, true);
  assert.strictEqual(cookiePayload?.accessToken, 'access');
  assert.strictEqual(cookiePayload?.refreshToken, 'refresh');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(res.state.body, 'accessToken'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(res.state.body, 'refreshToken'), false);
  console.log('authLoginCookieFlow.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
