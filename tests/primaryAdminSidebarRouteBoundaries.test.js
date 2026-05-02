#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contractPaths = ['/api/clients', '/api/reports/case-metrics', '/api/storage/configuration', '/api/ai/configuration'];

const sourceChecks = [
  { file: '../src/routes/admin.routes.js', needle: "router.get('/clients'" },
  { file: '../src/routes/reports.routes.js', needle: "router.get('/case-metrics'" },
  { file: '../src/routes/storage.routes.js', needle: "router.get('/configuration'" },
  { file: '../src/routes/ai.routes.js', needle: "router.get('/configuration'" },
  { file: '../docs/PRIMARY_ADMIN_SIDEBAR_API_CONTRACT.md', needle: '/api/clients' },
  { file: '../docs/PRIMARY_ADMIN_SIDEBAR_API_CONTRACT.md', needle: '/api/reports/case-metrics' },
  { file: '../docs/PRIMARY_ADMIN_SIDEBAR_API_CONTRACT.md', needle: '/api/storage/configuration' },
  { file: '../docs/PRIMARY_ADMIN_SIDEBAR_API_CONTRACT.md', needle: '/api/ai/configuration' },
];

for (const check of sourceChecks) {
  const content = fs.readFileSync(path.resolve(__dirname, check.file), 'utf8');
  assert.ok(content.includes(check.needle), `${check.file} should include ${check.needle}`);
}

assert.strictEqual(contractPaths.length, 4, 'primary-admin contract should enforce all fixed API paths');
console.log('primaryAdminSidebarRouteBoundaries.test.js passed');
