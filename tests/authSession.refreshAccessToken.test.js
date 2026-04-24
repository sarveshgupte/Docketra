#!/usr/bin/env node
const assert = require('assert');
const createAuthSessionService = require('../src/services/authSession.service');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    cookies: [],
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    },
  };
}

function buildService(overrides = {}) {
  const storedToken = overrides.storedToken || null;
  const user = overrides.user || null;
  const disconnectSocketCalls = [];
  const RefreshToken = {
    create: async () => {},
    findOne: async () => storedToken,
    updateMany: async () => ({ modifiedCount: 1 }),
  };
  const User = {
    findOne: async () => user,
  };

  const service = createAuthSessionService({
    models: { RefreshToken, User },
    utils: {
      isActiveStatus: () => true,
      noteRefreshTokenFailure: async () => {},
      noteRefreshTokenUse: async () => {},
      logAuthAudit: async () => {},
      getFirmSlug: async () => 'firm-a',
      disconnectSocketsForUser: (payload) => disconnectSocketCalls.push(payload),
      isSuperAdminRole: () => false,
      DEFAULT_FIRM_ID: 'default-firm',
      getSession: () => null,
    },
    services: {
      jwtService: {
        generateRefreshToken: () => 'new-refresh-token',
        hashRefreshToken: (token) => `hash:${token}`,
        getRefreshTokenExpiry: () => new Date(Date.now() + 60_000),
        getRefreshTokenExpiryMs: () => 60_000,
        generateAccessToken: () => 'new-access-token',
      },
    },
  });
  return { service, disconnectSocketCalls };
}

async function testMissingCookie() {
  const { service } = buildService();
  const res = createRes();
  await service.refreshAccessToken({ headers: {}, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.message, 'Authentication required');
  assert.strictEqual(res.payload?.reasonCode, 'missing_refresh_token');
  assert.ok(res.clearedCookies.some((cookie) => cookie.name === 'refreshToken'));
}

async function testInvalidToken() {
  const { service } = buildService();
  const res = createRes();
  await service.refreshAccessToken({ headers: { cookie: 'refreshToken=bad' }, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.message, 'Invalid or expired refresh token');
  assert.ok(res.clearedCookies.some((cookie) => cookie.name === 'refreshToken'));
}

async function testRevokedToken() {
  const storedToken = {
    expiresAt: new Date(Date.now() + 60_000),
    isRevoked: true,
    userId: 'user-1',
    firmId: 'firm-1',
    save: async () => {},
  };
  const { service } = buildService({ storedToken });
  const res = createRes();
  await service.refreshAccessToken({ headers: { cookie: 'refreshToken=revoked' }, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.message, 'Invalid or expired refresh token');
  assert.ok(res.clearedCookies.some((cookie) => cookie.name === 'refreshToken'));
}

async function testValidToken() {
  const storedToken = {
    expiresAt: new Date(Date.now() + 60_000),
    isRevoked: false,
    userId: 'user-1',
    firmId: 'firm-1',
    ipAddress: '127.0.0.1',
    save: async () => {},
  };
  const user = {
    _id: 'user-1',
    firmId: { toString: () => 'firm-1' },
    defaultClientId: { toString: () => 'client-1' },
    role: 'admin',
    xID: 'DK-ABCDE',
    status: 'active',
  };
  const { service } = buildService({ storedToken, user });
  const res = createRes();
  await service.refreshAccessToken({ headers: { cookie: 'refreshToken=token-1' }, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload?.success, true);
  assert.ok(res.cookies.some((cookie) => cookie.name === 'accessToken'));
  assert.ok(res.cookies.some((cookie) => cookie.name === 'refreshToken'));
}


async function testRefreshNotSupportedScope() {
  const storedToken = {
    expiresAt: new Date(Date.now() + 60_000),
    isRevoked: false,
    userId: null,
    firmId: null,
    save: async () => {},
  };
  const { service } = buildService({ storedToken });
  const res = createRes();
  await service.refreshAccessToken({ headers: { cookie: 'refreshToken=token-2' }, cookies: {}, get: () => 'ua', ip: '127.0.0.1', originalUrl: '/api/auth/refresh' }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.reasonCode, 'refresh_not_supported');
  assert.ok(res.clearedCookies.some((cookie) => cookie.name === 'refreshToken'));
}

async function testInactiveUserClearsCookies() {
  const storedToken = {
    expiresAt: new Date(Date.now() + 60_000),
    isRevoked: false,
    userId: 'user-1',
    firmId: 'firm-1',
    save: async () => {},
  };
  const { service } = buildService({ storedToken, user: null });
  const res = createRes();
  await service.refreshAccessToken({ headers: { cookie: 'refreshToken=token-3' }, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.message, 'User not found or inactive');
  assert.ok(res.clearedCookies.some((cookie) => cookie.name === 'refreshToken'));
}

async function testLogoutDisconnectsSockets() {
  const { service, disconnectSocketCalls } = buildService();
  const req = {
    user: {
      _id: 'mongo-user-id',
      xID: 'DK-TEST',
      firmId: 'firm-1',
      role: 'Admin',
    },
    ip: '127.0.0.1',
    get: () => 'ua',
  };
  const response = await service.logout(req);
  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(disconnectSocketCalls.length, 1);
  assert.deepStrictEqual(disconnectSocketCalls[0], {
    firmId: 'firm-1',
    userMongoId: 'mongo-user-id',
    userXid: 'DK-TEST',
  });
}

async function run() {
  await testMissingCookie();
  await testInvalidToken();
  await testRevokedToken();
  await testRefreshNotSupportedScope();
  await testInactiveUserClearsCookies();
  await testValidToken();
  await testLogoutDisconnectsSockets();
  console.log('authSession refreshAccessToken tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
