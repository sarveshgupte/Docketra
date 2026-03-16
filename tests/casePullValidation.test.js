#!/usr/bin/env node
const assert = require('assert');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const routeSchemas = require('../src/schemas/case.routes.schema');

function runMiddleware(mw, req) {
  return new Promise((resolve) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      },
    };

    mw(req, res, () => resolve({ statusCode: 200, req }));
  });
}

async function run() {
  const middleware = validateRequest(routeSchemas['POST /pull']);

  const okReq = { body: { caseIds: ['CASE-20260315-00001'] }, params: {}, query: {} };
  const ok = await runMiddleware(middleware, okReq);
  assert.strictEqual(ok.statusCode, 200);
  assert.deepStrictEqual(ok.req.body.caseIds, ['CASE-20260315-00001']);

  const invalidIdReq = { body: { caseIds: ['bad-id'] }, params: {}, query: {} };
  const invalid = await runMiddleware(middleware, invalidIdReq);
  assert.strictEqual(invalid.statusCode, 400);

  console.log('✓ Case pull route validation preserves caseIds and validates format');
}

run().catch((error) => {
  console.error('Case pull validation test failed:', error);
  process.exit(1);
});
