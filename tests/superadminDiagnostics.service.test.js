#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return {
      find: () => ({
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => ([
                { _id: 'f1', firmId: 'FIRM001', name: 'Firm One', status: 'active', storage: { mode: 'firm_connected', provider: 's3' } },
              ]),
            }),
          }),
        }),
      }),
    };
  }
  if (request === '../models/AuthAudit.model') {
    return {
      find: () => ({
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => ([
                {
                  timestamp: new Date('2026-04-24T10:00:00.000Z'),
                  actionType: 'LOGIN_FAILED',
                  requestId: 'req-auth-1',
                  metadata: {
                    reasonCode: 'otp_mismatch',
                    otp: '123456',
                    rawPayload: { secret: 'nope' },
                  },
                },
              ]),
            }),
          }),
        }),
      }),
    };
  }
  if (request === '../models/TenantStorageHealth.model') {
    return {
      find: () => ({
        select: () => ({
          lean: async () => ([{ tenantId: 'f1', status: 'DEGRADED', lastVerifiedAt: new Date('2026-04-24T08:00:00.000Z') }]),
        }),
      }),
    };
  }
  if (request === './onboardingAnalytics.service') {
    return {
      getOnboardingInsightDetails: async () => ({
        firms: [{ firmId: 'f1', incompleteUsers: 2, staleUsers: 1, blockers: ['stale_onboarding'], nextAction: 'Needs follow-up' }],
      }),
    };
  }
  if (request === './metrics.service') {
    return {
      getSnapshot: async () => ({
        errors: { '401': 2, '500': 3, '429': 1 },
        latency: { p50: 45, p95: 280, samples: 16 },
      }),
    };
  }
  if (request === '../utils/operationalMetrics') {
    return {
      getDashboardSnapshot: () => ([{ lastError: { requestId: 'req-api-9' } }]),
    };
  }

  return originalLoad.apply(this, arguments);
};

(async () => {
  try {
    delete require.cache[require.resolve('../src/services/superadminDiagnostics.service')];
    const service = require('../src/services/superadminDiagnostics.service');
    const snapshot = await service.getSupportDiagnosticsSnapshot({ limit: 10 });

    assert.strictEqual(snapshot.firms.length, 1, 'should return firm diagnostics rows');
    assert.strictEqual(snapshot.loginAndOtpIssues.length, 1, 'should include redacted login/otp failures');
    assert.strictEqual(snapshot.loginAndOtpIssues[0].reasonCode, 'OTP_MISMATCH', 'should normalize reason code');
    assert.strictEqual(snapshot.loginAndOtpIssues[0].otp, undefined, 'should not expose OTP values');
    assert.ok(snapshot.apiErrorCountsByCategory.some((row) => row.category === 'server' && row.count === 3), 'should summarize API errors by category');
    assert.ok(snapshot.requestIds.includes('req-auth-1'), 'should include auth request id');
    assert.ok(snapshot.requestIds.includes('req-api-9'), 'should include operational request id');

    console.log('superadminDiagnostics.service.test.js passed');
  } finally {
    Module._load = originalLoad;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
