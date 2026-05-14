#!/usr/bin/env node
const assert = require('assert');
const supertest = require('supertest');

const setStartupEnvDefaults = () => {
  process.env.NODE_ENV = 'production';
  process.env.PORT = process.env.PORT || '0';
  process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef';
  process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
  process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
  process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
  process.env.ENCRYPTION_PROVIDER = process.env.ENCRYPTION_PROVIDER || 'disabled';
  process.env.MAIL_FROM = process.env.MAIL_FROM || 'no-reply@example.com';
  process.env.BREVO_API_KEY = process.env.BREVO_API_KEY || 'ci-placeholder-brevo-key';
  process.env.REDIS_URL = '';
  process.env.ALLOW_REDIS_FALLBACK = 'true';
};


const mockBcrypt = () => {
  const bcryptPath = require.resolve('bcrypt');
  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: {
      hash: async () => 'mock-hash',
      hashSync: () => 'mock-hash',
      compare: async () => true,
      compareSync: () => true,
      genSalt: async () => 'mock-salt',
      genSaltSync: () => 'mock-salt',
    },
  };
};

const mockAuthController = () => {
  const authControllerPath = require.resolve('../src/controllers/auth.controller.js');
  const noOpHandler = (req, res) => res.status(501).json({ success: false, message: 'mocked in smoke test' });
  require.cache[authControllerPath] = {
    id: authControllerPath,
    filename: authControllerPath,
    loaded: true,
    exports: new Proxy({}, { get: () => noOpHandler }),
  };
};

const withModuleStub = (modulePath, exportsValue) => {
  const resolvedPath = require.resolve(modulePath);
  const original = require.cache[resolvedPath];
  require.cache[resolvedPath] = { id: resolvedPath, filename: resolvedPath, loaded: true, exports: exportsValue };
  return () => {
    if (original) require.cache[resolvedPath] = original;
    else delete require.cache[resolvedPath];
  };
};

async function run() {
  setStartupEnvDefaults();
  mockBcrypt();
  mockAuthController();

  const restoreDb = withModuleStub('../src/config/database', async () => {});
  const restoreBootstrap = withModuleStub('../src/services/bootstrap.service', { runBootstrap: async () => {} });
  const restoreSocket = withModuleStub('../src/services/notificationSocket.service', { initNotificationSocket: () => {} });
  const restoreRedis = withModuleStub('../src/config/redis', {
    getRedisClient: () => null,
    isRedisReady: () => false,
    isRedisUrlConfigured: () => false,
  });

  const { createApp } = require('../src/app/createApp');
  assert.strictEqual(typeof createApp, 'function', 'createApp export should be a function');

  const app = createApp();
  assert.ok(app, 'createApp should return an Express app instance');

  const healthResponse = await supertest(app).get('/health');
  assert.strictEqual(healthResponse.status, 200, 'GET /health must be registered');
  assert.strictEqual(healthResponse.body.status, 'ok', 'health endpoint must return status ok');

  const http = require('http');
  const originalListen = http.Server.prototype.listen;
  http.Server.prototype.listen = function patchedListen(...args) {
    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    return originalListen.call(this, 0, '127.0.0.1', callback);
  };

  const { startServer } = require('../src/runtime/startServer');
  const { server } = await startServer();
  await new Promise((resolve) => server.close(resolve));
  http.Server.prototype.listen = originalListen;

  restoreRedis();
  restoreSocket();
  restoreBootstrap();
  restoreDb();

  console.log('✅ backend runtime entrypoint smoke tests passed');
}

run().catch((error) => {
  console.error('❌ backend runtime entrypoint smoke tests failed');
  console.error(error);
  process.exit(1);
});
