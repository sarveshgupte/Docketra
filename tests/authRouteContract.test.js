#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.join(__dirname, '..');
const authRoutesSource = fs.readFileSync(path.join(repoRoot, 'src', 'routes', 'auth.routes.js'), 'utf8');
const authFlowDoc = fs.readFileSync(path.join(repoRoot, 'docs', 'auth', 'AUTH_FLOW_CONTRACT.md'), 'utf8');

const canonicalEndpoints = [
  '/login/init',
  '/login/verify',
  '/signup/init',
  '/signup/verify',
  '/forgot-password/init',
  '/forgot-password/verify',
  '/forgot-password/reset',
  '/logout',
  '/refresh',
  '/profile',
];

for (const endpoint of canonicalEndpoints) {
  assert(authRoutesSource.includes(`'${endpoint}'`), `Missing canonical auth endpoint in backend routes: ${endpoint}`);
}

const legacyEndpoints = ['/forgot-password', '/send-otp', '/verify-otp', '/resend-otp'];
for (const endpoint of legacyEndpoints) {
  assert(authRoutesSource.includes(`'${endpoint}'`), `Legacy auth endpoint expected to still exist for compatibility: ${endpoint}`);
  assert(authFlowDoc.includes(endpoint), `Legacy endpoint must be documented in AUTH_FLOW_CONTRACT.md: ${endpoint}`);
}

console.log('authRouteContract.test.js passed');
