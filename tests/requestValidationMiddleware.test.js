const assert = require('assert');
const { z } = require('zod');
const { validateRequest, sanitizeInput } = require('../src/middleware/requestValidation.middleware');

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

(function testValidationFailureBlocksController() {
  const middleware = validateRequest({
    body: z.object({ email: z.string().email() }),
    params: z.object({ id: z.string().min(1) }),
    query: z.object({ page: z.coerce.number().int().positive() }),
  });

  const req = {
    body: { email: 'not-an-email' },
    params: { id: '' },
    query: { page: '0' },
  };
  const res = createMockResponse();
  let controllerExecuted = false;

  middleware(req, res, () => {
    controllerExecuted = true;
  });

  assert.strictEqual(controllerExecuted, false, 'Controller should not execute on validation failure');
  assert.strictEqual(res.statusCode, 400, 'Should return 400 on validation failure');
  assert.deepStrictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body.error.details));
  assert.ok(res.body.error.details.some((d) => d.location === 'body'));
  assert.ok(res.body.error.details.some((d) => d.location === 'params'));
  assert.ok(res.body.error.details.some((d) => d.location === 'query'));
})();

(function testValidationSuccessPassesParsedValues() {
  const middleware = validateRequest({
    body: z.object({ email: z.string().email() }),
    params: z.object({ id: z.string().min(1) }),
    query: z.object({ page: z.coerce.number().int().positive() }),
  });

  const req = {
    body: { email: 'test@example.com' },
    params: { id: 'abc' },
    query: { page: '2' },
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Next middleware should execute on validation success');
  assert.strictEqual(req.query.page, 2, 'Query value should be parsed and assigned');
})();

(function testValidationStripsUnknownFields() {
  const middleware = validateRequest({
    body: z.object({
      email: z.string().email(),
    }),
  });

  const req = {
    body: { email: 'test@example.com', role: 'admin' },
    params: {},
    query: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Validation should pass for valid known fields');
  assert.deepStrictEqual(req.body, { email: 'test@example.com' }, 'Unknown keys should be removed from parsed body');
})();

(function testSanitizeInputBlocksPrototypePollutionKeys() {
  const polluted = sanitizeInput({
    safe: 'ok',
    __proto__: { polluted: true },
    nested: {
      constructor: { injected: true },
      prototype: { injected: true },
      retained: 'yes',
    },
  });

  assert.strictEqual(Object.prototype.polluted, undefined, 'Prototype must not be polluted by sanitized input');
  assert.deepStrictEqual(polluted, {
    safe: 'ok',
    nested: { retained: 'yes' },
  });
})();

console.log('Request validation middleware tests passed.');
