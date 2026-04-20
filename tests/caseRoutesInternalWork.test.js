#!/usr/bin/env node
const assert = require('assert');
const routeSchemas = require('../src/schemas/case.routes.schema');

async function run() {
  const createSchema = routeSchemas['POST /']?.body;
  const listSchema = routeSchemas['GET /']?.query;

  assert.ok(createSchema, 'create route schema should exist');
  assert.ok(listSchema, 'list route schema should exist');

  const internalCreate = createSchema.parse({
    title: 'Internal finance review',
    description: 'Quarterly internal control review',
    categoryId: '507f1f77bcf86cd799439011',
    subcategoryId: 'internal-qc',
    isInternal: true,
    workType: 'internal',
  });
  assert.strictEqual(internalCreate.isInternal, true);
  assert.strictEqual(internalCreate.workType, 'internal');
  assert.strictEqual(internalCreate.clientId, undefined);

  const clientCreate = createSchema.parse({
    title: 'Client filing',
    description: 'File returns for client',
    categoryId: '507f1f77bcf86cd799439011',
    subcategoryId: 'tax-filing',
    clientId: 'C000123',
    isInternal: false,
    workType: 'client',
    priority: 'medium',
  });
  assert.strictEqual(clientCreate.clientId, 'C000123');
  assert.strictEqual(clientCreate.workType, 'client');
  assert.strictEqual(clientCreate.priority, 'medium');

  const guidedPayload = createSchema.parse({
    title: 'this is a test docket',
    description: '',
    categoryId: '507f1f77bcf86cd799439011',
    subcategoryId: 'legal-subcat',
    clientId: 'C000001',
    workType: 'client',
    isInternal: false,
    workbasketId: '507f1f77bcf86cd799439012',
    priority: 'medium',
    assignedTo: 'X000001',
  });
  assert.strictEqual(guidedPayload.description, '');
  assert.strictEqual(guidedPayload.workbasketId, '507f1f77bcf86cd799439012');
  assert.strictEqual(guidedPayload.priority, 'medium');

  const listQuery = listSchema.parse({
    isInternal: 'true',
    workType: 'internal',
    page: '1',
    limit: '20',
  });
  assert.strictEqual(listQuery.isInternal, true);
  assert.strictEqual(listQuery.workType, 'internal');

  console.log('Case route schema internal-work tests passed.');
}

run().catch((error) => {
  console.error('Case route schema internal-work tests failed:', error);
  process.exit(1);
});
