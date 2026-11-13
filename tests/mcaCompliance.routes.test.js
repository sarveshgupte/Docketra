'use strict';

const assert = require('assert');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const routeSchemas = require('../src/schemas/mcaCompliance.routes.schema');

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// 1. Test POST /sync validation
(function testPostSyncValidation() {
  const middleware = validateRequest(routeSchemas['POST /sync']);
  const req = {
    body: {
      cinOrLlpin: 'U72900KA2022PTC123456',
      runSynchronous: true,
    },
    params: {},
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Valid sync request should call next');
})();

// 2. Test POST /sync validation failure for missing CIN
(function testPostSyncMissingCin() {
  const middleware = validateRequest(routeSchemas['POST /sync']);
  const req = {
    body: {},
    params: {},
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false, 'Invalid sync request should not call next');
  assert.strictEqual(res.statusCode, 400, 'Should return 400 on missing CIN');
})();

// 3. Test POST /filings/draft validation
(function testPostFilingsDraftValidation() {
  const middleware = validateRequest(routeSchemas['POST /filings/draft']);
  const req = {
    body: {
      cinOrLlpin: 'U72900KA2022PTC123456',
      formType: 'AOC_4',
      financialYear: '2025-2026',
      filingData: {
        balance_sheet: { total_assets: 1000 },
      },
      attachments: [{ document_type: 'BALANCE_SHEET', file_name: 'bs.pdf' }],
    },
    params: {},
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Valid filings draft request should call next');
})();

// 4. Test POST /statutory/draft validation
(function testPostStatutoryDraftValidation() {
  const middleware = validateRequest(routeSchemas['POST /statutory/draft']);
  const req = {
    body: {
      cinOrLlpin: 'U72900KA2022PTC123456',
      documentType: 'BOARDS_REPORT',
      financialYear: '2025-2026',
    },
    params: {},
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Valid statutory draft request should call next');
})();

// 5. Test GET /filings/:id/review validation
(function testGetFilingsReviewValidation() {
  const middleware = validateRequest(routeSchemas['GET /filings/:id/review']);
  const req = {
    body: {},
    params: {
      id: '507f1f77bcf86cd799439011',
    },
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Valid Mongo ObjectId id param should call next');
})();

console.log('tests/mcaCompliance.routes.test.js passed');
