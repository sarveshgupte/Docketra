#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const protectedRoutes = fs.readFileSync(path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'), 'utf8');
assert.ok(
  protectedRoutes.includes('path="/app/superadmin/onboarding-insights/:firmId"'),
  'Firm onboarding drill-down route should be registered',
);
assert.ok(
  protectedRoutes.includes('<ProtectedRoute requireSuperadmin>'),
  'Firm onboarding drill-down route must remain superadmin protected',
);

const insightsPage = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminOnboardingInsightsPage.jsx'), 'utf8');
assert.ok(
  insightsPage.includes('Open onboarding detail'),
  'Triage list should include a direct firm onboarding detail action',
);
assert.ok(
  insightsPage.includes('Open impacted firm'),
  'Top blocker list should support deep-link drill-down',
);
assert.ok(
  insightsPage.includes('useSearchParams'),
  'Insights list should preserve filter state through query params',
);

const firmPage = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminFirmOnboardingDetailPage.jsx'), 'utf8');
assert.ok(
  firmPage.includes('Loading firm onboarding detail...'),
  'Firm detail page should include explicit loading state',
);
assert.ok(
  firmPage.includes('Unable to load firm onboarding detail right now. Please retry.'),
  'Firm detail page should include retry-friendly error state',
);
assert.ok(
  firmPage.includes('No firm onboarding detail found'),
  'Firm detail page should include empty state handling',
);

console.log('superadminOnboardingFirmDetailUiRouting.test.js passed');
