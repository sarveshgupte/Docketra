#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function run() {
  console.log('Running uiFirmShellConsistency.test.js...');

  const routeLoadingShellSource = read('ui/src/components/routing/RouteLoadingShell.jsx');
  assert.ok(
    routeLoadingShellSource.includes("return <PlatformRouteLoadingShell />;") && routeLoadingShellSource.includes("pathname.startsWith('/app/firm/')"),
    'Firm-scoped suspense fallback must use PlatformRouteLoadingShell'
  );
  assert.ok(
    !routeLoadingShellSource.includes("from '../common/Layout'"),
    'RouteLoadingShell must not import legacy Layout for suspense fallbacks'
  );
  console.log('✅ firm route loading fallback is platform-consistent');

  const platformFallbackSource = read('ui/src/components/routing/PlatformRouteLoadingShell.jsx');
  assert.ok(
    platformFallbackSource.includes('aria-busy="true"') && platformFallbackSource.includes('Loading workspace page'),
    'Platform route loading shell should preserve accessible busy semantics'
  );
  console.log('✅ platform loading shell keeps accessible loading semantics');

  const protectedRoutesSource = read('ui/src/routes/ProtectedRoutes.jsx');
  assert.ok(
    protectedRoutesSource.includes('path="dashboard"') && protectedRoutesSource.includes('<PlatformDashboardPage />'),
    'Firm dashboard route should resolve to PlatformDashboardPage'
  );
  console.log('✅ firm dashboard route resolves through the platform page');

  console.log('✅ uiFirmShellConsistency.test.js passed');
}

run();
