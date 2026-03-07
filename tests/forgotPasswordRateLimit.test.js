#!/usr/bin/env node
'use strict';

const assert = require('assert');
const express = require('express');
const request = require('supertest');
const Module = require('module');

const FRIENDLY_MESSAGE = 'Too many password reset requests. Please wait a few minutes before trying again.';
const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

const loadRateLimiters = ({ redisClient } = {}) => {
  Module._load = function (requestName, parent, isMain) {
    if (requestName === '../services/metrics.service') {
      return {
        recordRateLimitHit: () => {},
        recordApiRateLimitExceeded: () => {},
      };
    }
    if (requestName === './securityAudit.middleware') {
      return {
        logSecurityEvent: async () => {},
      };
    }
    if (requestName === '../config/redis' && redisClient !== undefined) {
      return {
        getRedisClient: () => redisClient,
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/config/config');
  clearModule('../src/middleware/rateLimiters');
  const rateLimiters = require('../src/middleware/rateLimiters');
  Module._load = originalLoad;
  return rateLimiters;
};

function createMockRes() {
  const headers = {};
  const body = {};
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      Object.assign(body, payload);
      return this;
    },
  };
  return { res, headers, body };
}

async function shouldReturnFriendlyForgotPasswordRateLimitPayload() {
  process.env.NODE_ENV = 'test';
  process.env.SECURITY_RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE = '1';
  const { forgotPasswordLimiter } = loadRateLimiters();
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/api/auth/forgot-password', forgotPasswordLimiter, (_req, res) => {
    res.status(200).json({ success: true });
  });

  await request(app)
    .post('/api/auth/forgot-password')
    .set('X-Forwarded-For', '203.0.113.10')
    .send({ email: 'alice@example.com' })
    .expect(200);

  const limited = await request(app)
    .post('/api/auth/forgot-password')
    .set('X-Forwarded-For', '203.0.113.10')
    .send({ email: 'alice@example.com' })
    .expect(429);

  assert.strictEqual(limited.body.error, 'RATE_LIMIT_EXCEEDED');
  assert.strictEqual(limited.body.message, FRIENDLY_MESSAGE);
  assert(Number.isInteger(limited.body.retryAfter), 'retryAfter should be an integer number of seconds');
  assert(limited.body.retryAfter > 0, 'retryAfter should be positive');
  assert(limited.headers['retry-after'], 'Retry-After header should be present');
  console.log('  ✓ forgot-password limiter returns a friendly structured 429 response');
}

async function shouldReturnFriendlyMessageWhenAuthBlockEnforcerBlocksForgotPassword() {
  const { authBlockEnforcer } = loadRateLimiters({
    redisClient: {
      call: async () => 'mock-script-sha',
      ttl: async () => 42,
    },
  });

  const { res, headers, body } = createMockRes();
  let nextCalled = false;

  await authBlockEnforcer(
    {
      ip: '127.0.0.1',
      originalUrl: '/api/auth/forgot-password',
      headers: {},
      socket: {},
    },
    res,
    () => {
      nextCalled = true;
    }
  );

  assert.strictEqual(nextCalled, false, 'blocked forgot-password requests should not reach the controller');
  assert.strictEqual(res.statusCode, 429);
  assert.strictEqual(body.error, 'RATE_LIMIT_EXCEEDED');
  assert.strictEqual(body.message, FRIENDLY_MESSAGE);
  assert.strictEqual(body.retryAfter, 42);
  assert.strictEqual(headers['retry-after'], '42');
  console.log('  ✓ auth block enforcer returns the forgot-password friendly message');
}

async function run() {
  console.log('Running forgot-password rate limit tests...');
  try {
    await shouldReturnFriendlyForgotPasswordRateLimitPayload();
    await shouldReturnFriendlyMessageWhenAuthBlockEnforcerBlocksForgotPassword();
    console.log('All forgot-password rate limit tests passed.');
  } finally {
    Module._load = originalLoad;
    clearModule('../src/config/config');
    clearModule('../src/middleware/rateLimiters');
    delete process.env.SECURITY_RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE;
  }
}

run().catch((error) => {
  Module._load = originalLoad;
  console.error('forgotPasswordRateLimit tests failed:', error);
  process.exit(1);
});
