#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createAuthLoginService = require('../src/services/authLogin.service');

const createRes = (cookieJar = {}) => ({
  state: { statusCode: 200, body: null, setCookies: [] },
  status(code) { this.state.statusCode = code; return this; },
  json(payload) { this.state.body = payload; return this; },
  cookie(name, value, options = {}) { this.state.setCookies.push({ name, value, options }); cookieJar[name] = value; return this; },
  clearCookie() { return this; },
  setHeader() {},
});

async function tenantLoginOtpSmoke() {
  const user = {
    _id: 'user-1', firmId: 'firm-1', xID: 'X111111', email: 'alpha@example.com',
    status: 'active', isActive: true, loginOtpHash: 'hash:123456', loginOtpExpiresAt: new Date(Date.now() + 60_000),
    loginOtpAttempts: 0, save: async function save() { return this; },
  };
  const loginSession = { _id: 'ls-1', userId: 'user-1', firmId: 'firm-1', tokenHash: 'hash:login-token', expiresAt: new Date(Date.now() + 60_000), consumedAt: null };

  const service = createAuthLoginService({
    models: {
      User: { findOne: async (query) => (query._id || query.xID ? user : null) },
      LoginSession: {
        findOne: async ({ tokenHash }) => (tokenHash === 'hash:login-token' ? loginSession : null),
        updateOne: async () => ({}),
      },
    },
    utils: {
      getSuperadminEnv: () => ({ normalizedXID: null }), handleSuperadminLogin: async () => {},
      validateTenantUserPreconditions: async () => false, handlePasswordVerification: async () => true,
      handlePostPasswordChecks: async () => false, sendLoginOtpChallenge: async () => 'login-token',
      getLoginOtpConfig: () => ({ maxAttempts: 5, lockMinutes: 1, resendCooldownSeconds: 0 }), LOGIN_OTP_COOLDOWN_SECONDS: 0,
      hashLoginSessionToken: (v) => `hash:${v}`,
      clearExpiredLoginOtpLock: async () => {}, getLoginOtpLockSeconds: () => 0, logLoginOtpEvent: () => {},
      clearLoginOtpState: (u) => { u.loginOtpHash = null; }, persistLoginOtpState: async () => {}, logAuthAudit: async () => {},
      DEFAULT_XID: 'X111111', DEFAULT_FIRM_ID: 'firm-1', noteLoginFailure: async () => {}, clearCachedLoginOtpState: async () => {},
      normalizeFirmSlug: (v) => v,
      buildSuccessfulLoginPayload: async () => ({ success: true, accessToken: 'access-1', refreshToken: 'refresh-1', data: { firmSlug: 'acme', firmId: 'firm-1', role: 'Admin', defaultClientId: 'C000001' } }),
      setAuthCookies: (res, payload) => { res.cookie('accessToken', payload.accessToken, { httpOnly: true }); res.cookie('refreshToken', payload.refreshToken, { httpOnly: true }); },
    },
    services: {
      authOtpService: {
        verifyOtp: async (otp, hash) => hash === `hash:${otp}`,
        incrementAttempts: (attempts, max) => ({ attempts: attempts + 1, exhausted: attempts + 1 >= max }),
      },
    },
  });

  const initRes = createRes();
  await service.login({ body: { xID: 'X111111', password: 'Strong#1234' }, firmId: 'firm-1', firmSlug: 'acme', ip: '127.0.0.1', get: () => 'ua' }, initRes);
  assert.strictEqual(initRes.state.statusCode, 200);
  assert.strictEqual(initRes.state.body.otpRequired, true);
  assert.strictEqual(initRes.state.body.loginToken, 'login-token');

  const jar = {};
  const verifyRes = createRes(jar);
  await service.verifyLoginOtp({ body: { loginToken: 'login-token', otp: '123456' }, firmId: 'firm-1', firmSlug: 'acme', ip: '127.0.0.1', get: () => 'ua' }, verifyRes);
  assert.strictEqual(verifyRes.state.statusCode, 200);
  assert(jar.accessToken && jar.refreshToken, 'expected auth cookies to be set after OTP verification');
}

async function run() {
  await tenantLoginOtpSmoke();
  console.log('authE2ESmoke.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
