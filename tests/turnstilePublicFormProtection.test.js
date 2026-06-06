#!/usr/bin/env node
'use strict';

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
      PUBLIC_FORM_TURNSTILE_MISSING: 'PUBLIC_FORM_TURNSTILE_MISSING',
      PUBLIC_FORM_TURNSTILE_FAILED: 'PUBLIC_FORM_TURNSTILE_FAILED',
      PUBLIC_FORM_TURNSTILE_PASSED: 'PUBLIC_FORM_TURNSTILE_PASSED',
    },
    logSecurityAuditEvent: async (event) => {
      global.__publicFormTurnstileAuditEvents = global.__publicFormTurnstileAuditEvents || [];
      global.__publicFormTurnstileAuditEvents.push(event);
      return event;
    },
  },
};

delete require.cache[require.resolve('../src/middleware/turnstile.middleware')];
const { requireTurnstileForPublicForm } = require('../src/middleware/turnstile.middleware');
const turnstileService = require('../src/services/turnstile.service');

function createApp() {
  const app = express();
  app.use(express.json());
  app.post('/public/forms/:id/submit', requireTurnstileForPublicForm, (_req, res) => res.status(201).json({ ok: true }));
  return app;
}

async function run() {
  const originalEnabled = process.env.TURNSTILE_ENABLED;
  const originalVerify = turnstileService.verifyTurnstileToken;

  try {
    process.env.TURNSTILE_ENABLED = 'false';
    global.__publicFormTurnstileAuditEvents = [];
    await request(createApp())
      .post('/public/forms/000000000000000000000001/submit')
      .send({ name: 'Public User' })
      .expect(201);
    assert.strictEqual(global.__publicFormTurnstileAuditEvents.length, 0, 'disabled Turnstile should not audit form events');

    process.env.TURNSTILE_ENABLED = 'true';
    global.__publicFormTurnstileAuditEvents = [];
    await request(createApp())
      .post('/public/forms/000000000000000000000001/submit')
      .send({ name: 'Public User' })
      .expect(400);
    assert(global.__publicFormTurnstileAuditEvents.some((entry) => entry.action === 'PUBLIC_FORM_TURNSTILE_MISSING'));

    turnstileService.verifyTurnstileToken = async ({ token }) => ({ success: token === 'ok' });

    global.__publicFormTurnstileAuditEvents = [];
    await request(createApp())
      .post('/public/forms/000000000000000000000001/submit')
      .send({ name: 'Public User', turnstileToken: 'bad' })
      .expect(403);
    assert(global.__publicFormTurnstileAuditEvents.some((entry) => entry.action === 'PUBLIC_FORM_TURNSTILE_FAILED'));

    global.__publicFormTurnstileAuditEvents = [];
    await request(createApp())
      .post('/public/forms/000000000000000000000001/submit')
      .send({ name: 'Public User', turnstileToken: 'ok' })
      .expect(201);
    assert(global.__publicFormTurnstileAuditEvents.some((entry) => entry.action === 'PUBLIC_FORM_TURNSTILE_PASSED'));

    global.__publicFormTurnstileAuditEvents = [];
    await request(createApp())
      .post('/public/forms/000000000000000000000001/submit?embed=true')
      .send({ name: 'Public User', submissionMode: 'embedded_form' })
      .expect(201);
    assert.strictEqual(
      global.__publicFormTurnstileAuditEvents.length,
      0,
      'embedded public form submissions should continue to rely on embed-origin checks instead of Turnstile'
    );

    const publicRoutes = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'routes', 'public.routes.js'), 'utf8');
    assert(
      publicRoutes.includes("router.post('/forms/:id/submit', formSubmitLimiter, requireTurnstileForPublicForm, submitForm);"),
      'public form submit route should apply form Turnstile after rate limiting'
    );

    console.log('turnstilePublicFormProtection tests passed');
  } finally {
    turnstileService.verifyTurnstileToken = originalVerify;
    if (originalEnabled === undefined) delete process.env.TURNSTILE_ENABLED;
    else process.env.TURNSTILE_ENABLED = originalEnabled;
    if (originalSecurityAudit) require.cache[securityAuditPath] = originalSecurityAudit;
    else delete require.cache[securityAuditPath];
    delete require.cache[require.resolve('../src/middleware/turnstile.middleware')];
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
