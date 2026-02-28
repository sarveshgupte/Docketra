#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');

const redisModule = require('../src/config/redis');

class FakeRedis {
  constructor() {
    this.map = new Map();
  }
  async incr(key) {
    const value = Number(this.map.get(key) || 0) + 1;
    this.map.set(key, value);
    return value;
  }
  async expire() { return 1; }
  async ttl(key) {
    return this.map.has(key) ? 120 : -1;
  }
  async set(key, value) { this.map.set(key, value); return 'OK'; }
  async del(...keys) { keys.forEach((k) => this.map.delete(k)); return 1; }
}

async function testIpRateLimit() {
  const { globalApiLimiter } = require('../src/middleware/rateLimiters');
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', globalApiLimiter);
  app.get('/api/ping', (req, res) => res.json({ ok: true }));

  for (let i = 0; i < 100; i += 1) {
    await request(app).get('/api/ping').set('X-Forwarded-For', '1.1.1.1').expect(200);
  }
  await request(app).get('/api/ping').set('X-Forwarded-For', '1.1.1.1').expect(429);
}

async function testTenantThrottle() {
  const { tenantThrottle } = require('../src/middleware/tenantThrottle.middleware');
  const fakeRedis = new FakeRedis();
  redisModule.getRedisClient = () => fakeRedis;
  const app = express();
  app.use((req, res, next) => {
    req.tenant = { id: 'tenant-1' };
    next();
  });
  app.use(tenantThrottle);
  app.get('/x', (req, res) => res.json({ ok: true }));

  for (let i = 0; i < 1000; i += 1) {
    await request(app).get('/x').expect(200);
  }
  await request(app).get('/x').expect(429);
}

async function testSecurityHeaders() {
  const helmet = require('helmet');
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.get('/h', (req, res) => res.json({ ok: true }));
  const res = await request(app).get('/h').expect(200);
  assert.ok(res.headers['x-frame-options']);
  assert.ok(res.headers['x-content-type-options']);
}

async function testAccountLockout() {
  const fakeRedis = new FakeRedis();
  redisModule.getRedisClient = () => fakeRedis;
  const { enforceAccountLockout, recordFailedLoginAttempt } = require('../src/middleware/accountLockout.middleware');
  const app = express();
  app.use(express.json());
  app.post('/login', enforceAccountLockout, async (req, res) => {
    await recordFailedLoginAttempt(req);
    res.status(401).json({ success: false });
  });

  for (let i = 0; i < 5; i += 1) {
    await request(app).post('/login').send({ email: 'a@b.com' }).expect(401);
  }
  await request(app).post('/login').send({ email: 'a@b.com' }).expect(429);
}

async function testUploadRejection() {
  const { createSecureUpload, enforceUploadSecurity, uploadErrorHandler } = require('../src/middleware/uploadProtection.middleware');
  const app = express();
  const upload = createSecureUpload({ memory: true });
  app.post('/upload', upload.single('file'), enforceUploadSecurity, (req, res) => res.json({ ok: true }));
  app.use(uploadErrorHandler);

  await request(app)
    .post('/upload')
    .attach('file', Buffer.from('x'), 'malware.exe')
    .expect(400);
}

async function run() {
  await testIpRateLimit();
  await testTenantThrottle();
  await testSecurityHeaders();
  await testAccountLockout();
  await testUploadRejection();
  console.log('securityHardening tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
