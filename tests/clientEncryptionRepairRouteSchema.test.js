const assert = require('assert');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const routeSchemas = require('../src/schemas/client.routes.schema');

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

(function testEncryptionRepairRouteSchemaExists() {
  const schema = routeSchemas['POST /encryption/repair'];
  assert.ok(schema, 'POST /encryption/repair schema should exist');
})();

(function testEncryptionRepairRouteSchemaAcceptsEmptyBody() {
  const middleware = validateRequest(routeSchemas['POST /encryption/repair']);
  const req = { body: {}, params: {}, query: {} };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'empty body and query should be accepted');
  assert.strictEqual(res.statusCode, 200, 'validation should pass with empty body and query');
})();

(function testEncryptionRepairRouteSchemaRejectsUnexpectedBodyFields() {
  const middleware = validateRequest(routeSchemas['POST /encryption/repair']);
  const req = { body: { firmId: 'attacker-supplied' }, params: {}, query: {} };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false, 'unexpected body fields must be rejected');
  assert.strictEqual(res.statusCode, 400, 'unexpected body fields should return 400');
  assert.match(res.body.message, /Validation failed for body/);
})();

(function testEncryptionRepairRouteSchemaRejectsUnexpectedQueryFields() {
  const middleware = validateRequest(routeSchemas['POST /encryption/repair']);
  const req = { body: {}, params: {}, query: { tenantId: 'attacker-query' } };
  const res = createMockResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false, 'unexpected query fields must be rejected');
  assert.strictEqual(res.statusCode, 400, 'unexpected query fields should return 400');
  assert.match(res.body.message, /Validation failed for query/);
})();

console.log('clientEncryptionRepairRouteSchema.test.js passed');
