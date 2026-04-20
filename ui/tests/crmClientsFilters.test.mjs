import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/crm/CrmClientsPage.jsx'), 'utf8');

assert.ok(source.includes('label="Search clients"'), 'CRM clients page should include search input');
assert.ok(source.includes('id="crm-client-filter-type"'), 'CRM clients page should include type filter');
assert.ok(source.includes('id="crm-client-filter-status"'), 'CRM clients page should include status filter');
assert.ok(source.includes('label="Tag filter"'), 'CRM clients page should include tag filter');
assert.ok(source.includes('label="Source filter"'), 'CRM clients page should include source filter');
assert.ok(source.includes('deactivateClient'), 'CRM clients page should expose deactivate action');

console.log('crmClientsFilters.test.mjs passed');
