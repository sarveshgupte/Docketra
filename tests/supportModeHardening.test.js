const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const optionsPreflight = require('../src/middleware/optionsPreflight.middleware');
const { applySupportHeadersToContext } = require('../src/middleware/supportHeaders');

(async () => {
  {
    const app = express();
    const headers = ['Content-Type', 'Authorization', 'X-Impersonated-Firm-Id', 'X-Impersonation-Session-Id', 'X-Impersonation-Mode'];
    app.use(optionsPreflight(['http://localhost:5173'], headers, ['GET', 'POST', 'OPTIONS']));
    app.options('/api/secure', (req, res) => res.sendStatus(200));
    const res = await request(app).options('/api/secure').set('Origin', 'http://localhost:5173');
    assert.equal(res.status, 204);
    assert.match(res.headers['access-control-allow-headers'], /X-Impersonated-Firm-Id/);
    assert.match(res.headers['access-control-allow-headers'], /X-Impersonation-Session-Id/);
    assert.match(res.headers['access-control-allow-headers'], /X-Impersonation-Mode/);
  }

  {
    const source = fs.readFileSync(path.join(__dirname, '../src/app/createApp.js'), 'utf8');
    assert.match(source, /X-Impersonated-Firm-Id/);
    assert.match(source, /X-Impersonation-Session-Id/);
    assert.match(source, /X-Impersonation-Mode/);
  }

  {
    const req = { headers: { 'x-impersonated-firm-id': 'f', 'x-impersonation-session-id': 's', 'x-impersonation-mode': 'FULL_ACCESS' }, context: {}, isSuperAdmin: false };
    applySupportHeadersToContext(req);
    assert.equal(req.context.impersonatedFirmId, undefined);
  }

  {
    const req = { headers: { 'x-impersonated-firm-id': 'f' }, context: {} };
    applySupportHeadersToContext(req);
    assert.equal(req.context.impersonatedFirmId, undefined);
  }


  {
    const req = { method: 'GET', headers: { 'x-impersonated-firm-id': 'f' }, context: {}, isSuperAdmin: true };
    applySupportHeadersToContext(req);
    assert.equal(req.context.impersonationDenied, true);
    assert.equal(req.context.impersonationDeniedReason, 'missing_required_headers');
  }

  {
    const req = { method: 'GET', headers: { 'x-impersonated-firm-id': 'f', 'x-impersonation-session-id': 's', 'x-impersonation-mode': 'BAD' }, context: {}, isSuperAdmin: true };
    applySupportHeadersToContext(req);
    assert.equal(req.context.impersonationDenied, true);
    assert.equal(req.context.impersonationDeniedReason, 'invalid_impersonation_mode');
  }

  {
    const req = { method: 'PATCH', headers: { 'x-impersonated-firm-id': 'f', 'x-impersonation-session-id': 's', 'x-impersonation-mode': 'READ_ONLY' }, context: {}, isSuperAdmin: true };
    applySupportHeadersToContext(req);
    assert.equal(req.context.impersonationDenied, true);
    assert.equal(req.context.impersonationDeniedReason, 'read_only_mutation_blocked');
  }
  {
    const app = express();
    app.get('/api/auth/debug-cookie-state', (req, res, next) => {
      if (process.env.NODE_ENV === 'production') return res.status(404).json({ success: false, message: 'Not found' });
      return next();
    }, (req, res) => res.json({ success: true }));
    const old = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = await request(app).get('/api/auth/debug-cookie-state');
    process.env.NODE_ENV = old;
    assert.equal(res.status, 404);
  }

  {
    const app = express();
    app.get('/api/debug/email-test', (req, res) => {
      try { throw new Error('sensitive-stack-detail'); } catch (error) {
        return res.status(500).json({ success: false, message: 'Error sending test email', ...(process.env.NODE_ENV === 'production' ? {} : { error: error.message }) });
      }
    });
    const old = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = await request(app).get('/api/debug/email-test');
    process.env.NODE_ENV = old;
    assert.equal(res.status, 500);
    assert.equal(res.body.error, undefined);
    assert.ok(!JSON.stringify(res.body).includes('sensitive-stack-detail'));
  }

  console.log('supportModeHardening.test.js passed');
})().catch((error) => {
  console.error('supportModeHardening.test.js failed', error);
  process.exit(1);
});
