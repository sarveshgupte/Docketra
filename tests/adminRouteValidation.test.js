const assert = require('assert');
const { validateRequest } = require('../src/middleware/requestValidation.middleware');
const routeSchemas = require('../src/schemas/admin.routes.schema');

const runMiddleware = (middleware, req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      resolve({ statusCode: this.statusCode, payload, nextCalled: false });
    },
  };

  middleware(req, res, () => resolve({ statusCode: 200, payload: null, nextCalled: true, req }));
});

async function testAdminCategoriesListValidation() {
  const middleware = validateRequest(routeSchemas['GET /categories']);
  const req = { body: {}, params: {}, query: { activeOnly: 'false' } };
  const result = await runMiddleware(middleware, req);

  assert.strictEqual(result.nextCalled, true, 'GET /admin/categories should pass validation for activeOnly=false');
  assert.strictEqual(req.query.activeOnly, false, 'activeOnly should be coerced into boolean false');
  console.log('  ✓ validates GET /admin/categories activeOnly query');
}

async function testAdminCategoriesCreateValidation() {
  const middleware = validateRequest(routeSchemas['POST /categories']);
  const req = { body: { name: 'HR' }, params: {}, query: {} };
  const result = await runMiddleware(middleware, req);

  assert.strictEqual(result.nextCalled, true, 'POST /admin/categories should pass with a category name');
  assert.strictEqual(req.body.name, 'HR');
  console.log('  ✓ validates POST /admin/categories request body');
}

async function run() {
  try {
    await testAdminCategoriesListValidation();
    await testAdminCategoriesCreateValidation();
    console.log('admin route validation tests passed.');
  } catch (error) {
    console.error('admin route validation tests failed:', error);
    process.exit(1);
  }
}

run();
