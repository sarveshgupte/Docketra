import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const schemaSource = read('src/schemas/worklist.routes.schema.js');
assert.ok(schemaSource.includes('workbasketId: nonEmptyString.optional()'), 'employee worklist schema should allow scoped workbasketId queries.');

const navSource = read('ui/src/constants/platformNavigation.js');
assert.ok(navSource.includes('createIcon('), 'platform navigation should define React icon nodes.');
assert.equal(navSource.includes('<svg'), false, 'platform navigation should not embed raw svg strings that render as text.');
assert.ok(navSource.includes("activeMatch: 'exactWithQuery'"), 'Scoped worklist links should use exact query matching.');

const activeSource = read('ui/src/utils/navActive.js');
assert.ok(activeSource.includes("if (matchMode === 'exactWithQuery')"), 'Exact-with-query mode should be handled explicitly.');
assert.ok(activeSource.includes('return current === item.to;'), 'Query-aware active check should require exact location match.');

const shellSource = read('ui/src/components/platform/PlatformShell.jsx');
assert.ok(shellSource.includes('isNavItemActiveWithLocation(pathname, locationSearch, item)'), 'Sidebar active state should use query-aware location matching.');
assert.equal(shellSource.includes('isNavItemActive(pathname, item) ||'), false, 'Sidebar should not double-match by pathname for query-scoped worklists.');

console.log('worklistSidebarRegression.test.mjs passed');
