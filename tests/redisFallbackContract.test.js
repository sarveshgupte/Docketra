#!/usr/bin/env node
const assert = require('assert');

const envPath = require.resolve('../src/config/env');
const redisPath = require.resolve('../src/config/redis');

const baseEnv = () => ({
  NODE_ENV: 'test', PORT: '5000',
  MONGO_URI: 'mongodb://127.0.0.1:27017/test',
  JWT_SECRET: 'A'.repeat(64),
  JWT_PASSWORD_SETUP_SECRET: 'B'.repeat(64),
  SUPERADMIN_PASSWORD_HASH: '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC',
  SUPERADMIN_XID: 'X000001', SUPERADMIN_EMAIL: 'superadmin@example.com', SUPERADMIN_OBJECT_ID: '000000000000000000000001',
  ENCRYPTION_PROVIDER: 'disabled',
});

async function resetRedis() {
  const r = require(redisPath);
  if (r._resetRedisClientForTests) await r._resetRedisClientForTests();
  delete require.cache[redisPath];
}



async function testSecurityLimiterRecoversWhenRedisBecomesReady() {
  const express = require('express');
  const request = require('supertest');
  const rlPath = require.resolve('../src/middleware/rateLimiters');
  const redisConfigPath = require.resolve('../src/config/redis');

  delete require.cache[rlPath];
  const original = require.cache[redisConfigPath];
  let ready = false;
  require.cache[redisConfigPath] = {
    id: redisConfigPath,
    filename: redisConfigPath,
    loaded: true,
    exports: {
      getRedisClient: () => {
        if (!ready) return null;
        return {
          status: 'ready',
          call: async () => 'OK',
        };
      },
      isRedisReady: () => ready,
    },
  };

  process.env.NODE_ENV = 'production';
  process.env.UPLOAD_SCAN_STRICT = 'true';
  process.env.STORAGE_TOKEN_SECRET = 'S'.repeat(64);
  process.env.METRICS_TOKEN = 'M'.repeat(64);
  const { otpVerifyLimiter } = require('../src/middleware/rateLimiters');
  const app = express();
  app.use(express.json());
  app.post('/secure', otpVerifyLimiter, (_req, res) => res.json({ ok: true }));

  await request(app).post('/secure').send({ email: 'a@b.com' }).expect(503);
  ready = true;
  await request(app).post('/secure').send({ email: 'a@b.com' }).expect(200);

  delete require.cache[rlPath];
  if (original) require.cache[redisConfigPath] = original;
  else delete require.cache[redisConfigPath];
}

(async () => {
  Object.assign(process.env, baseEnv());
  delete require.cache[envPath];
  let { validateEnv } = require('../src/config/validateEnv');

  process.env.REDIS_URL = 'redis://localhost:6379';
  assert.strictEqual(validateEnv({ exitOnError: false }).valid, true);

  process.env.REDIS_URL = 'http://localhost:6379';
  assert.strictEqual(validateEnv({ exitOnError: false }).valid, false);

  await resetRedis();
  process.env.NODE_ENV = 'production';
  process.env.UPLOAD_SCAN_STRICT = 'true';
  process.env.STORAGE_TOKEN_SECRET = 'S'.repeat(64);
  process.env.METRICS_TOKEN = 'M'.repeat(64);
  process.env.REDIS_URL = 'redis://127.0.0.1:1';
  const { getRedisClient } = require('../src/config/redis');
  const clientA = getRedisClient();
  const clientB = getRedisClient();
  assert.ok(clientA && clientB);
  assert.strictEqual(clientA, clientB);

  let connectCount = 0;
  const fakeClient = { status: 'wait', connect: async () => { connectCount += 1; }, on:()=>{} };
  delete require.cache[redisPath];
  require.cache[require.resolve('ioredis')] = { id:'ioredis', filename:'ioredis', loaded:true, exports: function(){ return fakeClient; } };
  const redisModule = require('../src/config/redis');
  process.env.REDIS_URL = 'redis://localhost:6379';
  redisModule.getRedisClient();
  redisModule.getRedisClient();
  await new Promise((r)=>setImmediate(r));
  assert.strictEqual(connectCount, 1);

  await testSecurityLimiterRecoversWhenRedisBecomesReady();

  console.log('redisFallbackContract tests passed');
})().catch((e)=>{ console.error(e); process.exit(1); });
