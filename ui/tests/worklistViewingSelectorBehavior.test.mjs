import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const worklistPage = read('ui/src/pages/platform/WorklistPage.jsx');
const hooksSource = read('ui/src/hooks/usePlatformDataQueries.js');

assert.ok(worklistPage.includes("const WORKLIST_VIEWER_ROLES = new Set(['PRIMARY_ADMIN', 'ADMIN', 'MANAGER']);"), 'Viewing selector should be role-gated for primary admin/admin/manager.');
assert.ok(worklistPage.includes('Viewing: My Worklist'), 'Viewing selector should default to My Worklist (self).');
assert.ok(hooksSource.includes("queryKey: ['platform', 'my-worklist', options.assigneeXID || 'self'"), 'My worklist query key should include assigneeXID.');
assert.ok(hooksSource.includes('getEmployeeWorklist({ limit: 50, ...options })'), 'My worklist query should pass assigneeXID and filters to API.');
assert.ok(worklistPage.includes('Show active dockets only'), 'Worklist should include active-only checkbox.');
assert.ok(worklistPage.includes("activeOnly && status === 'PENDING' ? false : true"), 'Active-only checkbox should exclude pending records.');

console.log('worklistViewingSelectorBehavior.test.mjs passed');
