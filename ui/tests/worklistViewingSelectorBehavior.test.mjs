import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const worklistPage = read('ui/src/pages/platform/WorklistPage.jsx');
const hooksSource = read('ui/src/hooks/usePlatformDataQueries.js');
const worklistApiSource = read('ui/src/api/worklist.api.js');

assert.ok(!worklistPage.includes('rows.forEach((row)'), 'Viewing options must not be derived from current worklist rows.');
assert.ok(!worklistPage.includes('Viewing: My Worklist'), 'Viewer selector should be hidden until a permitted-users source exists.');
assert.ok(!worklistPage.includes("String(user?.role || '').toUpperCase()"), 'Role checks should not rely on ad-hoc uppercase normalization in WorklistPage.');
assert.ok(hooksSource.includes("queryKey: ['platform', 'my-worklist', options.assigneeXID || 'self'"), 'My worklist query key should include assigneeXID.');
assert.ok(hooksSource.includes('getEmployeeWorklist({ limit: 50, ...options })'), 'My worklist query should pass assigneeXID and filters to API.');
assert.ok(worklistApiSource.includes('sortBy: filters.sortBy'), 'API client should include sortBy query param.');
assert.ok(worklistApiSource.includes('sortOrder: filters.sortOrder'), 'API client should include sortOrder query param.');
assert.ok(worklistApiSource.includes('search: filters.search'), 'API client should include search query param.');
assert.ok(worklistApiSource.includes('category: filters.category'), 'API client should include category query param.');
assert.ok(worklistApiSource.includes('subcategory: filters.subcategory'), 'API client should include subcategory query param.');
assert.ok(worklistPage.includes('Show active dockets only'), 'Worklist should include active-only checkbox.');
assert.ok(worklistPage.includes("activeOnly && status === 'PENDING' ? false : true"), 'Active-only checkbox should exclude pending records by default.');

console.log('worklistViewingSelectorBehavior.test.mjs passed');
