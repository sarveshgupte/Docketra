const assert = require('assert');

// Stub bcrypt before auth controller import to avoid native binding dependency in this environment.
const bcryptPath = require.resolve('bcrypt');
require.cache[bcryptPath] = {
  id: bcryptPath,
  filename: bcryptPath,
  loaded: true,
  exports: {
    compare: async (candidate, stored) => candidate === stored,
    hash: async (value) => value,
  },
};

const RefreshToken = require('../src/models/RefreshToken.model');
const jwtService = require('../src/services/jwt.service');
const { login, getProfile, refreshAccessToken, logout } = require('../src/controllers/auth.controller');

function createRes(cookieJar) {
  const state = { statusCode: 200, body: null, setCookies: [], clearedCookies: [] };
  return {
    state,
    status(code) { state.statusCode = code; return this; },
    json(payload) { state.body = payload; return this; },
    cookie(name, value, options = {}) { state.setCookies.push({ name, value, options }); cookieJar[name] = value; return this; },
    clearCookie(name, options = {}) { state.clearedCookies.push({ name, options }); delete cookieJar[name]; return this; },
  };
}

async function run() {
  process.env.JWT_SECRET = 'test-secret';
  process.env.SUPERADMIN_XID = 'SATEST';
  process.env.SUPERADMIN_EMAIL = 'sa@test.com';
  process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
  process.env.SUPERADMIN_PASSWORD_HASH = 'S@fePassw0rd!';

  const refreshStore = new Map();
  const originalCreate = RefreshToken.create;
  const originalFindOne = RefreshToken.findOne;
  const originalUpdateMany = RefreshToken.updateMany;

  RefreshToken.create = async ([doc]) => {
    refreshStore.set(doc.tokenHash, { ...doc, isRevoked: false, save: async function save() { refreshStore.set(doc.tokenHash, this); } });
    return [doc];
  };
  RefreshToken.findOne = async ({ tokenHash }) => refreshStore.get(tokenHash) || null;
  RefreshToken.updateMany = async () => ({ modifiedCount: 0 });

  try {
    const cookieJar = {};

    const loginReq = {
      body: { xID: 'SATEST', password: 'S@fePassw0rd!' },
      ip: '127.0.0.1',
      get: () => 'test-agent',
      loginScope: 'superadmin',
    };
    const loginRes = createRes(cookieJar);
    await login(loginReq, loginRes);

    assert.strictEqual(loginRes.state.statusCode, 200);
    assert.strictEqual(loginRes.state.body.success, true);
    assert(cookieJar.accessToken, 'accessToken cookie expected');
    assert(cookieJar.refreshToken, 'refreshToken cookie expected');
    const accessCookie = loginRes.state.setCookies.find((c) => c.name === 'accessToken');
    const refreshCookie = loginRes.state.setCookies.find((c) => c.name === 'refreshToken');
    assert.strictEqual(accessCookie.options.httpOnly, true);
    assert.strictEqual(refreshCookie.options.httpOnly, true);
    assert.strictEqual(accessCookie.options.path, '/');
    assert.strictEqual(refreshCookie.options.path, '/');

    const decoded = jwtService.verifyAccessToken(cookieJar.accessToken);
    assert.strictEqual(decoded.userId, process.env.SUPERADMIN_OBJECT_ID);
    assert.strictEqual(decoded.role, 'SUPERADMIN');
    assert.strictEqual(decoded.firmId, null);
    assert.strictEqual(decoded.firmSlug, null);
    assert.strictEqual(decoded.defaultClientId, null);
    assert.strictEqual(decoded.isSuperAdmin, true);

    const profileReq = { user: { role: 'SUPERADMIN' }, jwt: decoded, ip: '127.0.0.1', get: () => 'test-agent' };
    const profileRes = createRes(cookieJar);
    await getProfile(profileReq, profileRes);
    assert.strictEqual(profileRes.state.statusCode, 200);
    assert.strictEqual(profileRes.state.body.success, true);
    assert.strictEqual(profileRes.state.body.data.firmId, null);
    assert.strictEqual(profileRes.state.body.data.firmSlug, null);

    const refreshReq = {
      cookies: { refreshToken: cookieJar.refreshToken },
      headers: { cookie: `refreshToken=${cookieJar.refreshToken}` },
      ip: '127.0.0.1',
      get: () => 'test-agent',
      originalUrl: '/api/auth/refresh',
    };
    const refreshRes = createRes(cookieJar);
    await refreshAccessToken(refreshReq, refreshRes);
    assert.strictEqual(refreshRes.state.statusCode, 200);
    assert.strictEqual(refreshRes.state.body.success, true);
    assert(refreshRes.state.setCookies.some((c) => c.name === 'accessToken'));
    assert(refreshRes.state.setCookies.some((c) => c.name === 'refreshToken'));

    const logoutReq = { req: { user: { role: 'SUPERADMIN' }, ip: '127.0.0.1', get: () => 'test-agent' } };
    const logoutRes = createRes(cookieJar);
    await logout(logoutReq.req, logoutRes);
    assert.strictEqual(logoutRes.state.statusCode, 200);
    assert(logoutRes.state.clearedCookies.some((c) => c.name === 'accessToken'));
    assert(logoutRes.state.clearedCookies.some((c) => c.name === 'refreshToken'));

    console.log('superadminSessionParity.test.js passed');
  } finally {
    RefreshToken.create = originalCreate;
    RefreshToken.findOne = originalFindOne;
    RefreshToken.updateMany = originalUpdateMany;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
