#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const superadminRoutes = fs.readFileSync(path.resolve(__dirname, '../src/routes/superadmin.routes.js'), 'utf8');
assert.ok(
  superadminRoutes.includes("router.get('/onboarding-insights', authorize(SuperAdminPolicy.canViewPlatformStats), getOnboardingInsights);"),
  'Onboarding insights endpoint must be superadmin-authorized',
);
assert.ok(
  superadminRoutes.includes("router.get('/onboarding-insights/details', authorize(SuperAdminPolicy.canViewPlatformStats), getOnboardingInsightDetails);"),
  'Onboarding insight details endpoint must be superadmin-authorized',
);

const dashboardRoutes = fs.readFileSync(path.resolve(__dirname, '../src/routes/dashboard.routes.js'), 'utf8');
assert.ok(
  dashboardRoutes.includes("router.post('/onboarding-event'"),
  'Dashboard onboarding event ingestion endpoint should exist for authenticated firm users',
);

console.log('onboardingInsights.permission.test.js passed');
