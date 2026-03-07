#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

class FakeRedis {
  constructor() {
    this.map = new Map();
    this.evalCalls = [];
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
    if (!entry || !entry.expiresAt) return -1;
    return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async eval(_script, _numKeys, key, limit, ttl) {
    this.evalCalls.push([key, Number(limit), Number(ttl)]);
    const current = await this.incr(key);
    if (current === 1) {
      await this.expire(key, ttl);
    }
    return current > Number(limit) ? 0 : 1;
  }

  async set(key, value, exFlag, seconds, nxFlag) {
    if (nxFlag === 'NX' && this._getEntry(key)) {
      return null;
    }
    const expiresAt = exFlag === 'EX' ? Date.now() + Number(seconds) * 1000 : null;
    this.map.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys) {
    keys.forEach((key) => this.map.delete(key));
    return 1;
  }
}

async function run() {
  console.log('Running account lockout Redis Lua tests...');
  const fakeRedis = new FakeRedis();

  Module._load = function (request, parent, isMain) {
    if (request === '../config/redis') {
      return { getRedisClient: () => fakeRedis };
    }
    if (request === './securityAudit.middleware') {
      return { logSecurityEvent: async () => {} };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/middleware/accountLockout.middleware');
  const config = require('../src/config/config');
  const { hashIdentifier } = require('../src/utils/hashIdentifier');
  const {
    enforceAccountLockout,
    recordFailedLoginAttempt,
  } = require('../src/middleware/accountLockout.middleware');

  const email = 'alice@example.com';
  const req = { body: { email } };
  for (let i = 0; i <= config.security.rateLimit.accountLockAttempts; i += 1) {
    await recordFailedLoginAttempt(req);
  }

  const hashed = hashIdentifier(email);
  const attemptKey = `docketra:ratelimit:login:attempts:${hashed}`;
  const lockKey = `docketra:ratelimit:login:block:${hashed}`;
  assert.ok(fakeRedis.evalCalls.some((call) => call[0] === attemptKey), 'login attempts should use hashed rate-limit key');
  assert.ok(!fakeRedis.evalCalls.some((call) => call[0].includes(email)), 'raw email must not appear in login attempt keys');
  assert.ok(await fakeRedis.ttl(lockKey) > 0, 'lock key should be set when attempts exceed limit');

  const response = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let nextCalled = false;
  await enforceAccountLockout(req, response, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, false, 'locked user should not pass middleware');
  assert.strictEqual(response.statusCode, 429);
  assert.strictEqual(response.body.error, 'ACCOUNT_TEMP_LOCKED');

  console.log('accountLockoutRedisLua tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  Module._load = originalLoad;
});
