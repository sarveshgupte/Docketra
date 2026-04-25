import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const protectedRoutesSource = read('src/routes/ProtectedRoutes.jsx');
const casesPageSource = read('src/pages/CasesPage.jsx');
const platformShellSource = read('src/components/platform/PlatformShell.jsx');
const dashboardSource = read('src/pages/platform/DashboardPage.jsx');
const worklistSource = read('src/pages/platform/WorklistPage.jsx');

assert.ok(
  protectedRoutesSource.includes('path="dockets"'),
  'Protected route map must include canonical dockets route.'
);
assert.ok(
  protectedRoutesSource.includes('<ProtectedRoute>\n              <CasesPage />\n            </ProtectedRoute>'),
  'Dockets route should render CasesPage directly so page-level inline errors stay inside shell.'
);
assert.ok(
  protectedRoutesSource.includes('path="cases"')
    && protectedRoutesSource.includes('element={<Navigate to="../dockets" replace />}'),
  'Legacy /cases route must redirect to canonical /dockets path.'
);
assert.ok(
  protectedRoutesSource.includes('path="cases/create"')
    && protectedRoutesSource.includes('element={<Navigate to="../dockets/create" replace />}'),
  'Legacy /cases/create route must redirect to canonical /dockets/create path.'
);
assert.ok(
  protectedRoutesSource.includes('path="cases/:caseId"')
    && protectedRoutesSource.includes('LegacyCaseDetailRedirect'),
  'Legacy /cases/:caseId route must redirect to canonical /dockets/:caseId path.'
);

assert.ok(
  casesPageSource.includes('title="Dockets"'),
  'Cases page should render in PlatformShell with explicit docket title to keep browser title stable.'
);
assert.ok(
  casesPageSource.includes('Unable to load docket registry. Retry to fetch the latest queue data.'),
  'Cases page should expose inline, recoverable fetch failure state.'
);
assert.ok(
  casesPageSource.includes('await refetchCases();'),
  'Cases page should keep a retry action for failed docket fetches.'
);

assert.ok(
  platformShellSource.includes('document.title = `${resolvedTitle} • Docketra`;'),
  'PlatformShell must manage document title for unified workspace pages such as Dockets.'
);
assert.ok(
  dashboardSource.includes('ROUTES.DOCKETS(firmSlug)'),
  'Dashboard entry point must navigate to canonical dockets route.'
);
assert.ok(
  worklistSource.includes('?returnTo=${encodeURIComponent(`${location.pathname}${location.search ||'),
  'Worklist entry point must navigate to canonical docket detail route.'
);

console.log('docketsRouteReliability.test.mjs passed');
