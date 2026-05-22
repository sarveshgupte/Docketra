#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');

const securityAuditPath = require.resolve('../src/services/securityAudit.service');
const originalSecurityAudit = require.cache[securityAuditPath];
require.cache[securityAuditPath] = {
  id: securityAuditPath,
  filename: securityAuditPath,
  loaded: true,
  exports: {
    SECURITY_AUDIT_ACTIONS: {
      SIGNUP_TURNSTILE_MISSING: 'SIGNUP_TURNSTILE_MISSING',
      SIGNUP_TURNSTILE_FAILED: 'SIGNUP_TURNSTILE_FAILED',
      SIGNUP_TURNSTILE_PASSED: 'SIGNUP_TURNSTILE_PASSED',
    },
    logSecurityAuditEvent: async () => ({}),
  },
};
const { requireTurnstileForSignup } = require('../src/middleware/turnstile.middleware');
const turnstileService = require('../src/services/turnstile.service');

async function run() {
  const originalEnabled = process.env.TURNSTILE_ENABLED;

  process.env.TURNSTILE_ENABLED = 'false';
  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({}).expect(200);
  }

  process.env.TURNSTILE_ENABLED = 'true';
  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({}).expect(400);
  }

  const originalVerify = turnstileService.verifyTurnstileToken;
  turnstileService.verifyTurnstileToken = async () => ({ success: true });
  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({ turnstileToken: 'ok' }).expect(200);
  }

  turnstileService.verifyTurnstileToken = async () => ({ success: false });
  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({ turnstileToken: 'bad' }).expect(403);
  }
  turnstileService.verifyTurnstileToken = originalVerify;

  const authRoutes = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8');
  assert(authRoutes.includes("router.post('/signup/init', authBlockEnforcer, signupLimiter, requireTurnstileForSignup, signupInit);"));
  assert(authRoutes.includes("router.post('/login/init', authBlockEnforcer, authLimiter, attachFirmFromSlug, loginInit);"));
  assert(authRoutes.includes("router.post('/forgot-password/init', authBlockEnforcer, forgotPasswordLimiter, sensitiveLimiter, attachOptionalFirmFromSlug, forgotPasswordInit);"));
  assert(authRoutes.includes("router.post('/signup/verify', authBlockEnforcer, signupLimiter, otpVerifyLimiter, signupVerify);"));
  assert(authRoutes.includes("router.post('/signup/resend', authBlockEnforcer, signupLimiter, otpResendLimiter, signupResend);"));

  process.env.TURNSTILE_ENABLED = originalEnabled;
  if (originalSecurityAudit) require.cache[securityAuditPath] = originalSecurityAudit;
  else delete require.cache[securityAuditPath];
  console.log('turnstileSignupProtection tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
