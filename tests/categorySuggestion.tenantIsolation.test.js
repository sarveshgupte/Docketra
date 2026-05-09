const assert = require('assert');
const controller = require('../src/controllers/category.controller');
const Category = require('../src/models/Category.model');

(async () => {
  let capturedQuery = null;
  const originalFind = Category.find;
  Category.find = (query) => {
    capturedQuery = query;
    return { select: () => ({ lean: async () => [] }) };
  };
  const req = { user: { firmId: 'firm-abc', role: 'ADMIN' }, body: { title: 'test', description: 'some long enough text' } };
  let payload = null;
  const res = { json: (body) => { payload = body; return body; }, status: () => res };
  await controller.suggestCategory(req, res);
  Category.find = originalFind;
  assert.strictEqual(capturedQuery.firmId, 'firm-abc');
  assert.ok(Array.isArray(payload.data.suggestions));
  console.log('categorySuggestion.tenantIsolation.test.js passed');
})();
