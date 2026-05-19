import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const dashboardSource = read('src/pages/platform/DashboardPage.jsx');
const whatsNewSource = read('../docs/whats-new.md');

assert.ok(dashboardSource.includes('<PlatformShell'), 'Dashboard should keep PlatformShell root.');
assert.ok(dashboardSource.includes('Today’s command center'), 'Dashboard should include command-center framing.');
assert.ok(dashboardSource.includes('Operational health'), 'Dashboard should include operational health strip heading.');
assert.ok(dashboardSource.includes('Needs attention'), 'Dashboard should include needs-attention structure.');
assert.ok(dashboardSource.includes('Next best action'), 'Dashboard should include next best action structure.');
assert.equal(dashboardSource.includes('title="Modules"'), false, 'Dashboard should remove old generic Modules launchpad framing.');

for (const routeRef of [
  'ROUTES.CREATE_CASE(firmSlug)',
  'ROUTES.WORKLIST(firmSlug)',
  'ROUTES.GLOBAL_WORKLIST(firmSlug)',
  'ROUTES.QC_QUEUE(firmSlug)',
  'ROUTES.DOCKETS(firmSlug)',
  'ROUTES.CLIENTS(firmSlug)',
  'ROUTES.SETTINGS(firmSlug)',
]) {
  assert.ok(dashboardSource.includes(routeRef), `Dashboard quick actions should reference ${routeRef}.`);
}

assert.equal(dashboardSource.includes('productivityScore || 62'), false, 'Dashboard should not use hardcoded fake default productivity counts.');
assert.equal(dashboardSource.includes('No recent docket activity yet.'), false, 'Dashboard should not render static recent activity copy without real data.');
assert.equal(dashboardSource.includes('style={{ margin'), false, 'Dashboard should avoid inline margin layout styles.');
assert.equal(dashboardSource.includes('style={{ padding'), false, 'Dashboard should avoid inline padding layout styles.');
assert.ok(dashboardSource.includes('<StatusMessageStack'), 'Dashboard should keep StatusMessageStack.');

assert.ok(whatsNewSource.includes('Simplified dashboard command center'), 'Whats-new should include dashboard command center entry.');

console.log('dashboardCommandCenter.test.mjs passed');
