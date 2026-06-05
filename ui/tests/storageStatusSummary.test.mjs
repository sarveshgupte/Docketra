import assert from 'node:assert/strict';
import { buildStorageStatusSummary } from '../src/hooks/storageStatusSummaryLogic.js';

const managedSummary = buildStorageStatusSummary(
  'demo-firm',
  {
    provider: 'docketra_managed',
    isConfigured: true,
    status: 'ACTIVE_MANAGED',
  },
  {
    activeStorage: {
      provider: 'docketra_managed',
      connectionStatus: 'ACTIVE_MANAGED',
    },
    lastHealthCheck: {
      status: 'ACTIVE_MANAGED',
    },
  },
  {
    status: 'recovery_required',
  },
  null,
);

assert.equal(managedSummary.badgeLabel, 'Docketra-managed storage');
assert.equal(managedSummary.needsAttention, false);

const byosRecoverySummary = buildStorageStatusSummary(
  'demo-firm',
  {
    provider: 'google_drive',
    isConfigured: true,
    status: 'ACTIVE_BYOS',
  },
  {
    activeStorage: {
      provider: 'google_drive',
      connectionStatus: 'ACTIVE_BYOS',
    },
    lastHealthCheck: {
      status: 'ACTIVE_BYOS',
    },
  },
  {
    status: 'recovery_required',
    message: 'Docketra could not verify your firm-owned Google Drive root.',
  },
  null,
);

assert.equal(byosRecoverySummary.badgeLabel, 'Storage needs attention');
assert.equal(byosRecoverySummary.needsAttention, true);
assert.equal(byosRecoverySummary.helperText, 'Google Drive root recovery required');

const uppercaseRootRecoverySummary = buildStorageStatusSummary(
  'demo-firm',
  {
    provider: 'google_drive',
    isConfigured: true,
    status: 'ACTIVE_BYOS',
  },
  {
    activeStorage: {
      provider: 'google_drive',
      connectionStatus: 'ACTIVE_BYOS',
    },
  },
  {
    status: 'RECOVERY_REQUIRED',
  },
  null,
);

assert.equal(uppercaseRootRecoverySummary.badgeLabel, 'Storage needs attention');
assert.equal(uppercaseRootRecoverySummary.needsAttention, true);

console.log('storageStatusSummary.test.mjs passed');
