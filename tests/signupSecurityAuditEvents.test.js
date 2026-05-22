#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');

async function testTurnstileAuditEvents() {
  const securityAuditPath = require.resolve('../src/services/securityAudit.service');
  const turnstilePath = require.resolve('../src/services/turnstile.service');
  const middlewarePath = require.resolve('../src/middleware/turnstile.middleware');

  const events = [];
  const originalSecurityAudit = require.cache[securityAuditPath];
  const originalTurnstile = require.cache[turnstilePath];
  delete require.cache[middlewarePath];

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
      logSecurityAuditEvent: async (entry) => events.push(entry),
    },
  };

  require.cache[turnstilePath] = {
    id: turnstilePath,
    filename: turnstilePath,
    loaded: true,
    exports: {
      isTurnstileEnabled: () => true,
      extractTurnstileToken: (body) => body?.turnstileToken,
      verifyTurnstileToken: async ({ token }) => ({ success: token === 'ok' }),
    },
  };

  const { requireTurnstileForSignup } = require('../src/middleware/turnstile.middleware');
  const app = express();
  app.use(express.json());
  app.post('/signup/init', requireTurnstileForSignup, (_req, res) => res.status(200).json({ ok: true }));

  await request(app).post('/signup/init').send({}).expect(400);
  await request(app).post('/signup/init').send({ turnstileToken: 'bad' }).expect(403);
  await request(app).post('/signup/init').send({ turnstileToken: 'ok' }).expect(200);

  assert(events.some((e) => e.action === 'SIGNUP_TURNSTILE_MISSING'));
  assert(events.some((e) => e.action === 'SIGNUP_TURNSTILE_FAILED'));
  assert(events.some((e) => e.action === 'SIGNUP_TURNSTILE_PASSED'));
  for (const e of events) {
    assert(!JSON.stringify(e).includes('turnstileToken'));
    assert(!JSON.stringify(e).includes('bad'));
    assert(!JSON.stringify(e).includes('ok'));
  }

  if (originalSecurityAudit) require.cache[securityAuditPath] = originalSecurityAudit; else delete require.cache[securityAuditPath];
  if (originalTurnstile) require.cache[turnstilePath] = originalTurnstile; else delete require.cache[turnstilePath];
  delete require.cache[middlewarePath];
}

async function testSignupAuditEventSafety() {
  const securityAuditPath = require.resolve('../src/services/securityAudit.service');
  const authSignupPath = require.resolve('../src/services/authSignup.service');
  const entries = [];
  const originalSecurityAudit = require.cache[securityAuditPath];
  const originalAuthSignup = require.cache[authSignupPath];

  require.cache[securityAuditPath] = {
    id: securityAuditPath,
    filename: securityAuditPath,
    loaded: true,
    exports: {
      SECURITY_AUDIT_ACTIONS: {
        SIGNUP_INIT_ATTEMPT: 'SIGNUP_INIT_ATTEMPT',
        SIGNUP_OTP_SENT: 'SIGNUP_OTP_SENT',
        SIGNUP_OTP_VERIFY_ATTEMPT: 'SIGNUP_OTP_VERIFY_ATTEMPT',
        SIGNUP_OTP_VERIFY_FAILED: 'SIGNUP_OTP_VERIFY_FAILED',
        SIGNUP_OTP_VERIFIED: 'SIGNUP_OTP_VERIFIED',
        SIGNUP_COMPLETED: 'SIGNUP_COMPLETED',
      },
      logSecurityAuditEvent: async (entry) => entries.push(entry),
    },
  };
  delete require.cache[authSignupPath];
  const createAuthSignupService = require('../src/services/authSignup.service');

  const service = createAuthSignupService({
    signupService: {
      initiateSignup: async () => ({ success: true, message: 'OTP sent' }),
      verifyOtp: async () => ({ success: true, message: 'done', xid: 'x1', firmSlug: 'firm-a', firmUrl: '/a', redirectPath: '/r' }),
      resendOtp: async () => ({ success: true, message: 'resent' }),
    },
    getSession: () => null,
    mongoose: { startSession: async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }) },
    User: { findOne: () => ({ session: async () => null }) },
  });

  const mkRes = () => ({ statusCode: 200, body: null, status(c){this.statusCode=c;return this;}, json(b){this.body=b; return this;} });

  await service.signupInit({ body: { name: 'N', email: 'a@example.com', password: 'Secret1!', firmName: 'Acme', phone: '+1' }, method: 'POST', originalUrl: '/api/auth/signup/init', requestId: 'r1' }, mkRes());
  await service.signupVerify({ body: { email: 'a@example.com', otp: '123456' }, method: 'POST', originalUrl: '/api/auth/signup/verify', requestId: 'r2' }, mkRes());

  assert(entries.some((e) => e.action === 'SIGNUP_INIT_ATTEMPT'));
  assert(entries.some((e) => e.action === 'SIGNUP_OTP_SENT'));
  assert(entries.some((e) => e.action === 'SIGNUP_OTP_VERIFY_ATTEMPT'));
  assert(entries.some((e) => e.action === 'SIGNUP_OTP_VERIFIED'));
  assert(entries.some((e) => e.action === 'SIGNUP_COMPLETED'));

  const payload = JSON.stringify(entries);
  ['a@example.com', 'Secret1!', '123456', '+1', 'turnstileToken', 'preAuthToken'].forEach((secret) => {
    assert(!payload.includes(secret));
  });

  if (originalSecurityAudit) require.cache[securityAuditPath] = originalSecurityAudit; else delete require.cache[securityAuditPath];
  if (originalAuthSignup) require.cache[authSignupPath] = originalAuthSignup; else delete require.cache[authSignupPath];
}

(async () => {
  await testTurnstileAuditEvents();
  await testSignupAuditEventSafety();
  console.log('signupSecurityAuditEvents.test.js passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
