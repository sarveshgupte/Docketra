#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendApiDir = path.join(__dirname, '..', 'ui', 'src', 'api');
const apiFiles = fs.readdirSync(frontendApiDir).filter((f) => f.endsWith('.js'));

const allCalls = [];
for (const file of apiFiles) {
  const source = fs.readFileSync(path.join(frontendApiDir, file), 'utf8');
  for (const match of source.matchAll(/\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
    allCalls.push({ file, path: match[1] });
  }
}

const mvpFiles = ['admin.api.js', 'client.api.js', 'case.api.js', 'dashboard.api.js', 'worklist.api.js'];
const mvpCalls = allCalls.filter((call) => mvpFiles.includes(call.file));
const unexpectedLegacy = mvpCalls.filter((call) => /\/crm\/|\/cms\//i.test(call.path));
assert.equal(unexpectedLegacy.length, 0, `MVP API helpers must not call CRM/CMS endpoints: ${unexpectedLegacy.map((x) => `${x.file}:${x.path}`).join(', ')}`);

const adminClientMismatch = mvpCalls.filter((call) => (
  call.file === 'client.api.js'
  && !call.path.startsWith('/admin/')
  && !call.path.startsWith('/clients')
  && !call.path.startsWith('/cases/')
));
assert.equal(adminClientMismatch.length, 0, `Client API helpers should target /admin/*, /clients*, or /cases/* routes: ${adminClientMismatch.map((x) => x.path).join(', ')}`);

console.log('frontendBackendApiParity.test.js passed');
