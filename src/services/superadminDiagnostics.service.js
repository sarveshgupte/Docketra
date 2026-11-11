const Firm = require('../models/Firm.model');
const AuthAudit = require('../models/AuthAudit.model');
const TenantStorageHealth = require('../models/TenantStorageHealth.model');
const onboardingAnalyticsService = require('./onboardingAnalytics.service');
const metricsService = require('./metrics.service');
const { getDashboardSnapshot } = require('../utils/operationalMetrics');

const OTP_FAILURE_ACTIONS = new Set(['OTP_FAILED', 'LOGIN_FAILED', 'LoginFailed', 'LOGIN_FAILURE', 'AccountLocked']);

const toStatusCategory = (statusCode) => {
  const code = Number.parseInt(statusCode, 10);
  if (!Number.isFinite(code)) return 'unknown';
  if (code === 401 || code === 403) return 'auth';
  if (code === 404) return 'not_found';
  if (code === 429) return 'rate_limit';
  if (code >= 400 && code < 500) return 'client';
  if (code >= 500) return 'server';
  return 'unknown';
};

const redactReasonCode = (metadata) => {
  const code = metadata?.reasonCode || metadata?.code || metadata?.failureReason || metadata?.otpIssue;
  if (!code) return 'UNKNOWN';
  return String(code).toUpperCase().replace(/[^A-Z0-9_:-]/g, '_').slice(0, 64);
};

const redactFailure = (entry) => ({
  timestamp: entry.timestamp,
  actionType: entry.actionType,
  reasonCode: redactReasonCode(entry.metadata),
  requestId: entry.requestId || entry.metadata?.requestId || null,
});

const buildApiErrorSummary = (metricsSnapshot) => {
  const errors = metricsSnapshot?.errors || {};
  const categoryCounts = {
    auth: 0,
    client: 0,
    not_found: 0,
    rate_limit: 0,
    server: 0,
    unknown: 0,
  };

  for (const [statusCode, count] of Object.entries(errors)) {
    const category = toStatusCategory(statusCode);
    categoryCounts[category] = (categoryCounts[category] || 0) + Number(count || 0);
  }

  return Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
};

const mapStorageStatus = (firm, healthMap) => {
  const health = healthMap.get(String(firm._id)) || healthMap.get(firm.firmId) || null;
  return {
    firmId: String(firm._id),
    firmCode: firm.firmId,
    firmName: firm.name,
    firmStatus: firm.status,
    storageMode: firm.storage?.mode || 'docketra_managed',
    storageProvider: firm.storage?.provider || 'docketra',
    storageHealthStatus: health?.status || (firm.storage?.mode === 'firm_connected' ? 'UNKNOWN' : 'HEALTHY'),
    storageLastVerifiedAt: health?.lastVerifiedAt || null,
  };
};

const getSupportDiagnosticsSnapshot = async ({ limit = 15 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 15, 5), 30);

  const [firms, onboardingDetails, recentAuthFailures, metricsSnapshot, storageHealthRows, operationalHealth] = await Promise.all([
    Firm.find({ status: { $ne: 'deleted' } })
      .select('_id firmId name status storage.mode storage.provider createdAt')
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean(),
    onboardingAnalyticsService.getOnboardingInsightDetails({
      sinceDays: 30,
      staleAfterDays: 7,
      completionState: 'all',
      limit: safeLimit,
    }),
    AuthAudit.find({ actionType: { $in: Array.from(OTP_FAILURE_ACTIONS) } })
      .select('timestamp actionType metadata requestId')
      .sort({ timestamp: -1 })
      .limit(20)
      .lean(),
    metricsService.getSnapshot(),
    TenantStorageHealth.find({})
      .select('tenantId status lastVerifiedAt')
      .lean(),
    Promise.resolve(getDashboardSnapshot()),
  ]);

  const healthMap = new Map(storageHealthRows.map((row) => [String(row.tenantId), row]));
  const firmRows = firms.map((firm) => mapStorageStatus(firm, healthMap));

  const onboardingByFirm = new Map((onboardingDetails?.firms || []).map((firm) => [String(firm.firmId), firm]));
  const firmsWithOnboarding = firmRows.map((firm) => {
    const onboarding = onboardingByFirm.get(String(firm.firmId));
    return {
      ...firm,
      onboarding: onboarding
        ? {
          incompleteUsers: onboarding.incompleteUsers || 0,
          staleUsers: onboarding.staleUsers || 0,
          blockers: Array.isArray(onboarding.blockers) ? onboarding.blockers.slice(0, 4) : [],
          nextAction: onboarding.nextAction || 'Healthy',
        }
        : {
          incompleteUsers: 0,
          staleUsers: 0,
          blockers: [],
          nextAction: 'Unknown',
        },
    };
  });

  const redactedFailures = recentAuthFailures.map(redactFailure);
  const requestIds = Array.from(new Set([
    ...redactedFailures.map((row) => row.requestId).filter(Boolean),
    ...operationalHealth.map((row) => row?.lastError?.requestId).filter(Boolean),
    ...operationalHealth.map((row) => row?.lastInvariantViolation?.requestId).filter(Boolean),
    ...operationalHealth.map((row) => row?.lastRateLimit?.requestId).filter(Boolean),
  ])).slice(0, 50);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      firmsInScope: firms.length,
      firmsNeedingOnboardingFollowUp: firmsWithOnboarding.filter((row) => row.onboarding.nextAction !== 'Healthy').length,
    },
    firms: firmsWithOnboarding,
    loginAndOtpIssues: redactedFailures,
    apiErrorCountsByCategory: buildApiErrorSummary(metricsSnapshot),
    slowEndpointSummary: {
      p50Ms: metricsSnapshot?.latency?.p50 || null,
      p95Ms: metricsSnapshot?.latency?.p95 || null,
      sampleCount: metricsSnapshot?.latency?.samples || 0,
    },
    requestIds,
  };
};

module.exports = {
  getSupportDiagnosticsSnapshot,
  _private: {
    redactFailure,
    buildApiErrorSummary,
  },
};
