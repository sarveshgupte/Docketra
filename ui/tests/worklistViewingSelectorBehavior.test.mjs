import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const worklistPage = read('ui/src/pages/platform/WorklistPage.jsx');
const hooksSource = read('ui/src/hooks/usePlatformDataQueries.js');

assert.ok(!worklistPage.includes('rows.forEach((row)'), 'Viewing options must not be derived from current worklist rows.');
assert.ok(!worklistPage.includes('Viewing: My Worklist'), 'Viewer selector should be hidden until a permitted-users source exists.');
assert.ok(!worklistPage.includes("String(user?.role || '').toUpperCase()"), 'Role checks should not rely on ad-hoc uppercase normalization in WorklistPage.');
assert.ok(hooksSource.includes("queryKey: ['platform', 'my-worklist', options.assigneeXID || 'self'"), 'My worklist query key should include assigneeXID.');
assert.ok(hooksSource.includes('getEmployeeWorklist({ limit: 50, ...options })'), 'My worklist query should pass assigneeXID and filters to API.');
assert.ok(worklistPage.includes('Show active dockets only'), 'Worklist should include active-only checkbox.');
assert.ok(worklistPage.includes("activeOnly && status === 'PENDING' ? false : true"), 'Active-only checkbox should exclude pending records by default.');

console.log('worklistViewingSelectorBehavior.test.mjs passed');
