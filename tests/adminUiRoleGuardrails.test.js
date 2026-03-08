#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

function read(relativePath) {
  return fs.readFileSync(require.resolve(relativePath), 'utf8');
}

function testFirmAdminRoutesRequireAdminProtection() {
  const routerSource = read('../ui/src/Router.jsx');
  const protectedRouteSource = read('../ui/src/components/auth/ProtectedRoute.jsx');

  assert.ok(
    routerSource.includes('<ProtectedRoute requireAdmin>'),
    'admin-only firm routes should remain wrapped with the admin guard'
  );
  assert.ok(
    protectedRouteSource.includes("if (requireAdmin && !isAdmin) {"),
    'protected routes should redirect non-admin users away from admin-only pages'
  );
  assert.ok(
    protectedRouteSource.includes('return <Navigate to={`/app/firm/${effectiveFirmSlug}/dashboard`} replace />;'),
    'non-admin users should be redirected back to the dashboard on firm admin routes'
  );
  console.log('  ✓ keeps firm admin pages behind the existing admin route guard');
}

function testLayoutOnlyShowsAdminNavigationToAdmins() {
  const layoutSource = read('../ui/src/components/common/Layout.jsx');

  assert.ok(
    layoutSource.includes('const hasAdminAccess = user?.role === USER_ROLES.ADMIN;'),
    'layout should only expose admin navigation to Admin users'
  );
  assert.ok(
    layoutSource.includes('hidden: !hasAdminAccess'),
    'admin navigation entries should stay hidden for non-admin users'
  );
  console.log('  ✓ hides admin navigation for employees in the firm layout');
}

function run() {
  testFirmAdminRoutesRequireAdminProtection();
  testLayoutOnlyShowsAdminNavigationToAdmins();
  console.log('Admin UI role guardrail tests passed.');
}

run();
