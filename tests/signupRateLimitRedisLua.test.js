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
    this.setCalls = [];
    this.delCalls = [];
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

  async exists(key) {
    return this._getEntry(key) ? 1 : 0;
  }

  async set(key, value, exFlag, seconds, nxFlag) {
    if (nxFlag === 'NX' && await this.exists(key)) {
      return null;
    }
    const expiresAt = exFlag === 'EX' ? Date.now() + Number(seconds) * 1000 : null;
    this.map.set(key, { value, expiresAt });
    this.setCalls.push([key, value, exFlag, seconds, nxFlag]);
    return 'OK';
  }

  async del(...keys) {
    this.delCalls.push(keys);
    let deleted = 0;
    keys.forEach((key) => {
      if (this.map.delete(key)) deleted += 1;
    });
    return deleted;
  }

  async eval(script, numKeys, ...args) {
    if (script.includes('maxAttempts')) {
      const [attemptKey, blockKey, threshold, ttl] = args;
      this.evalCalls.push([attemptKey, Number(threshold), Number(ttl), blockKey]);
      if (await this.exists(blockKey)) {
        return -2;
      }
      const current = await this.incr(attemptKey);
      if (current === 1) {
        await this.expire(attemptKey, Number(ttl));
      }
      if (current > Number(threshold)) {
        await this.set(blockKey, '1', 'EX', Number(ttl), 'NX');
        return -1;
      }
      return current;
    }

    const [key, threshold, ttl] = args;
    this.evalCalls.push([key, Number(threshold), Number(ttl), numKeys]);
    const current = await this.incr(key);
    if (current === 1) {
      await this.expire(key, Number(ttl));
    }
    return current > Number(threshold) ? 0 : 1;
  }
}

async function run() {
  console.log('Running Redis Lua signup rate-limit tests...');
  const fakeRedis = new FakeRedis();

  Module._load = function (request, parent, isMain) {
    if (request === '../config/redis') {
      return {
        getRedisClient: () => fakeRedis,
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signupRateLimit.service');
  const { hashIdentifier } = require('../src/utils/hashIdentifier');
  const signupRateLimitService = require('../src/services/signupRateLimit.service');

  const email = 'alice@example.com';
  const ip = '1.2.3.4';
  const signupResult = await signupRateLimitService.consumeSignupQuota({ email, ip });
  assert.strictEqual(signupResult.allowed, true);

  const emailRateKey = `docketra:ratelimit:signup:email:${hashIdentifier(email)}`;
  const ipRateKey = `docketra:ratelimit:signup:ip:${hashIdentifier(ip)}`;
  const usedKeys = fakeRedis.evalCalls.map((call) => call[0]);
  assert.ok(usedKeys.includes(emailRateKey), 'signup email key should use hashed identifier');
  assert.ok(usedKeys.includes(ipRateKey), 'signup ip key should use hashed identifier');
  assert.ok(!usedKeys.some((key) => key.includes(email)), 'raw email must not appear in Redis keys');

  for (let i = 1; i <= 5; i += 1) {
    const attempt = await signupRateLimitService.consumeOtpAttempt({ email });
    assert.deepStrictEqual(attempt, { allowed: true, attempts: i });
  }

  await assert.rejects(
    () => signupRateLimitService.consumeOtpAttempt({ email }),
    /Too many OTP attempts. Try again later\./,
  );

  const otpBlockKey = `docketra:otp:block:${hashIdentifier(email)}`;
  const otpAttemptKey = `docketra:otp:attempts:${hashIdentifier(email)}`;
  assert.ok(
    fakeRedis.setCalls.some((call) => call[0] === otpBlockKey && call[2] === 'EX'),
    'OTP block key should be set with expiry',
  );

  const evalCountAfterBlock = fakeRedis.evalCalls.length;
  await assert.rejects(
    () => signupRateLimitService.consumeOtpAttempt({ email }),
    /Too many OTP attempts. Try again later\./,
  );
  assert.strictEqual(fakeRedis.evalCalls.length, evalCountAfterBlock + 1);

  await signupRateLimitService.clearOtpAttempts({ email });
  assert.ok(
    fakeRedis.delCalls.some((call) => call.includes(otpAttemptKey) && call.includes(otpBlockKey)),
    'clearOtpAttempts should delete both attempt and block keys',
  );

  console.log('signupRateLimitRedisLua tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  Module._load = originalLoad;
});
