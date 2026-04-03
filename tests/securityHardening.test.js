#!/usr/bin/env node
require('dotenv').config();
const assert = require('assert');
const express = require('express');
const request = require('supertest');

const redisModule = require('../src/config/redis');

class FakeRedis {
  constructor() {
    this.map = new Map();
  }
  _getEntry(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry;
  }
  async incr(key) {
    const entry = this._getEntry(key);
    const value = Number(entry ? entry.value : 0) + 1;
    this.map.set(key, { value, expiresAt: entry ? entry.expiresAt : null });
    return value;
  }
  async expire(key, seconds) {
    const entry = this._getEntry(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + Number(seconds) * 1000;
    this.map.set(key, entry);
    return 1;
  }
  async ttl(key) {
    const entry = this._getEntry(key);
    if (!entry) return -1;
    if (!entry.expiresAt) return -1;
    return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }
  async exists(key) {
    return this._getEntry(key) ? 1 : 0;
  }
  async eval(_script, _numKeys, key, limit, ttl) {
    const current = await this.incr(key);
    if (current === 1) {
      await this.expire(key, ttl);
    }
    return current > Number(limit) ? 0 : 1;
  }
  async set(key, value, exFlag, seconds, nxFlag) {
    if (nxFlag === 'NX' && await this.exists(key)) {
      return null;
    }
    const expiresAt = exFlag === 'EX' ? Date.now() + Number(seconds) * 1000 : null;
    this.map.set(key, { value, expiresAt });
    return 'OK';
  }
  async del(...keys) {
    let deleted = 0;
    keys.forEach((k) => {
      if (this.map.delete(k)) deleted += 1;
    });
    return deleted;
  }
}

async function testIpRateLimit() {
  delete require.cache[require.resolve('../src/config/config')];
  delete require.cache[require.resolve('../src/middleware/rateLimiters')];
  process.env.SECURITY_RATE_LIMIT_GLOBAL = '100';
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
  delete require.cache[require.resolve('../src/middleware/tenantThrottle.middleware')];
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
  // The lock key is set by the failed-attempt recorder once attempts exceed the configured threshold.
  // That means the request that crosses the threshold still returns 401, and the next request is blocked with 429.
  await request(app).post('/login').send({ email: 'a@b.com' }).expect(401);
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
  delete process.env.SECURITY_RATE_LIMIT_GLOBAL;
  console.log('securityHardening tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
