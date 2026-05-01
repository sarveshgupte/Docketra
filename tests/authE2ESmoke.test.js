#!/usr/bin/env node
'use strict';

const assert = require('assert');
const createAuthLoginService = require('../src/services/authLogin.service');
const createAuthPasswordService = require('../src/services/authPassword.service');
const bcryptPath = require.resolve('bcrypt');
require.cache[bcryptPath] = { id: bcryptPath, filename: bcryptPath, loaded: true, exports: { compare: async (a,b)=>a===b, hash: async (v)=>v } };

const RefreshToken = require('../src/models/RefreshToken.model');
const jwtService = require('../src/services/jwt.service');
const { login, getProfile, refreshAccessToken, logout } = require('../src/controllers/auth.controller');

const createRes = (cookieJar = {}) => ({
  state: { statusCode: 200, body: null, setCookies: [], clearedCookies: [] },
  status(code) { this.state.statusCode = code; return this; },
  json(payload) { this.state.body = payload; return this; },
  cookie(name, value, options = {}) { this.state.setCookies.push({ name, value, options }); cookieJar[name] = value; return this; },
  clearCookie(name, options = {}) { this.state.clearedCookies.push({ name, options }); delete cookieJar[name]; return this; },
  setHeader() {},
});

async function tenantLoginSmoke() {
  let loginInitCalled = false;
  const service = createAuthLoginService({
    models: { User: { findOne: async () => ({}) }, LoginSession: { findOne: async () => ({}), updateOne: async () => ({}) } },
    utils: {
      getSuperadminEnv: () => ({ normalizedXID: null }), handleSuperadminLogin: async () => {},
      validateTenantUserPreconditions: async () => false, handlePasswordVerification: async () => true,
      handlePostPasswordChecks: async () => false, sendLoginOtpChallenge: async () => { loginInitCalled = true; return 'login-token'; },
      getLoginOtpConfig: () => ({ maxAttempts: 5, lockMinutes: 1 }), LOGIN_OTP_COOLDOWN_SECONDS: 10,
      hashLoginSessionToken: () => 'hash', clearExpiredLoginOtpLock: async () => {}, getLoginOtpLockSeconds: () => 0,
      logLoginOtpEvent: () => {}, clearLoginOtpState: () => {}, persistLoginOtpState: async () => {}, logAuthAudit: async () => {},
      DEFAULT_XID: 'X111111', DEFAULT_FIRM_ID: 'firm-a', noteLoginFailure: async () => {}, clearCachedLoginOtpState: async () => {},
      normalizeFirmSlug: (v) => v, buildSuccessfulLoginPayload: async () => ({ success: true, accessToken: 'a1', refreshToken: 'r1', data: { firmSlug: 'firm-a', firmId: 'firm-1', role: 'Admin', defaultClientId: 'C000001' } }),
      setAuthCookies: (res, payload) => { res.cookie('accessToken', payload.accessToken, { httpOnly: true }); res.cookie('refreshToken', payload.refreshToken, { httpOnly: true }); },
    },
    services: { authOtpService: { verifyOtp: async () => true } },
  });

  const initRes = createRes();
  await service.login({ body: { firmSlug: 'firm-a', xID: 'X111111', password: 'pw' }, firmId: 'firm-1', firmSlug: 'firm-a', ip: '127.0.0.1', get: () => 'ua' }, initRes);
  assert.strictEqual(initRes.state.statusCode, 200);
  assert.strictEqual(loginInitCalled, true);
  assert.strictEqual(initRes.state.body.otpRequired, true);

  const cookieJar = {};
  const verifyRes = createRes(cookieJar);
  await service.verifyLoginOtp({ body: { firmSlug: 'firm-a', loginToken: 'login-token', otp: '123456' }, firmId: 'firm-1', firmSlug: 'firm-a', ip: '127.0.0.1', get: () => 'ua' }, verifyRes);
  assert.strictEqual(verifyRes.state.statusCode, 200);
  assert(cookieJar.accessToken && cookieJar.refreshToken);
}

async function superadminSessionSmoke() {
  process.env.JWT_SECRET = 'test-secret';
  process.env.SUPERADMIN_XID = 'SATEST';
  process.env.SUPERADMIN_EMAIL = 'sa@test.com';
  process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
  process.env.SUPERADMIN_PASSWORD_HASH = 'S@fePassw0rd!';
  const bcryptPath = require.resolve('bcrypt');
  require.cache[bcryptPath] = { id: bcryptPath, filename: bcryptPath, loaded: true, exports: { compare: async (a, b) => a === b, hash: async (v) => v } };

  const refreshStore = new Map();
  const originalCreate = RefreshToken.create;
  const originalFindOne = RefreshToken.findOne;
  const originalUpdateMany = RefreshToken.updateMany;
  RefreshToken.create = async ([doc]) => { refreshStore.set(doc.tokenHash, { ...doc, isRevoked: false, save: async function save() { refreshStore.set(doc.tokenHash, this); } }); return [doc]; };
  RefreshToken.findOne = async ({ tokenHash }) => refreshStore.get(tokenHash) || null;
  RefreshToken.updateMany = async () => ({ modifiedCount: 0 });

  try {
    const jar = {};
    const loginRes = createRes(jar);
    await login({ body: { xID: 'SATEST', password: 'S@fePassw0rd!' }, ip: '127.0.0.1', get: () => 'ua', loginScope: 'superadmin' }, loginRes);
    assert.strictEqual(loginRes.state.statusCode, 200);
    const decoded = jwtService.verifyAccessToken(jar.accessToken);

    const profileRes = createRes();
    await getProfile({ user: { role: 'SUPERADMIN' }, jwt: decoded, ip: '127.0.0.1', get: () => 'ua' }, profileRes);
    assert.strictEqual(profileRes.state.body.data.role, 'SUPERADMIN');

    const refreshRes = createRes(jar);
    await refreshAccessToken({ cookies: { refreshToken: jar.refreshToken }, headers: { cookie: `refreshToken=${jar.refreshToken}` }, ip: '127.0.0.1', get: () => 'ua', originalUrl: '/api/auth/refresh' }, refreshRes);
    assert.strictEqual(refreshRes.state.statusCode, 200);

    const logoutRes = createRes(jar);
    await logout({ user: { role: 'SUPERADMIN' }, ip: '127.0.0.1', get: () => 'ua' }, logoutRes);
    assert(logoutRes.state.clearedCookies.some((c) => c.name === 'accessToken'));
  } finally { RefreshToken.create = originalCreate; RefreshToken.findOne = originalFindOne; RefreshToken.updateMany = originalUpdateMany; }
}

async function forgotPasswordSmoke() {
  const run = require('./authForgotPasswordOtpReliability.test.js');
  return run;
}

async function run() {
  await tenantLoginSmoke();
  await superadminSessionSmoke();
  // forgot-password flow + cross-tenant + token reuse + expiry + lock is covered by dedicated reliability suite.
  console.log('authE2ESmoke.test.js passed');
}

run().catch((e) => { console.error(e); process.exit(1); });
