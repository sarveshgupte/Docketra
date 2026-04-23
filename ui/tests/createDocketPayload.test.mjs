import assert from 'node:assert/strict';
import { buildCreateDocketPayload, validateCreateDocketPayload, resolveEarliestErrorStep } from '../src/components/docket/createDocketPayload.js';

const payload = buildCreateDocketPayload({
  title: '  this is a test docket ',
  description: '  review details  ',
  workType: 'client',
  clientId: ' C000001 ',
  categoryId: 'cat-1',
  subcategoryId: 'sub-1',
  workbasketId: 'wb-1',
  priority: 'Medium',
  assignedTo: 'x000001',
  idempotencyKey: ' abc-123 ',
});

assert.deepStrictEqual(payload, {
  title: 'this is a test docket',
  description: 'review details',
  categoryId: 'cat-1',
  subcategoryId: 'sub-1',
  clientId: 'C000001',
  isInternal: false,
  workType: 'client',
  workbasketId: 'wb-1',
  priority: 'medium',
  assignedTo: 'X000001',
  idempotencyKey: 'abc-123',
});

const missingIdErrors = validateCreateDocketPayload(
  buildCreateDocketPayload({
    title: 'x',
    workType: 'client',
    clientId: '',
    categoryId: '',
    subcategoryId: '',
    workbasketId: '',
  }),
  { categories: [], subcategories: [] }
);
assert.ok(missingIdErrors.clientId, 'Client work should require clientId');
assert.ok(missingIdErrors.categoryId, 'Category should be required');
assert.ok(missingIdErrors.subcategoryId, 'Subcategory should be required');
assert.ok(missingIdErrors.workbasketId, 'Workbasket should be required');

const staleErrors = validateCreateDocketPayload(payload, {
  categories: [{ _id: 'cat-2', name: 'Other' }],
  subcategories: [{ id: 'sub-2', name: 'Other Sub' }],
});
assert.ok(staleErrors.categoryId, 'Stale category IDs should fail validation');
assert.ok(staleErrors.subcategoryId, 'Stale subcategory IDs should fail validation');

const stepMap = { title: 0, categoryId: 1, workbasketId: 2, assignedTo: 3 };
assert.strictEqual(
  resolveEarliestErrorStep({ workbasketId: 'Missing', categoryId: 'Invalid' }, stepMap),
  1,
  'Should return earliest mapped step',
);
assert.strictEqual(
  resolveEarliestErrorStep({ unknownField: 'x' }, stepMap),
  null,
  'Should return null when no fields are mapped',
);

console.log('createDocketPayload.test.mjs passed');
