const assert = require('assert');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-placeholder-for-ci-only';
process.env.JWT_PASSWORD_SETUP_SECRET = 'test-setup-secret-placeholder-for-ci-only';
process.env.SUPERADMIN_XID = 'X000001';
process.env.SUPERADMIN_EMAIL = 'sa@test.com';
process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
process.env.SUPERADMIN_PASSWORD_HASH = '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.REDIS_URL = '';
process.env.ALLOW_REDIS_FALLBACK = 'true';

const bcryptPath = require.resolve('bcrypt');
require.cache[bcryptPath] = { id: bcryptPath, filename: bcryptPath, loaded: true, exports: { compare: async ()=>true, hash: async (v)=>v } };

const auditLogModelPath = require.resolve('../src/models/AuditLog.model');
require.cache[auditLogModelPath] = {
  id: auditLogModelPath,
  filename: auditLogModelPath,
  loaded: true,
  exports: { create: async () => ({}), insertMany: async () => ([]), },
};

const authAuditModelPath = require.resolve('../src/models/AuthAudit.model');
require.cache[authAuditModelPath] = {
  id: authAuditModelPath,
  filename: authAuditModelPath,
  loaded: true,
  exports: {
    create: async () => ({}),
    insertMany: async () => ([]),
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

(async function run() {
  const refreshStore = new Map();
  const originalCreate = RefreshToken.create;
  const originalFindOne = RefreshToken.findOne;
  const originalUpdateMany = RefreshToken.updateMany;
  RefreshToken.create = async ([doc]) => { refreshStore.set(doc.tokenHash, { ...doc, isRevoked: false, save: async function(){ refreshStore.set(doc.tokenHash, this); } }); return [doc]; };
  RefreshToken.findOne = async ({ tokenHash }) => refreshStore.get(tokenHash) || null;
  RefreshToken.updateMany = async () => ({ modifiedCount: 0 });

  try {
    const cookieJar = {};
    const loginRes = createRes(cookieJar);
    await login({ body: { xID: 'X000001', password: 'AnyPass#123' }, ip: '127.0.0.1', get: () => 'test-agent', loginScope: 'superadmin' }, loginRes);
    assert.strictEqual(loginRes.state.statusCode, 200);
    assert(cookieJar.accessToken && cookieJar.refreshToken);

    const decoded = jwtService.verifyAccessToken(cookieJar.accessToken);
    const profileRes = createRes(cookieJar);
    await getProfile({ user: { role: 'SUPERADMIN' }, jwt: decoded, ip: '127.0.0.1', get: () => 'test-agent' }, profileRes);
    assert.strictEqual(profileRes.state.statusCode, 200);

    const refreshRes = createRes(cookieJar);
    await refreshAccessToken({ cookies: { refreshToken: cookieJar.refreshToken }, headers: { cookie: `refreshToken=${cookieJar.refreshToken}` }, ip: '127.0.0.1', get: () => 'test-agent', originalUrl: '/api/auth/refresh' }, refreshRes);
    assert.strictEqual(refreshRes.state.statusCode, 200);

    const logoutRes = createRes(cookieJar);
    await logout({ user: { role: 'SUPERADMIN' }, ip: '127.0.0.1', get: () => 'test-agent' }, logoutRes);
    assert.strictEqual(logoutRes.state.statusCode, 200);
    assert(logoutRes.state.clearedCookies.some((c) => c.name === 'accessToken'));
    assert(logoutRes.state.clearedCookies.some((c) => c.name === 'refreshToken'));

    console.log('superadminPilotSessionSmoke.test.js passed');
  } finally {
    RefreshToken.create = originalCreate;
    RefreshToken.findOne = originalFindOne;
    RefreshToken.updateMany = originalUpdateMany;
  }
})().catch((error) => { console.error(error); process.exit(1); });
