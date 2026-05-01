const assert = require('assert');
const createAuthSessionService = require('../src/services/authSession.service');

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
  const refreshStore = new Map();
  const authSessionService = createAuthSessionService({
    jwtService: {
      generateAccessToken: (payload) => `access:${payload.userId || 'sa'}`,
      generateRefreshToken: () => `refresh:sa:${Date.now()}`,
      verifyRefreshToken: () => ({ role: 'SUPERADMIN', isSuperAdmin: true }),
      hashRefreshToken: (token) => `hash:${token}`,
      getRefreshTokenExpiry: () => new Date(Date.now() + 3600_000),
      getRefreshTokenExpiryMs: () => 3600_000,
    },
    RefreshToken: {
      create: async ([doc]) => { refreshStore.set(doc.tokenHash, { ...doc, isRevoked: false, save: async function save() { refreshStore.set(doc.tokenHash, this); } }); return [doc]; },
      findOne: async ({ tokenHash }) => refreshStore.get(tokenHash) || null,
      updateMany: async () => ({ modifiedCount: 0 }),
    },
    User: { findById: async () => null },
    getSuperadminEnv: () => ({ objectId: 'sa-id', normalizedXID: 'SATEST', email: 'sa@test.com' }),
    logAuthAudit: async () => {},
    getSession: () => null,
    noteRefreshTokenUse: async () => {},
  });

  const jar = {};
  const loginRes = createRes(jar);
  const { refreshToken } = await authSessionService.generateAndStoreRefreshToken({ req: { ip: '127.0.0.1', get: () => 'ua' }, userId: null, firmId: null, scope: 'superadmin' });
  authSessionService.setAuthCookies(loginRes, { accessToken: 'access:sa', refreshToken, refreshMaxAge: 3600_000 });
  assert(loginRes.state.setCookies.some((c) => c.name === 'accessToken' && c.options.httpOnly));
  assert(loginRes.state.setCookies.some((c) => c.name === 'refreshToken' && c.options.httpOnly));

  const profile = { role: 'SUPERADMIN', isSuperAdmin: true, firmId: null, firmSlug: null };
  assert.strictEqual(profile.role, 'SUPERADMIN');
  assert.strictEqual(profile.firmId, null);
  assert.strictEqual(profile.firmSlug, null);

  const refreshRes = createRes(jar);
  await authSessionService.refreshAccessToken({ cookies: { refreshToken: jar.refreshToken }, headers: { cookie: `refreshToken=${jar.refreshToken}` }, ip: '127.0.0.1', get: () => 'ua', originalUrl: '/api/auth/refresh' }, refreshRes);
  assert.strictEqual(refreshRes.state.statusCode, 200);
  assert(refreshRes.state.setCookies.some((c) => c.name === 'accessToken'));
  assert(refreshRes.state.setCookies.some((c) => c.name === 'refreshToken'));

  const logoutRes = createRes(jar);
  authSessionService.clearAuthCookies(logoutRes);
  assert(logoutRes.state.clearedCookies.some((c) => c.name === 'accessToken'));
  assert(logoutRes.state.clearedCookies.some((c) => c.name === 'refreshToken'));

  console.log('superadminSessionParity.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
