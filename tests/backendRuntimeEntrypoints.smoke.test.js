#!/usr/bin/env node
const assert = require('assert');
const supertest = require('supertest');

const setTestEnvDefaults = () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef';
  process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$replace_this_with_a_real_bcrypt_hash_before_deploying';
  process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
  process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
  process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
  process.env.ENCRYPTION_PROVIDER = process.env.ENCRYPTION_PROVIDER || 'disabled';
  process.env.REDIS_URL = '';
};

const mockBcrypt = () => {
  const bcryptPath = require.resolve('bcrypt');
  if (!require.cache[bcryptPath]) {
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
  }
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

const mockRedisConfig = () => {
  const redisConfigPath = require.resolve('../src/config/redis.js');
  require.cache[redisConfigPath] = {
    id: redisConfigPath,
    filename: redisConfigPath,
    loaded: true,
    exports: {
      getRedisClient: () => null,
      closeRedis: async () => {},
    },
  };
};

async function run() {
  setTestEnvDefaults();
  mockBcrypt();
  mockAuthController();
  mockRedisConfig();

  const http = require('http');
  const originalListen = http.Server.prototype.listen;
  let listenCalls = 0;
  let passed = false;
  http.Server.prototype.listen = function patchedListen(...args) {
    listenCalls += 1;
    return originalListen.apply(this, args);
  };

  try {
    const callsBeforeImport = listenCalls;
    const { createApp } = require('../src/app/createApp');

    assert.strictEqual(typeof createApp, 'function', 'createApp export should be a function');

    const app = createApp();
    assert.ok(app, 'createApp should return an Express app instance');

    assert.strictEqual(listenCalls, callsBeforeImport, 'importing/creating app must not start an HTTP listener');

    const healthResponse = await supertest(app).get('/health');
    assert.strictEqual(healthResponse.status, 200, 'GET /health must be registered');
    assert.strictEqual(healthResponse.body.status, 'ok', 'health endpoint must return status ok');

    const unknownResponse = await supertest(app).get('/__does_not_exist__');
    assert.strictEqual(unknownResponse.status, 404, 'unknown routes must return 404');
    assert.strictEqual(unknownResponse.body.code, 'NOT_FOUND', 'unknown route response code should stay NOT_FOUND');

    console.log('✅ backend runtime entrypoint smoke tests passed');
    passed = true;
  } finally {
    http.Server.prototype.listen = originalListen;
    if (passed) {
      process.exit(0);
    }
  }
}

run().catch((error) => {
  console.error('❌ backend runtime entrypoint smoke tests failed');
  console.error(error);
  process.exit(1);
});
