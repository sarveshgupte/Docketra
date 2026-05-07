#!/usr/bin/env node
const assert = require('assert');
const routeSchemas = require('../src/schemas/case.routes.schema');

async function run() {
  const createSchema = routeSchemas['POST /']?.body;
  const listSchema = routeSchemas['GET /']?.query;

  assert.ok(createSchema, 'create route schema should exist');
  assert.ok(listSchema, 'list route schema should exist');

  const withEmployee = createSchema.parse({
    title: 'HR employee context docket',
    categoryId: '507f1f77bcf86cd799439011',
    subcategoryId: 'hr-sub',
    employeeXID: 'X000123',
  });
  assert.strictEqual(withEmployee.employeeXID, 'X000123');

  const withoutEmployee = createSchema.parse({
    title: 'HR general docket',
    categoryId: '507f1f77bcf86cd799439011',
    subcategoryId: 'hr-general-sub',
  });
  assert.strictEqual(withoutEmployee.employeeXID, undefined, 'employeeXID must remain optional');

  const listWithEmployee = listSchema.parse({ employeeXID: 'X000123', page: '1', limit: '20' });
  assert.strictEqual(listWithEmployee.employeeXID, 'X000123');

  console.log('caseRoutesEmployeeContext.test.js passed');
}

run().catch((error) => {
  console.error('caseRoutesEmployeeContext.test.js failed:', error);
  process.exit(1);
});
