import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const navSource = read('src/constants/platformNavigation.js');
const routesSource = read('src/constants/routes.js');
const protectedRoutesSource = read('src/routes/ProtectedRoutes.jsx');
const lazyPagesSource = read('src/routes/lazyPages.jsx');
const pageSource = read('src/pages/platform/DocketraIntelligencePage.jsx');
const apiSource = read('src/api/docketraIntelligence.api.js');
const hookSource = read('src/hooks/usePlatformDataQueries.js');
const docsSource = fs.readFileSync(path.join(root, '..', 'docs/features/docketra-intelligence.md'), 'utf8');

assert.match(
  routesSource,
  /DOCKETRA_INTELLIGENCE:\s*\(firmSlug\)\s*=>\s*`\/app\/firm\/\$\{firmSlug\}\/docketra-intelligence`/,
  'Route constant should expose Docketra Intelligence path.'
);

assert.match(
  navSource,
  /id: 'compliance-control-room'[\s\S]*id: 'docketra-intelligence'[\s\S]*id: 'workbaskets-group'/,
  'Docketra Intelligence nav item should appear directly under Compliance Control before Workbaskets.'
);
assert.ok(navSource.includes("hasAtLeastRole(normalizedRole, 'MANAGER')"), 'Navigation should restrict Docketra Intelligence to manager and above.');
assert.ok(navSource.includes('icons.intelligence'), 'Navigation should use a brain/insights style icon.');

assert.match(
  protectedRoutesSource,
  /path="docketra-intelligence"[\s\S]*<ProtectedRoute requireManagerOrAbove>[\s\S]*<DocketraIntelligencePage \/>/,
  'Docketra Intelligence route should be manager/admin/primary-admin protected.'
);
assert.ok(lazyPagesSource.includes("import('../pages/platform/DocketraIntelligencePage')"), 'Dashboard page should be lazy-loaded.');

assert.ok(apiSource.includes("api.get('/docketra-intelligence/workload'"), 'Dashboard API should call workload endpoint.');
assert.ok(hookSource.includes("queryKey: ['platform', 'docketra-intelligence', 'workload'"), 'Workload query should have a stable React Query key.');

for (const section of ['Team Capacity Overview', 'Recommended Assignment Card', 'Team Availability Table', 'Assignment Guidance']) {
  assert.ok(pageSource.includes(section), `Dashboard should render ${section}.`);
}

for (const column of ['Employee Name', 'Availability Score', 'Availability Label', 'Workload Score', 'Open Dockets', 'Overdue', 'Due Today', 'Review Queue', 'Estimated Hours', 'Actual Hours']) {
  assert.ok(pageSource.includes(column), `Availability table should include ${column}.`);
}

assert.ok(pageSource.includes('Best person to receive the next assignment'), 'Recommended card should include assignment helper text.');
assert.ok(pageSource.includes('isLoading'), 'Dashboard should handle loading state.');
assert.ok(pageSource.includes('isError'), 'Dashboard should handle error state.');
assert.ok(pageSource.includes('EmptyState'), 'Dashboard should handle empty state.');
assert.match(pageSource, /sort\(\(a,\s*b\)\s*=>\s*toNumber\(b\.availabilityScore\)\s*-\s*toNumber\(a\.availabilityScore\)\)/, 'Team table should sort by availability score descending.');

assert.ok(docsSource.includes('Manager Dashboard'), 'Docs should describe the manager dashboard.');
assert.ok(docsSource.includes('Team Availability Table'), 'Docs should document dashboard sections.');

console.log('docketraIntelligenceDashboard.test.mjs passed');
