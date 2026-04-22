#!/usr/bin/env node
const assert = require('assert');
const createAuthSessionService = require('../src/services/authSession.service');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    cookies: [],
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
  };
}

function buildService(overrides = {}) {
  const storedToken = overrides.storedToken || null;
  const user = overrides.user || null;
  const RefreshToken = {
    create: async () => {},
    findOne: async () => storedToken,
  };
  const User = {
    findOne: async () => user,
  };

  return createAuthSessionService({
    models: { RefreshToken, User },
    utils: {
      isActiveStatus: () => true,
      noteRefreshTokenFailure: async () => {},
      noteRefreshTokenUse: async () => {},
      logAuthAudit: async () => {},
      getFirmSlug: async () => 'firm-a',
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
}

async function testMissingCookie() {
  const service = buildService();
  const res = createRes();
  await service.refreshAccessToken({ headers: {}, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.message, 'Authentication required');
}

async function testInvalidToken() {
  const service = buildService();
  const res = createRes();
  await service.refreshAccessToken({ headers: { cookie: 'refreshToken=bad' }, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.payload?.message, 'Invalid or expired refresh token');
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
  const service = buildService({ storedToken, user });
  const res = createRes();
  await service.refreshAccessToken({ headers: { cookie: 'refreshToken=token-1' }, cookies: {}, get: () => 'ua', ip: '127.0.0.1' }, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload?.success, true);
  assert.ok(res.cookies.some((cookie) => cookie.name === 'accessToken'));
  assert.ok(res.cookies.some((cookie) => cookie.name === 'refreshToken'));
}

async function run() {
  await testMissingCookie();
  await testInvalidToken();
  await testValidToken();
  console.log('authSession refreshAccessToken tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
