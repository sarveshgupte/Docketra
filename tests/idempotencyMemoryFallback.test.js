#!/usr/bin/env node
'use strict';

const assert = require('assert');
const express = require('express');
const request = require('supertest');

const redisConfigPath = require.resolve('../src/config/redis');
const idempotencyPath = require.resolve('../src/middleware/idempotency.middleware');

const waitForFinishHandlers = () => new Promise((resolve) => setImmediate(resolve));

const resetModules = async () => {
  try {
    const redisConfig = require(redisConfigPath);
    if (typeof redisConfig._resetRedisClientForTests === 'function') {
      await redisConfig._resetRedisClientForTests();
    }
  } catch (_) {
    // ignore cache misses during isolated loads
  }
  delete require.cache[idempotencyPath];
  delete require.cache[redisConfigPath];
};

async function testMemoryStoreExpiresEntries() {
  let currentTime = 1000;
  const { MemoryIdempotencyStore } = require('../src/middleware/idempotency.middleware');
  const store = new MemoryIdempotencyStore({ clock: () => currentTime });

  assert.deepStrictEqual(await store.start('idem:test', 1), { status: 'started' });
  assert.deepStrictEqual(await store.start('idem:test', 1), { status: 'in_progress' });
  await store.complete('idem:test', { statusCode: 202, body: { success: true } }, 1);
  assert.deepStrictEqual(await store.start('idem:test', 1), {
    status: 'completed',
    response: { statusCode: 202, body: { success: true } },
  });

  currentTime += 1001;
  assert.deepStrictEqual(await store.start('idem:test', 1), { status: 'started' });
  console.log('PASS in-memory idempotency entries expire and can be reused safely');
}

async function testDevelopmentMissingRedisUsesMemoryFallback() {
  await resetModules();
  process.env.NODE_ENV = 'development';
  process.env.REDIS_URL = '';

  const {
    idempotencyMiddleware,
    resetIdempotencyCache,
    getIdempotencyCacheSize,
  } = require('../src/middleware/idempotency.middleware');

  await resetIdempotencyCache();

  const app = express();
  app.use(express.json());
  app.post('/api/auth/login/init', idempotencyMiddleware, (_req, res) => {
    res.status(202).json({ success: true, otpRequired: true });
  });

  await request(app)
    .post('/api/auth/login/init')
    .set('Idempotency-Key', 'login-init-local')
    .send({ xID: 'X000001', password: 'Password#123' })
    .expect(202)
    .expect((res) => {
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.otpRequired, true);
    });

  await waitForFinishHandlers();
  assert.strictEqual(await getIdempotencyCacheSize(), 1);

  await request(app)
    .post('/api/auth/login/init')
    .set('Idempotency-Key', 'login-init-local')
    .send({ xID: 'X000001', password: 'Password#123' })
    .expect(202)
    .expect('Idempotency-Replayed', 'true')
    .expect((res) => {
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.otpRequired, true);
    });

  console.log('PASS /api/auth/login/init does not fail solely because Redis is missing in development');
}

async function testDevelopmentUnavailableRedisUsesMemoryFallback() {
  await resetModules();
  process.env.NODE_ENV = 'development';
  process.env.REDIS_URL = 'redis://127.0.0.1:1';

  const {
    idempotencyMiddleware,
    resetIdempotencyCache,
  } = require('../src/middleware/idempotency.middleware');

  await resetIdempotencyCache();

  const app = express();
  app.use(express.json());
  app.post('/api/auth/login/init', idempotencyMiddleware, (_req, res) => {
    res.status(202).json({ success: true, otpRequired: true });
  });

  await request(app)
    .post('/api/auth/login/init')
    .set('Idempotency-Key', 'login-init-unavailable-redis')
    .send({ xID: 'X000001', password: 'Password#123' })
    .expect(202)
    .expect((res) => {
      assert.strictEqual(res.body.success, true);
    });

  console.log('PASS unreachable local Redis does not block development idempotency');
}

async function run() {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedisUrl = process.env.REDIS_URL;
  try {
    await testMemoryStoreExpiresEntries();
    await testDevelopmentMissingRedisUsesMemoryFallback();
    await testDevelopmentUnavailableRedisUsesMemoryFallback();
    console.log('idempotencyMemoryFallback tests passed');
  } catch (error) {
    console.error('idempotencyMemoryFallback tests failed:', error);
    process.exitCode = 1;
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
    await resetModules();
  }
}

run();
