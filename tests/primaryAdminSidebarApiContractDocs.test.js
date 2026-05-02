const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contract = fs.readFileSync(path.resolve(__dirname, '../docs/PRIMARY_ADMIN_SIDEBAR_API_CONTRACT.md'), 'utf8');
for (const fixedPath of ['/api/clients', '/api/reports/case-metrics', '/api/storage/configuration', '/api/ai/configuration']) {
  assert.ok(contract.includes(fixedPath), `contract should include ${fixedPath}`);
}

console.log('primaryAdminSidebarRouteBoundaries.test.js passed');
