#!/usr/bin/env node
'use strict';

const assert = require('assert');
const request = require('supertest');
const Module = require('module');

// 1. Setup Mock Cache Overrides
const originalLoad = Module._load;

// Mock the Gemini Provider to prevent actual API calls during tests
const mockedGeminiProvider = {
  analyze: async () => { throw new Error('Not implemented'); },
  generateDocketFields: async () => { throw new Error('Not implemented'); },
  generateChatResponse: async (message, systemInstruction, options) => {
    return {
      text: `Mocked advice for ${options.model || 'gemini-3.5-flash'}: you queried "${message}" with system instruction containing: "${systemInstruction.slice(0, 100)}..."`,
      model: options.model || 'gemini-3.5-flash',
    };
  },
};

let currentTestRole = 'SUPERADMIN';

Module._load = function (requestName, parent, isMain) {
  if (requestName === '../services/ai/providers/gemini.provider' || requestName === './providers/gemini.provider') {
    return mockedGeminiProvider;
  }
  if (requestName === '../middleware/auth.middleware' || requestName === './middleware/auth.middleware') {
    return {
      authenticate: (req, res, next) => {
        req.user = {
          role: currentTestRole,
          email: 'test@docketra.com',
          xID: 'TEST_USER_001',
        };
        next();
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

// 2. Setup Environment Variables
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'mocked-gemini-key-for-testing';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';
process.env.ALLOW_REDIS_FALLBACK = 'true';

const createAppModulePath = require.resolve('../src/app/createApp');

(async () => {
  try {
    delete require.cache[createAppModulePath];
    delete require.cache[require.resolve('../src/routes/superadmin.routes')];
    delete require.cache[require.resolve('../src/controllers/superadminAiAssistant.controller')];

    const { createApp } = require('../src/app/createApp');
    const app = createApp();

    const urlPath = '/api/superadmin/ai-assistant/chat';

    // TEST 1: SuperAdmin access is granted
    console.log('Running Test 1: SuperAdmin role access...');
    currentTestRole = 'SUPERADMIN';
    const res1 = await request(app)
      .post(urlPath)
      .set('Idempotency-Key', 'test-key-1')
      .send({
        mode: 'Product Advisor',
        message: 'What should be our core focus for the MVP launch?',
      });

    assert.strictEqual(res1.status, 200, 'SuperAdmin should get 200 Success');
    assert.strictEqual(res1.body.success, true);
    assert.ok(res1.body.data.text.includes('Mocked advice'), 'Should return mocked Gemini text');
    console.log('✓ Test 1 Passed!');

    // TEST 2: Reject firm admin / standard users (403 Forbidden)
    console.log('Running Test 2: Standard Admin role access is blocked...');
    currentTestRole = 'ADMIN';
    const res2 = await request(app)
      .post(urlPath)
      .set('Idempotency-Key', 'test-key-2')
      .send({
        mode: 'Product Advisor',
        message: 'I am a firm admin, can I chat?',
      });

    assert.strictEqual(res2.status, 403, 'Normal Admin must get 403 Forbidden');
    assert.strictEqual(res2.body.success, false);
    assert.ok(
      res2.body.message.includes('Superadmin access required') ||
      res2.body.message.includes('Firm context') ||
      res2.body.code === 'AUDIT_FIRM_CONTEXT_REQUIRED' ||
      res2.body.message.includes('Access denied')
    );

    console.log('Running Test 2b: Regular Employee role access is blocked...');
    currentTestRole = 'USER';
    const res2b = await request(app)
      .post(urlPath)
      .set('Idempotency-Key', 'test-key-2b')
      .send({
        mode: 'Developer Advisor',
        message: 'I am a regular employee, can I chat?',
      });

    assert.strictEqual(res2b.status, 403, 'Regular Employee must get 403 Forbidden');
    assert.strictEqual(res2b.body.success, false);
    console.log('✓ Test 2 Passed!');

    // TEST 3: Schema validation rejects invalid mode
    console.log('Running Test 3: Schema validation handles invalid advisor mode...');
    currentTestRole = 'SUPERADMIN';
    const res3 = await request(app)
      .post(urlPath)
      .set('Idempotency-Key', 'test-key-3')
      .send({
        mode: 'Chief Financial Advisor', // Invalid mode
        message: 'Where should we invest money?',
      });

    assert.strictEqual(res3.status, 400, 'Invalid mode should fail schema validation with 400');
    assert.strictEqual(res3.body.success, false);
    console.log('✓ Test 3 Passed!');

    // TEST 4: Schema validation rejects empty/too long message
    console.log('Running Test 4: Schema validation handles message bounds...');
    const res4 = await request(app)
      .post(urlPath)
      .set('Idempotency-Key', 'test-key-4')
      .send({
        mode: 'Developer Advisor',
        message: '   ', // Empty/Whitespace only message
      });

    assert.strictEqual(res4.status, 400, 'Empty message should fail with 400');
    assert.strictEqual(res4.body.success, false);

    const res4b = await request(app)
      .post(urlPath)
      .set('Idempotency-Key', 'test-key-4b')
      .send({
        mode: 'Marketing Advisor',
        message: 'a'.repeat(4001), // Length > 4000
      });

    assert.strictEqual(res4b.status, 400, 'Overly long message should fail with 400');
    assert.strictEqual(res4b.body.success, false);
    console.log('✓ Test 4 Passed!');

    console.log('\nAll SuperAdmin AI Assistant tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  } finally {
    Module._load = originalLoad;
  }
})();
