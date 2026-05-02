#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

function testLandingNavHasNoGenericLoginCta() {
  const source = read('ui/src/components/landing/LandingPageContent.jsx');
  assert.ok(
    !source.includes('to="/login"'),
    'Landing page should not expose a generic /login CTA that can route public users to superadmin login',
  );
  assert.ok(
    source.includes('Request early access'),
    'Landing page should keep "Request early access" as the primary CTA',
  );
  console.log('  ✓ landing page removes generic login CTA and keeps Request early access');
}

function testSuperadminRouteRemainsDirectlyReachable() {
  const source = read('src/app/routes/mountPlatformRoutes.js');
  assert.ok(
    source.includes("app.post('/superadmin/login'"),
    'Superadmin direct login route must remain mounted at /superadmin/login',
  );
  console.log('  ✓ superadmin direct route remains mounted');
}

function testFirmLoginRouteRemainsDirectlyReachable() {
  const source = read('src/routes/firm.routes.js');
  assert.ok(
    source.includes("router.post('/login'"),
    'Firm login route must remain mounted on the firm route namespace',
  );
  console.log('  ✓ firm-specific login route remains mounted');
}

function run() {
  testLandingNavHasNoGenericLoginCta();
  testSuperadminRouteRemainsDirectlyReachable();
  testFirmLoginRouteRemainsDirectlyReachable();
  console.log('publicAuthEntryPoints.ui.test.js passed');
}

run();
