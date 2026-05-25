import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const schemaSource = read('src/schemas/worklist.routes.schema.js');
assert.ok(schemaSource.includes('workbasketId: nonEmptyString.optional()'), 'employee worklist schema should allow scoped workbasketId queries.');

const navSource = read('ui/src/constants/platformNavigation.js');
assert.ok(navSource.includes('createIcon('), 'platform navigation should define React icon nodes.');
assert.equal(navSource.includes('<svg'), false, 'platform navigation should not embed raw svg strings that render as text.');

console.log('worklistSidebarRegression.test.mjs passed');
