const assert = require('assert');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const categorySchemas = require('../src/schemas/category.routes.schema');
const searchSchemas = require('../src/schemas/search.routes.schema');

function runMiddleware(middleware, req) {
  const result = { statusCode: 200, body: null, nextCalled: false };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(payload) {
      result.body = payload;
      return this;
    },
  };

  middleware(req, res, () => {
    result.nextCalled = true;
  });

  return result;
}

function runTests() {
  console.log('Running query validation coercion tests...');

  {
    const middleware = validateRequest(categorySchemas['GET /']);
    const req = { body: {}, params: {}, query: { activeOnly: 'true' } };
    const result = runMiddleware(middleware, req);

    assert.strictEqual(result.nextCalled, true, 'Expected category query validation to pass');
    assert.strictEqual(req.query.activeOnly, true, 'Expected activeOnly to be coerced to boolean true');
  }

  {
    const middleware = validateRequest(searchSchemas['GET /employee/me']);
    const req = { body: {}, params: {}, query: { limit: '1' } };
    const result = runMiddleware(middleware, req);

    assert.strictEqual(result.nextCalled, true, 'Expected employee worklist query validation to pass');
    assert.strictEqual(req.query.limit, 1, 'Expected limit to be coerced to a number');
  }

  {
    const middleware = validateRequest(searchSchemas['GET /employee/me']);
    const req = { body: {}, params: {}, query: { limit: 'NaN' } };
    const result = runMiddleware(middleware, req);

    assert.strictEqual(result.nextCalled, false, 'Expected invalid numeric limit to be rejected');
    assert.strictEqual(result.statusCode, 400, 'Expected invalid limit to return 400');
  }

  console.log('✓ Query validation coercion tests passed');
}

runTests();
