import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'ui', 'src', 'utils', 'permissions.js'), 'utf8');

assert(source.includes('isFirmManagerOrAbove(user)'), 'Manager/Admin/Primary Admin role access must be included.');
assert(source.includes("permissions.includes('CLIENT_MANAGE')"), 'CLIENT_MANAGE explicit permission access must be included.');
assert(source.includes("permissions.includes('CLIENT_CREATE')"), 'CLIENT_CREATE explicit permission access must be included.');

console.log('platformNavigationClientsAccess.test.mjs passed');
