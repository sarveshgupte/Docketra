#!/usr/bin/env node
const assert = require('assert');
const createAuthSessionService = require('../src/services/authSession.service');

function buildService() {
  return createAuthSessionService({
    models: {
      RefreshToken: { create: async () => {}, findOne: async () => null, updateMany: async () => {} },
      User: { findOne: async () => null },
    },
    utils: {
      isActiveStatus: () => true,
      noteRefreshTokenFailure: async () => {},
      noteRefreshTokenUse: async () => {},
      logAuthAudit: async () => {},
      getFirmSlug: async () => null,
      isSuperAdminRole: () => false,
      DEFAULT_FIRM_ID: 'default-firm',
      getSession: () => null,
    },
    services: {
      jwtService: {
        generateRefreshToken: () => 'refresh',
        hashRefreshToken: (v) => v,
        getRefreshTokenExpiry: () => new Date(Date.now() + 60_000),
        getRefreshTokenExpiryMs: () => 60_000,
        generateAccessToken: () => 'access',
      },
    },
  });
}

function run() {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSameSite = process.env.AUTH_COOKIE_SAMESITE;
  const originalDomain = process.env.AUTH_COOKIE_DOMAIN;

  process.env.NODE_ENV = 'production';
  process.env.AUTH_COOKIE_SAMESITE = 'none';
  process.env.AUTH_COOKIE_DOMAIN = '.docketra.example';
  let service = buildService();
  let opts = service.getAuthCookieOptions();
  assert.strictEqual(opts.secure, true);
  assert.strictEqual(opts.sameSite, 'none');
  assert.strictEqual(opts.domain, '.docketra.example');

  process.env.NODE_ENV = 'development';
  process.env.AUTH_COOKIE_SAMESITE = 'none';
  delete process.env.AUTH_COOKIE_DOMAIN;
  service = buildService();
  opts = service.getAuthCookieOptions();
  assert.strictEqual(opts.secure, false);
  assert.strictEqual(opts.sameSite, 'lax');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(opts, 'domain'), false);

  process.env.NODE_ENV = 'production';
  process.env.AUTH_COOKIE_SAMESITE = 'strict';
  service = buildService();
  opts = service.getAuthCookieOptions({ maxAge: 1000 });
  assert.strictEqual(opts.sameSite, 'strict');
  assert.strictEqual(opts.maxAge, 1000);

  if (typeof originalNodeEnv === 'undefined') delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (typeof originalSameSite === 'undefined') delete process.env.AUTH_COOKIE_SAMESITE;
  else process.env.AUTH_COOKIE_SAMESITE = originalSameSite;
  if (typeof originalDomain === 'undefined') delete process.env.AUTH_COOKIE_DOMAIN;
  else process.env.AUTH_COOKIE_DOMAIN = originalDomain;

  console.log('authSession cookie options behavior tests passed');
}

try {
  run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
