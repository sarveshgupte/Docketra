import assert from 'node:assert/strict';
import { loadPlatformOverviewData } from '../src/utils/platformOverviewLoader.js';

const stats = await loadPlatformOverviewData({
  getPlatformStats: async () => ({ success: true, data: { totalFirms: 2 } }),
  getOnboardingInsights: async () => {
    throw new Error('optional endpoint failed');
  },
});

assert.equal(stats.statsResponse.success, true, 'stats response should still return');
assert.equal(stats.statsResponse.data.totalFirms, 2);
assert.equal(stats.onboardingResponse, null, 'optional insights failure should be non-blocking');

const both = await loadPlatformOverviewData({
  getPlatformStats: async () => ({ success: true, data: { totalFirms: 3 } }),
  getOnboardingInsights: async () => ({ success: true, data: { blockers: { usersWithoutAssignedDockets: 1 } } }),
});

assert.equal(both.statsResponse.data.totalFirms, 3);
assert.equal(both.onboardingResponse.success, true);
assert.equal(both.onboardingResponse.data.blockers.usersWithoutAssignedDockets, 1);

console.log('platformOverviewLoader.test.mjs passed');
