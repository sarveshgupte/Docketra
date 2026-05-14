#!/usr/bin/env node
const assert = require('assert');
const supertest = require('supertest');

const TEST_ENV_OVERRIDES = {
  NODE_ENV: 'production',
  PORT: '3001',
  UPLOAD_SCAN_STRICT: 'true',
  JWT_SECRET: 'ci_fake_jwt_secret_value_for_smoke_test_only_abcdefghijklmnopqrstuvwxyz_1234',
  JWT_PASSWORD_SETUP_SECRET: 'ci_fake_jwt_password_setup_secret_value_for_smoke_test_only_abcdefghijklmnopqrstuvwxyz_1234',
  MASTER_ENCRYPTION_KEY: 'a'.repeat(64),
  STORAGE_TOKEN_SECRET: 'ci_fake_storage_token_secret_for_smoke_test_only_abcdefghijklmnopqrstuvwxyz_12',
  METRICS_TOKEN: 'ci_fake_metrics_token_value_for_smoke_test_only_abcdefghijklmnopqrstuvwxyz_123',
  SUPERADMIN_PASSWORD_HASH: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  SUPERADMIN_XID: 'X000001',
  SUPERADMIN_EMAIL: 'superadmin@example.com',
  SUPERADMIN_OBJECT_ID: '000000000000000000000001',
  MONGO_URI: 'mongodb://127.0.0.1:27017/docketra',
  ENCRYPTION_PROVIDER: 'disabled',
  MAIL_FROM: 'no-reply@example.com',
  BREVO_API_KEY: 'ci-placeholder-brevo-key',
  REDIS_URL: '',
  ALLOW_REDIS_FALLBACK: 'true',
};

const applyTestEnvOverrides = () => {
  const original = new Map();
  for (const [key, value] of Object.entries(TEST_ENV_OVERRIDES)) {
    original.set(key, process.env[key]);
    process.env[key] = value;
  }
  return () => {
    for (const [key, value] of original.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
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
  const restoreEnv = applyTestEnvOverrides();
  mockBcrypt();
  mockAuthController();

  const restorers = [
    withModuleStub('../src/config/database', async () => {}),
    withModuleStub('../src/services/bootstrap.service', { runBootstrap: async () => {} }),
    withModuleStub('../src/services/notificationSocket.service', { initNotificationSocket: () => {} }),
    withModuleStub('../src/config/redis', {
      getRedisClient: () => null,
      isRedisReady: () => false,
      isRedisUrlConfigured: () => false,
    }),
  ];

  const http = require('http');
  const originalListen = http.Server.prototype.listen;
  let startedServer = null;

  try {
    const { createApp } = require('../src/app/createApp');
    assert.strictEqual(typeof createApp, 'function', 'createApp export should be a function');

    const app = createApp();
    assert.ok(app, 'createApp should return an Express app instance');

    const healthResponse = await supertest(app).get('/health');
    assert.strictEqual(healthResponse.status, 200, 'GET /health must be registered');
    assert.strictEqual(healthResponse.body.status, 'ok', 'health endpoint must return status ok');

    const unknownResponse = await supertest(app).get('/__does_not_exist__');
    assert.strictEqual(unknownResponse.status, 404, 'unknown routes must return 404');
    assert.strictEqual(unknownResponse.body.code, 'NOT_FOUND', 'unknown route response code should stay NOT_FOUND');

    http.Server.prototype.listen = function patchedListen(...args) {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
      return originalListen.call(this, 0, '127.0.0.1', callback);
    };

    const { startServer } = require('../src/runtime/startServer');
    const { server } = await startServer();
    startedServer = server;

    console.log('✅ backend runtime entrypoint smoke tests passed');
  } finally {
    http.Server.prototype.listen = originalListen;
    if (startedServer) {
      await new Promise((resolve) => {
        try {
          startedServer.close(() => resolve());
        } catch (_) {
          resolve();
        }
      });
    }
    while (restorers.length) {
      restorers.pop()();
    }
    restoreEnv();
  }
}

run().catch((error) => {
  console.error('❌ backend runtime entrypoint smoke tests failed');
  console.error(error);
  process.exit(1);
});
