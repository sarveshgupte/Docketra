import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const protectedRoutesSource = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/ProtectedRoutes.jsx'), 'utf8');

const superadminRoutes = [
  'path="/app/superadmin"',
  'path="/app/superadmin/firms"',
  'path="/app/superadmin/diagnostics"',
  'path="/app/superadmin/onboarding-insights"',
  'path="/app/superadmin/onboarding-insights/:firmId"',
  'path="/app/superadmin/firms/:firmId"',
];

const suspenseGroupStart = protectedRoutesSource.indexOf('<Route element={<RouteSuspenseOutlet />}>');
const dashboardRouteStart = protectedRoutesSource.indexOf('path="/app/dashboard"');

assert.notStrictEqual(suspenseGroupStart, -1, 'Protected superadmin routes should be wrapped in RouteSuspenseOutlet.');
assert.notStrictEqual(dashboardRouteStart, -1, 'Dashboard route marker should exist for superadmin route boundary checks.');

for (const route of superadminRoutes) {
  const routeIndex = protectedRoutesSource.indexOf(route);
  assert.notStrictEqual(routeIndex, -1, `${route} should remain defined.`);
  assert.ok(
    routeIndex > suspenseGroupStart && routeIndex < dashboardRouteStart,
    `${route} should be inside the superadmin RouteSuspenseOutlet group.`,
  );
}

console.log('superadminRouteSuspense.test.mjs passed');
