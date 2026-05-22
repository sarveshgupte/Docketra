#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');

async function withStubbedRedisAndSecurityAudit(fn, { redisReady = false } = {}) {
  const redisPath = require.resolve('../src/config/redis');
  const securityAuditMiddlewarePath = require.resolve('../src/middleware/securityAudit.middleware');
  const originalRedis = require.cache[redisPath];
  const originalSecurityAuditMiddleware = require.cache[securityAuditMiddlewarePath];

  require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: { getRedisClient: () => null, isRedisReady: () => redisReady },
  };
  require.cache[securityAuditMiddlewarePath] = {
    id: securityAuditMiddlewarePath,
    filename: securityAuditMiddlewarePath,
    loaded: true,
    exports: { logSecurityEvent: async () => {} },
  };

  try {
    await fn();
  } finally {
    if (originalRedis) require.cache[redisPath] = originalRedis;
    else delete require.cache[redisPath];

    if (originalSecurityAuditMiddleware) require.cache[securityAuditMiddlewarePath] = originalSecurityAuditMiddleware;
    else delete require.cache[securityAuditMiddlewarePath];
  }
}

async function testSignupLimiterTripsAtConfiguredLimit() {
  await withStubbedRedisAndSecurityAudit(async () => {
    const rlPath = require.resolve('../src/middleware/rateLimiters');
    delete require.cache[rlPath];
    process.env.NODE_ENV = 'test';
    process.env.SECURITY_RATE_LIMIT_SIGNUP_PER_HOUR = '2';
    process.env.SECURITY_RATE_LIMIT_SIGNUP_WINDOW_SECONDS = '3600';

    const { signupLimiter } = require('../src/middleware/rateLimiters');
    const app = express();
    app.use(express.json());
    app.post('/signup/init', signupLimiter, (_req, res) => res.json({ ok: true }));

    await request(app).post('/signup/init').set('X-Forwarded-For', '1.2.3.4').send({ email: 'A@Example.com', firmName: 'Acme LLP' }).expect(200);
    await request(app).post('/signup/init').set('X-Forwarded-For', '1.2.3.4').send({ email: 'a@example.com', firmName: 'Acme LLP' }).expect(200);
    await request(app).post('/signup/init').set('X-Forwarded-For', '1.2.3.4').send({ email: 'a@example.com', firmName: 'Acme LLP' }).expect(429);

    delete process.env.SECURITY_RATE_LIMIT_SIGNUP_PER_HOUR;
    delete process.env.SECURITY_RATE_LIMIT_SIGNUP_WINDOW_SECONDS;
  });
}

function testAuthRouteLimiterWiring() {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8');

  assert(source.includes("router.post('/signup/init', authBlockEnforcer, signupLimiter, requireTurnstileForSignup, signupInit);"));
  assert(source.includes("router.post('/signup/verify', authBlockEnforcer, signupLimiter, otpVerifyLimiter, signupVerify);"));
  assert(source.includes("router.post('/signup/resend', authBlockEnforcer, signupLimiter, otpResendLimiter, signupResend);"));

  assert(source.includes("router.post('/login/init', authBlockEnforcer, authLimiter, attachFirmFromSlug, loginInit);"));
  assert(source.includes("router.post('/login/verify', authBlockEnforcer, authLimiter, otpVerifyLimiter, attachFirmFromSlug, loginVerify);"));
  assert(source.includes("router.post('/login/resend', authBlockEnforcer, authLimiter, otpResendLimiter, attachFirmFromSlug, loginResend);"));
}

async function testSignupLimiterFailsClosedInProductionWithoutRedis() {
  await withStubbedRedisAndSecurityAudit(async () => {
    const rlPath = require.resolve('../src/middleware/rateLimiters');
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      delete require.cache[rlPath];
      process.env.NODE_ENV = 'production';
      process.env.UPLOAD_SCAN_STRICT = 'true';
      process.env.JWT_SECRET = 'J'.repeat(64);
      process.env.STORAGE_TOKEN_SECRET = 'S'.repeat(64);
      process.env.METRICS_TOKEN = 'M'.repeat(64);

      const { signupLimiter } = require('../src/middleware/rateLimiters');
      const app = express();
      app.use(express.json());
      app.post('/signup/init', signupLimiter, (_req, res) => res.json({ ok: true }));
      await request(app).post('/signup/init').send({ email: 'safe@example.com' }).expect(503);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      delete require.cache[rlPath];
    }
  });
}

(async () => {
  await testSignupLimiterTripsAtConfiguredLimit();
  testAuthRouteLimiterWiring();
  await testSignupLimiterFailsClosedInProductionWithoutRedis();
  console.log('signupAntiAbuseProtection tests passed');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
