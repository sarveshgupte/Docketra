#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { enforceSameOriginForCookieAuth } = require('../src/middleware/csrfOrigin.middleware');

async function run() {
  process.env.FRONTEND_ORIGINS = 'https://app.docketra.com,https://staging.docketra.com';

  const app = express();
  app.post('/csrf-check', enforceSameOriginForCookieAuth, (_req, res) => {
    res.status(200).json({ success: true });
  });

  await request(app)
    .post('/csrf-check')
    .set('Host', 'api.docketra.com')
    .set('Origin', 'https://app.docketra.com')
    .expect(200);

  await request(app)
    .post('/csrf-check')
    .set('Host', 'internal-render-host')
    .set('X-Forwarded-Host', 'api.docketra.com')
    .set('Origin', 'https://api.docketra.com')
    .expect(200);

  const rejected = await request(app)
    .post('/csrf-check')
    .set('Host', 'api.docketra.com')
    .set('Origin', 'https://evil.example.com')
    .expect(403);

  assert.strictEqual(rejected.body?.success, false, 'Cross-origin request should be rejected');
  console.log('csrfOrigin middleware tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
