#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const { applyRouteValidation } = require('../src/middleware/requestValidation.middleware');
const routeSchemas = require('../src/schemas/public.routes.schema');

function buildApp() {
  const app = express();
  app.use(express.json());
  const router = applyRouteValidation(express.Router(), {
    'POST /cms/:firmSlug/intake': routeSchemas['POST /cms/:firmSlug/intake'],
  });

  router.post('/cms/:firmSlug/intake', (req, res) => {
    return res.status(201).json({
      success: true,
      firmSlug: req.params.firmSlug,
      name: req.body.name,
      hasUnexpectedFirmId: Object.prototype.hasOwnProperty.call(req.body, 'firmId'),
    });
  });

  app.use('/api/public', router);
  return app;
}

async function testRejectsMalformedPayload() {
  const app = buildApp();

  const response = await request(app)
    .post('/api/public/cms/acme/intake')
    .send({ name: '', email: 'not-an-email' });

  assert.strictEqual(response.status, 400);
  assert.strictEqual(response.body.success, false);
  assert.match(response.body.error.code, /VALIDATION_ERROR/);
}

async function testAcceptsValidPayload() {
  const app = buildApp();

  const response = await request(app)
    .post('/api/public/cms/acme/intake')
    .send({
      name: 'Jane Doe',
      email: 'jane@example.com',
      service: 'GST Filing',
      idempotencyKey: 'idem-1',
    });

  assert.strictEqual(response.status, 201);
  assert.strictEqual(response.body.success, true);
  assert.strictEqual(response.body.firmSlug, 'acme');
  assert.strictEqual(response.body.name, 'Jane Doe');
}

async function run() {
  await testRejectsMalformedPayload();
  await testAcceptsValidPayload();
  console.log('Public intake schema validation tests passed.');
}

run().catch((error) => {
  console.error('Public intake schema validation tests failed:', error);
  process.exit(1);
});
