const assert = require('assert');
const schemas = require('../src/schemas/superadmin.routes.schema');

const schema = schemas['GET /firm-health'];
assert.ok(schema, 'GET /firm-health schema must exist');
const q = schema.query;
assert.strictEqual(q.safeParse({}).success, true);
assert.strictEqual(q.safeParse({ limit: '100' }).success, true);
assert.strictEqual(q.safeParse({ limit: '101' }).success, false);
assert.strictEqual(q.safeParse({ status: 'critical' }).success, true);
assert.strictEqual(q.safeParse({ status: 'bad' }).success, false);
assert.strictEqual(q.safeParse({ search: 'x'.repeat(100) }).success, true);
assert.strictEqual(q.safeParse({ search: 'x'.repeat(101) }).success, false);
console.log('superadminFirmHealth.schema.test.js passed');
