import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { shouldRefreshOnboardingProgress } from '../src/utils/onboardingProgressRefresh.js';

const shouldRefreshSamples = [
  { method: 'post', url: '/admin/clients' },
  { method: 'put', url: '/admin/firm-settings' },
  { method: 'post', url: '/firm/storage/change' },
  { method: 'post', url: '/admin/categories/abc/subcategories' },
  { method: 'post', url: '/admin/workbaskets' },
  { method: 'patch', url: '/admin/users/U00001/workbaskets' },
  { method: 'post', url: '/dockets' },
  { method: 'post', url: '/dockets/DOCKET-1/route' },
  { method: 'patch', url: '/dockets/DOCKET-1/assign' },
];

for (const sample of shouldRefreshSamples) {
  assert.equal(
    shouldRefreshOnboardingProgress(sample),
    true,
    `Expected onboarding refresh for ${sample.method.toUpperCase()} ${sample.url}`,
  );
}

const shouldNotRefreshSamples = [
  { method: 'get', url: '/dashboard/onboarding-progress' },
  { method: 'get', url: '/clients' },
  { method: 'post', url: '/auth/login' },
  { method: 'patch', url: '/users/preferences' },
];

for (const sample of shouldNotRefreshSamples) {
  assert.equal(
    shouldRefreshOnboardingProgress(sample),
    false,
    `Did not expect onboarding refresh for ${sample.method.toUpperCase()} ${sample.url}`,
  );
}

const apiSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.js'), 'utf8');
assert.ok(
  apiSource.includes('shouldRefreshOnboardingProgress'),
  'API response interceptor should evaluate whether onboarding progress must refresh',
);
assert.ok(
  apiSource.includes('emitOnboardingProgressRefresh'),
  'API response interceptor should emit onboarding refresh events after relevant mutations',
);

const dashboardPageSource = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/DashboardPage.jsx'), 'utf8');
assert.ok(
  dashboardPageSource.includes('ONBOARDING_PROGRESS_REFRESH_EVENT'),
  'Dashboard should subscribe to onboarding refresh events',
);
assert.ok(
  dashboardPageSource.includes('refreshOnboardingProgress'),
  'Dashboard should use a dedicated onboarding refresh helper for initial loads and events',
);

console.log('onboardingProgressRefresh.test.mjs passed');
