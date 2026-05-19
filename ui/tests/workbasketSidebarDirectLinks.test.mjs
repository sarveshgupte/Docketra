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

assert.match(routesSource, /WORKLIST:\s*\(firmSlug\)\s*=>\s*`\/app\/firm\/\$\{firmSlug\}\/worklist`/, 'Routes should expose My Worklist route');
assert.match(routesSource, /WORKBASKET_DETAIL:\s*\(firmSlug,\s*workbasketId\)\s*=>\s*`\/app\/firm\/\$\{firmSlug\}\/workbaskets\/\$\{workbasketId\}`/, 'Routes should expose direct workbasket detail route');
assert.match(routesSource, /QC_WORKBASKET_DETAIL:\s*\(firmSlug,\s*workbasketId\)\s*=>\s*`\/app\/firm\/\$\{firmSlug\}\/qc-workbaskets\/\$\{workbasketId\}`/, 'Routes should expose direct QC workbasket detail route');

assert.doesNotMatch(navSource, /assignedWorkbaskets\.slice\(0,\s*4\)/, 'Sidebar should show all assigned workbasket links');
assert.doesNotMatch(navSource, /assignedQcWorkbaskets\.slice\(0,\s*4\)/, 'Sidebar should show all assigned QC workbasket links');
assert.match(navSource, /label:\s*'My Worklist'[\s\S]*to:\s*ROUTES\.WORKLIST\(firmSlug\)/, 'Daily Operations should always include My Worklist');
assert.match(navSource, /showQcWorkbaskets\s*=\s*hasAtLeastRole\(normalizedRole,\s*'MANAGER'\)\s*\|\|\s*assignedQcWorkbaskets\.length\s*>\s*0/, 'QC worklist visibility should be manager+ or explicitly assigned');
assert.match(navSource, /label:\s*'QC Worklist'[\s\S]*to:\s*ROUTES\.QC_QUEUE\(firmSlug\)/, 'Daily Operations should include QC Worklist entry when permitted');
assert.match(navSource, /ROUTES\.WORKBASKET_DETAIL\(/, 'Sidebar should link directly to workbasket detail route');
assert.match(navSource, /ROUTES\.QC_WORKBASKET_DETAIL\(/, 'Sidebar should link directly to QC workbasket detail route');

assert.match(shellSource, /workbaskets:\s*user\?\.workbaskets,\s*qcWorkbaskets:\s*user\?\.qcWorkbaskets/, 'Platform shell should pass assigned workbasket/QC scope into navigation resolver');

assert.match(protectedRoutesSource, /path="workbaskets\/:workbasketId"[\s\S]*?<ProtectedRoute requireAssignedWorkbasket>/, 'Direct workbasket route should be present and guarded');
assert.match(protectedRoutesSource, /path="qc-workbaskets\/:workbasketId"[\s\S]*?<ProtectedRoute requireAssignedQcWorkbasket>/, 'Direct QC workbasket route should be present and guarded');

assert.match(guardedRouteSource, /if\s*\(requireAssignedWorkbasket\)[\s\S]*!targetId\s*\|\|\s*!assignedIds\.has\(targetId\)/, 'Workbasket direct route should enforce assignment');
assert.match(guardedRouteSource, /if\s*\(requireAssignedQcWorkbasket\)[\s\S]*!targetId\s*\|\|\s*!assignedIds\.has\(targetId\)/, 'QC direct route should enforce assignment');

console.log('workbasketSidebarDirectLinks.test.mjs passed');
