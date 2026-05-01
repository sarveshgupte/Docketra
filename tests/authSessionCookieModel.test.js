const assert = require('assert');
const createAuthSessionService = require('../src/services/authSession.service');

const createRes = () => {
  const state = { cookies: [], cleared: [], statusCode: 200, body: null };
  return {
    state,
    cookie: (name, value, options) => state.cookies.push({ name, value, options }),
    clearCookie: (name, options) => state.cleared.push({ name, options }),
    status: (code) => {
      state.statusCode = code;
      return {
        json: (body) => {
          state.body = body;
          return body;
        },
      };
    },
    json: (body) => {
      state.body = body;
      return body;
    },
  };
};

async function run() {
  let refreshCounter = 0;
  const refreshStore = new Map();
  const RefreshToken = {
    create: async ([doc]) => {
      refreshStore.set(doc.tokenHash, { ...doc, isRevoked: false, save: async function save() { refreshStore.set(doc.tokenHash, this); } });
      return [{ _id: 'id-1' }];
    },
    findOne: async ({ tokenHash }) => refreshStore.get(tokenHash) || null,
    updateMany: async () => ({ modifiedCount: 1 }),
  };
  const User = {
    findOne: async () => ({
      _id: 'user-1',
      xID: 'DK-USER',
      role: 'admin',
      status: 'active',
      firmId: 'firm-1',
      defaultClientId: 'client-1',
    }),
  };
  const jwtService = {
    generateRefreshToken: () => `refresh-raw-${++refreshCounter}`,
    hashRefreshToken: (v) => `hash:${v}`,
    getRefreshTokenExpiry: () => new Date(Date.now() + 60_000),
    getRefreshTokenExpiryMs: () => 60_000,
    generateAccessToken: () => 'access-raw',
  };
  const service = createAuthSessionService({
    models: { RefreshToken, User },
    services: { jwtService },
    utils: {
      isActiveStatus: () => true,
      noteRefreshTokenFailure: async () => {},
      noteRefreshTokenUse: async () => {},
      logAuthAudit: async () => {},
      getFirmSlug: async () => 'firm-a',
      isSuperAdminRole: () => false,
      DEFAULT_FIRM_ID: 'firm-1',
      getSession: () => null,
    },
  });

  const reqBase = { ip: '127.0.0.1', get: () => 'test-agent', cookies: {} };

  const missingRes = createRes();
  await service.refreshAccessToken({ ...reqBase, body: { refreshToken: 'refresh-raw' } }, missingRes);
  assert.strictEqual(missingRes.state.statusCode, 401);

  const tenantToken = await service.generateAndStoreRefreshToken({ req: reqBase, userId: 'user-1', firmId: 'firm-1' });
  const superadminToken = await service.generateAndStoreRefreshToken({ req: reqBase, userId: null, firmId: null, scope: 'superadmin' });
  assert.strictEqual(refreshStore.get(`hash:${tenantToken.refreshToken}`)?.scope, 'tenant');
  assert.strictEqual(refreshStore.get(`hash:${superadminToken.refreshToken}`)?.scope, 'superadmin');
  const refreshRes = createRes();
  await service.refreshAccessToken({ ...reqBase, cookies: { refreshToken: tenantToken.refreshToken } }, refreshRes);
  assert.strictEqual(refreshRes.state.statusCode, 200);
  assert.strictEqual(refreshRes.state.body.success, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(refreshRes.state.body, 'refreshToken'), false);
  assert.strictEqual(refreshRes.state.cookies.some((c) => c.name === 'refreshToken'), true);

  refreshStore.set('hash:expired', {
    tokenHash: 'hash:expired',
    userId: 'user-1',
    firmId: 'firm-1',
    isRevoked: false,
    expiresAt: new Date(Date.now() - 1_000),
  });
  const expiredRes = createRes();
  await service.refreshAccessToken({ ...reqBase, cookies: { refreshToken: 'expired' } }, expiredRes);
  assert.strictEqual(expiredRes.state.statusCode, 401);

  await assert.rejects(
    () => service.generateAndStoreRefreshToken({ req: reqBase, userId: 'user-1', firmId: null }),
    /tenant scope requires both userId and firmId/
  );
  await assert.rejects(
    () => service.generateAndStoreRefreshToken({ req: reqBase, userId: null, firmId: null }),
    /Unable to determine token scope/
  );

  const logoutResult = await service.logout({ req: { ...reqBase, user: { _id: 'user-1', xID: 'DK-USER', firmId: 'firm-1', role: 'admin' } } });
  assert.strictEqual(logoutResult.statusCode, 200);
  assert.strictEqual(logoutResult.clearCookies.length, 2);

  console.log('authSessionCookieModel.test.js passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
