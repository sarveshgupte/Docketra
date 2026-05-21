import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

const routesSource = readSrc('src/constants/routes.js');
const navSource = readSrc('src/constants/platformNavigation.js');
const shellSource = readSrc('src/components/platform/PlatformShell.jsx');
const guardedRouteSource = readSrc('src/components/auth/ProtectedRoute.jsx');
const protectedRoutesSource = readSrc('src/routes/ProtectedRoutes.jsx');

assert.match(routesSource, /WORKLIST:\s*\(firmSlug\)\s*=>\s*`\/app\/firm\/\$\{firmSlug\}\/worklist`/);
assert.match(routesSource, /WORKBASKET_DETAIL:\s*\(firmSlug,\s*workbasketId\)/);
assert.match(routesSource, /QC_WORKBASKET_DETAIL:\s*\(firmSlug,\s*workbasketId\)/);
assert.match(navSource, /label:\s*'Workbaskets'/);
assert.match(navSource, /label:\s*'Worklists'/);
assert.match(navSource, /label:\s*'QC Worklists'/);
assert.match(navSource, /type:\s*'group'/, 'Navigation should use grouped daily operations items.');
assert.match(navSource, /ROUTES\.WORKBASKET_DETAIL\(/);
assert.match(navSource, /workbasketId=\$\{encodeURIComponent\(id\)\}/);
assert.match(navSource, /ROUTES\.QC_WORKBASKET_DETAIL\(/);
assert.doesNotMatch(navSource, /\.slice\(0,\s*4\)/);

assert.match(shellSource, /item\?\.type === 'group'/, 'Platform shell should render group wrappers.');
assert.match(shellSource, /platform__nav-link--child/, 'Platform shell should render nested child links.');
assert.doesNotMatch(shellSource, /<Link\s+key=\{item\.to\}\s+to=\{item\.to\}[\s\S]*item\.type === 'group'/, 'Group items must not render as direct links.');

assert.match(protectedRoutesSource, /path="workbaskets\/:workbasketId"[\s\S]*?<ProtectedRoute requireAssignedWorkbasket>/);
assert.match(protectedRoutesSource, /path="qc-workbaskets\/:workbasketId"[\s\S]*?<ProtectedRoute requireAssignedQcWorkbasket>/);
assert.match(guardedRouteSource, /if\s*\(requireAssignedWorkbasket\)[\s\S]*!targetId\s*\|\|\s*!assignedIds\.has\(targetId\)/);
assert.match(guardedRouteSource, /if\s*\(requireAssignedQcWorkbasket\)[\s\S]*!targetId\s*\|\|\s*!assignedIds\.has\(targetId\)/);

console.log('workbasketSidebarDirectLinks.test.mjs passed');
