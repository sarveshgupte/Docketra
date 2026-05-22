#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const authSchemas = require('../src/schemas/auth.routes.schema');

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
      FORGOT_PASSWORD_TURNSTILE_MISSING: 'FORGOT_PASSWORD_TURNSTILE_MISSING',
      FORGOT_PASSWORD_TURNSTILE_FAILED: 'FORGOT_PASSWORD_TURNSTILE_FAILED',
      FORGOT_PASSWORD_TURNSTILE_PASSED: 'FORGOT_PASSWORD_TURNSTILE_PASSED',
    },
    logSecurityAuditEvent: async (event) => {
      global.__turnstileAuditEvents = global.__turnstileAuditEvents || [];
      global.__turnstileAuditEvents.push(event);
      return {};
    },
  },
};
const { requireTurnstileForSignup, requireTurnstileForForgotPassword } = require('../src/middleware/turnstile.middleware');
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
  global.__turnstileAuditEvents = [];
  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({}).expect(400);
    assert(global.__turnstileAuditEvents.some((entry) => entry.action === 'SIGNUP_TURNSTILE_MISSING'));
  }

  const originalVerify = turnstileService.verifyTurnstileToken;
  turnstileService.verifyTurnstileToken = async () => ({ success: true });
  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({ turnstileToken: 'ok' }).expect(200);
  }

  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', validateRequest(authSchemas['POST /signup/init']), requireTurnstileForSignup, (req, res) => {
      res.status(200).json({ ok: true, body: req.body });
    });

    const payload = {
      name: 'User Name',
      email: 'user@example.com',
      password: 'Password@123',
      firmName: 'Acme LLP',
      phone: '9998887776',
      turnstileToken: 'ok',
      ignoredField: 'should-be-stripped',
    };
    const response = await request(app).post('/signup/init').send(payload).expect(200);
    assert.strictEqual(response.body.body.turnstileToken, 'ok');
    assert.strictEqual(response.body.body.ignoredField, undefined);
  }

  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', validateRequest(authSchemas['POST /signup/init']), requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({
      name: 'User Name',
      email: 'user@example.com',
      password: 'Password@123',
      firmName: 'Acme LLP',
      phone: '9998887776',
      'cf-turnstile-response': 'ok',
    }).expect(200);
  }

  turnstileService.verifyTurnstileToken = async () => ({ success: false });
  {
    const app = express();
    app.use(express.json());
    app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/signup/init').send({ turnstileToken: 'bad' }).expect(403);
  }
  turnstileService.verifyTurnstileToken = originalVerify;

  process.env.TURNSTILE_ENABLED = 'false';
  {
    const app = express();
    app.use(express.json());
    app.post('/forgot-password/init', requireTurnstileForForgotPassword, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/forgot-password/init').send({ identifier: 'x123456' }).expect(200);
  }

  process.env.TURNSTILE_ENABLED = 'true';
  global.__turnstileAuditEvents = [];
  {
    const app = express();
    app.use(express.json());
    app.post('/forgot-password/init', requireTurnstileForForgotPassword, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/forgot-password/init').send({ identifier: 'x123456' }).expect(400);
    assert(global.__turnstileAuditEvents.some((entry) => entry.action === 'FORGOT_PASSWORD_TURNSTILE_MISSING'));
  }

  turnstileService.verifyTurnstileToken = async () => ({ success: true });
  {
    const app = express();
    app.use(express.json());
    app.post('/forgot-password/init', requireTurnstileForForgotPassword, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/forgot-password/init').send({ identifier: 'x123456', turnstileToken: 'ok' }).expect(200);
  }

  {
    const app = express();
    app.use(express.json());
    app.post('/forgot-password/init', validateRequest(authSchemas['POST /forgot-password/init']), requireTurnstileForForgotPassword, (req, res) => {
      res.status(200).json({ ok: true, body: req.body });
    });
    const response = await request(app).post('/forgot-password/init').send({
      identifier: 'x123456',
      turnstileToken: 'ok',
      unexpected: 'strip-me',
    }).expect(200);
    assert.strictEqual(response.body.body.turnstileToken, 'ok');
    assert.strictEqual(response.body.body.unexpected, undefined);
  }

  {
    const app = express();
    app.use(express.json());
    app.post('/forgot-password/init', validateRequest(authSchemas['POST /forgot-password/init']), requireTurnstileForForgotPassword, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/forgot-password/init').send({
      identifier: 'x123456',
      'cf-turnstile-response': 'ok',
    }).expect(200);
  }

  turnstileService.verifyTurnstileToken = originalVerify;
  process.env.TURNSTILE_ENABLED = 'true';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  {
    let seenToken = null;
    let fetchCalled = false;
    const result = await turnstileService.verifyTurnstileToken({
      token: 'siteverify-token',
      remoteIp: '203.0.113.42',
      fetchImpl: async (_url, options) => {
        fetchCalled = true;
        seenToken = typeof options.body?.get === 'function' ? options.body.get('response') : null;
        return { ok: true, json: async () => ({ success: true }) };
      },
    });
    assert.strictEqual(fetchCalled, true);
    assert.strictEqual(result.success, true);
    assert.strictEqual(seenToken, 'siteverify-token');
  }

  turnstileService.verifyTurnstileToken = async () => ({ success: false });
  {
    const app = express();
    app.use(express.json());
    app.post('/forgot-password/init', requireTurnstileForForgotPassword, (_req, res) => res.status(200).json({ ok: true }));
    await request(app).post('/forgot-password/init').send({ identifier: 'x123456', turnstileToken: 'bad' }).expect(403);
  }
  turnstileService.verifyTurnstileToken = originalVerify;

  const authRoutes = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8');
  assert(authRoutes.includes("router.post('/signup/init', authBlockEnforcer, signupLimiter, requireTurnstileForSignup, signupInit);"));
  assert(authRoutes.includes("router.post('/login/init', authBlockEnforcer, authLimiter, attachFirmFromSlug, loginInit);"));
  assert(authRoutes.includes("router.post('/forgot-password/init', authBlockEnforcer, forgotPasswordLimiter, sensitiveLimiter, requireTurnstileForForgotPassword, attachOptionalFirmFromSlug, forgotPasswordInit);"));
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
