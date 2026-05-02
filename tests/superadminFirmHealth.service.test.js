const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const firms = [
  { _id: '1', firmId: 'FIRM001', firmSlug: 'a', name: 'A', status: 'active', createdAt: new Date('2026-01-03') },
  { _id: '2', firmId: 'FIRM002', firmSlug: 'b', name: 'B', status: 'inactive', createdAt: new Date('2026-01-02') },
  { _id: '3', firmId: 'FIRM003', firmSlug: 'c', name: 'C', status: 'active', createdAt: new Date('2026-01-01') },
];

Module._load = function patched(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return { find: () => ({ select: () => ({ sort: () => ({ lean: async () => firms }) }) }) };
  }
  if (request === '../models/User.model') {
    return { aggregate: async () => [{ _id: '1', total: 1, verified: 1 }, { _id: '2', total: 0, verified: 0 }, { _id: '3', total: 1, verified: 0 }] };
  }
  if (request === '../models/TenantStorageHealth.model') {
    return { find: () => ({ select: () => ({ lean: async () => [{ tenantId: '1', status: 'HEALTHY' }, { tenantId: '2', status: 'DEGRADED' }, { tenantId: '3', status: 'UNKNOWN' }] }) }) };
  }
  if (request === './onboardingAnalytics.service') {
    return { getOnboardingInsightDetails: async () => ({ firms: [
      { firmId: '1', staleUsers: 0, incompleteUsers: 0, nextAction: 'Healthy' },
      { firmId: '2', staleUsers: 3, incompleteUsers: 4, nextAction: 'Escalate' },
      { firmId: '3', staleUsers: 2, incompleteUsers: 1, nextAction: 'Follow up' },
    ] }) };
  }
  return originalLoad.apply(this, arguments);
};

const service = require('../src/services/superadminFirmHealth.service');
Module._load = originalLoad;

(async () => {
  const all = await service.getFirmHealthSnapshot({ limit: 2 });
  assert.strictEqual(all.totals.firms, 3, 'totals should be based on overall matched firms');
  assert.strictEqual(all.firms.length, 2, 'final rows should be limited after scoring/filtering');

  const criticalOnly = await service.getFirmHealthSnapshot({ status: 'critical', limit: 10 });
  assert.strictEqual(criticalOnly.totals.firms, 3, 'status filter must not change overall totals');
  assert.ok(criticalOnly.firms.every((row) => row.riskLevel === 'critical'), 'status filter should apply to queue rows only');

  const capped = await service.getFirmHealthSnapshot({ limit: 9999 });
  assert.ok(capped.firms.length <= 100, 'service must cap limit to 100');

  assert.strictEqual(service._private.clampScore(140), 100);
  assert.strictEqual(service._private.clampScore(-3), 0);
  assert.strictEqual(service._private.toRiskLevel(95), 'healthy');
  assert.strictEqual(service._private.toRiskLevel(45), 'at_risk');
  console.log('superadminFirmHealth.service.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
