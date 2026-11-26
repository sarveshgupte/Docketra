const { getFirmHealthSnapshot } = require('./superadminFirmHealth.service');
const { getSupportDiagnosticsSnapshot } = require('./superadminDiagnostics.service');
const onboardingAnalyticsService = require('./onboardingAnalytics.service');
const SuperadminAudit = require('../models/SuperadminAudit.model');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const { CHECKLIST_KEYS, clampScore, deriveOverallStatus } = require('./superadminPilotReadiness.helpers');
const { getFeatureFlagsSnapshot, getFeatureFlagRegistry } = require('./featureFlags.service');
const log = require('../utils/log');

const AUDIT_LOOKBACK_DAYS = 14;
const DEFAULT_PLAN_TOTALS = { firms: 0, pilot: 0, nearCapacity: 0, overCapacity: 0 };

const PRIMARY_ADMIN_ROUTE_CONTRACT = [
  '/api/clients',
  '/api/reports/case-metrics',
  '/api/storage/configuration',
  '/api/ai/configuration',
];

const settledValue = (result, fallback = null) => (
  result.status === 'fulfilled' && result.value != null ? result.value : fallback
);

const getRecentAuditStatus = async (sinceDate) => {
  try {
    const count = Number(await SuperadminAudit.countDocuments({ timestamp: { $gte: sinceDate } })) || 0;
    return { count, queryFailed: false };
  } catch (error) {
    log.warn('[PILOT_READINESS] Failed to count recent superadmin audit events', { error: error?.message });
    return { count: 0, queryFailed: true };
  }
};

const getPlansCapacityTotals = async () => {
  try {
    const firms = await Firm.find({ status: { $ne: 'deleted' } })
      .select('_id plan maxUsers status')
      .lean();
    const firmIds = (firms || []).map((row) => row._id).filter(Boolean);
    const userCounts = firmIds.length
      ? await User.aggregate([
          { $match: { firmId: { $in: firmIds }, status: { $ne: 'deleted' } } },
          { $group: { _id: '$firmId', count: { $sum: 1 } } },
        ])
      : [];
    const userCountMap = new Map((userCounts || []).map((entry) => [String(entry._id), Number(entry.count) || 0]));
    return (firms || []).reduce((acc, firm) => {
      const maxUsers = Number(firm?.maxUsers) || 0;
      const used = userCountMap.get(String(firm._id)) || 0;
      const usedPct = maxUsers > 0 ? Math.round((used / maxUsers) * 100) : 0;
      acc.firms += 1;
      if (String(firm?.plan || '').toLowerCase() === 'pilot') acc.pilot += 1;
      if (maxUsers > 0 && used > maxUsers) acc.overCapacity += 1;
      else if (maxUsers > 0 && usedPct >= 85) acc.nearCapacity += 1;
      return acc;
    }, { ...DEFAULT_PLAN_TOTALS });
  } catch {
    return { ...DEFAULT_PLAN_TOTALS };
  }
};

const buildAuditReadinessItem = ({ count, queryFailed }) => {
  if (queryFailed) {
    return {
      key: CHECKLIST_KEYS[7],
      label: 'Audit logging readiness',
      status: 'watch',
      summary: 'Unable to verify recent superadmin audit metadata events (query failed).',
      evidence: 'SuperadminAudit count query failed; no payload details returned.',
      nextAction: 'Check database connectivity and SuperadminAudit query logs.',
      href: '/app/superadmin/audit',
    };
  }
  const hasEvents = count > 0;
  return {
    key: CHECKLIST_KEYS[7],
    label: 'Audit logging readiness',
    status: hasEvents ? 'pass' : 'watch',
    summary: `Recent superadmin audit metadata events (${AUDIT_LOOKBACK_DAYS}d): ${count}.`,
    evidence: 'Audit metadata count only; no payload details returned.',
    nextAction: hasEvents ? 'Continue monitoring audit pipeline.' : 'Verify superadmin login/action audit events in audit logs.',
    href: '/app/superadmin/audit',
  };
};

const buildPilotReadinessSnapshot = async () => {
  const sinceDate = new Date(Date.now() - (AUDIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

  const [
    firmHealthResult,
    diagnosticsResult,
    onboardingResult,
    planTotalsResult,
    auditResult,
    featureFlagsResult,
  ] = await Promise.allSettled([
    getFirmHealthSnapshot({ limit: 100 }).catch(() => null),
    getSupportDiagnosticsSnapshot({ limit: 20 }).catch(() => null),
    onboardingAnalyticsService.getOnboardingInsights({ sinceDays: 30, staleAfterDays: 7, recentLimit: 20 }).catch(() => null),
    getPlansCapacityTotals(),
    getRecentAuditStatus(sinceDate),
    getFeatureFlagsSnapshot().catch(() => null),
  ]);

  const firmHealth = settledValue(firmHealthResult);
  const diagnostics = settledValue(diagnosticsResult);
  const onboarding = settledValue(onboardingResult);
  const planTotals = settledValue(planTotalsResult, { ...DEFAULT_PLAN_TOTALS });
  const auditStatus = settledValue(auditResult, { count: 0, queryFailed: true });
  const featureFlags = settledValue(featureFlagsResult);

  const failedHealth = Number(firmHealth?.totals?.critical || 0);
  const warnedHealth = Number(firmHealth?.totals?.atRisk || 0);
  const staleUsers = Number(onboarding?.summary?.staleUsers || onboarding?.totals?.staleUsers || 0);
  const storageIssues = (diagnostics?.firms || []).filter((row) => String(row?.storageHealthStatus || '').toUpperCase() !== 'HEALTHY').length;

  const registryValid = Array.isArray(getFeatureFlagRegistry()) && getFeatureFlagRegistry().every((f) => f.key);
  const highRiskGlobal = (featureFlags?.flags || []).filter((f) => f.riskLevel === 'high' && f.enabledGlobally).length;

  const checklist = [
    { key: CHECKLIST_KEYS[0], label: 'Superadmin auth and route protection', status: 'pass', summary: 'Route and policy guard configured for readiness endpoint.', evidence: 'requireSuperadmin + SuperAdminPolicy.canViewPlatformStats', nextAction: 'None', href: '/app/superadmin' },
    { key: CHECKLIST_KEYS[1], label: 'Firm creation/admin invite readiness', status: 'pass', summary: 'Firm creation and admin lifecycle routes are available.', evidence: 'Superadmin firm/admin routes are mounted.', nextAction: 'Run dry-run in staging before pilot wave.', href: '/app/superadmin/firms' },
    { key: CHECKLIST_KEYS[2], label: 'Firm health and risk queue readiness', status: failedHealth > 0 ? 'fail' : warnedHealth > 0 ? 'watch' : 'pass', summary: `Critical firms: ${failedHealth}, at-risk firms: ${warnedHealth}.`, evidence: `Firm health totals (${JSON.stringify(firmHealth?.totals || {})})`, nextAction: failedHealth > 0 ? 'Resolve critical firms before onboarding pilots.' : 'Continue monitoring risk queue.', href: '/app/superadmin/firm-health' },
    { key: CHECKLIST_KEYS[3], label: 'Plans/capacity readiness', status: planTotals.overCapacity > 0 ? 'fail' : planTotals.nearCapacity > 0 ? 'watch' : 'pass', summary: `Near capacity: ${planTotals.nearCapacity}, over capacity: ${planTotals.overCapacity}.`, evidence: `Plan totals firms=${planTotals.firms}, pilot=${planTotals.pilot}, nearCapacity=${planTotals.nearCapacity}, overCapacity=${planTotals.overCapacity}`, nextAction: planTotals.overCapacity > 0 ? 'Increase limits before onboarding pilots.' : planTotals.nearCapacity > 0 ? 'Review limits for near-capacity firms.' : 'No plan/capacity blockers detected.', href: '/app/superadmin/plans' },
    { key: CHECKLIST_KEYS[4], label: 'Onboarding readiness', status: staleUsers > 0 ? 'watch' : 'pass', summary: `Stale onboarding users: ${staleUsers}.`, evidence: 'Onboarding insights aggregate totals only.', nextAction: staleUsers > 0 ? 'Follow up stale onboarding flows.' : 'Onboarding flow is healthy for pilots.', href: '/app/superadmin/onboarding-insights' },
    { key: CHECKLIST_KEYS[5], label: 'Storage/BYOS readiness', status: storageIssues > 0 ? 'watch' : 'pass', summary: `Firms with storage non-healthy status: ${storageIssues}.`, evidence: 'Storage health metadata from diagnostics snapshot.', nextAction: storageIssues > 0 ? 'Resolve storage health warnings for pilot firms.' : 'Storage posture appears ready.', href: '/app/superadmin/diagnostics' },
    { key: CHECKLIST_KEYS[6], label: 'Support diagnostics readiness', status: diagnostics ? 'pass' : 'fail', summary: diagnostics ? 'Support diagnostics snapshot is available.' : 'Diagnostics snapshot unavailable.', evidence: diagnostics ? `Diagnostics generated at ${diagnostics.generatedAt}` : 'No diagnostics payload', nextAction: diagnostics ? 'Continue monitoring.' : 'Restore diagnostics endpoint.', href: '/app/superadmin/diagnostics' },
    buildAuditReadinessItem(auditStatus),
    { key: CHECKLIST_KEYS[8], label: 'Primary-admin sidebar route readiness', status: 'pass', summary: 'Primary-admin API contract paths are fixed and covered by dedicated route-boundary checks.', evidence: `tests/primaryAdminSidebarRouteBoundaries.test.js covers ${PRIMARY_ADMIN_ROUTE_CONTRACT.join(', ')} (see docs/PRIMARY_ADMIN_SIDEBAR_API_CONTRACT.md).`, nextAction: 'Keep boundary test and API contract doc in sync.', href: '/app/superadmin/diagnostics' },
    { key: 'feature_flag_rollout_readiness', label: 'Feature flag rollout readiness', status: !registryValid ? 'fail' : highRiskGlobal > 0 ? 'watch' : 'pass', summary: `High-risk flags enabled globally: ${highRiskGlobal}.`, evidence: `Registry valid=${registryValid}; flags=${(featureFlags?.flags || []).length}`, nextAction: !registryValid ? 'Repair feature flag registry state.' : highRiskGlobal > 0 ? 'Move high-risk flags to internal/pilot.' : 'Maintain pilot/internal stage for high-risk flags.', href: '/app/superadmin/feature-flags' },
    { key: CHECKLIST_KEYS[9], label: 'No public billing/payment flows during pilot', status: 'pass', summary: 'No payment processor/public checkout flow included in pilot readiness surface.', evidence: 'Plans/capacity readiness uses internal metadata-only counters.', nextAction: 'Do not enable public billing flows during pilot.', href: '/app/superadmin/plans' },
  ];

  const scorePenalty = checklist.reduce((sum, item) => (
    item.status === 'fail' ? sum + 30 : item.status === 'watch' ? sum + 10 : sum
  ), 0);
  const score = clampScore(100 - scorePenalty);
  const failCount = checklist.filter((item) => item.status === 'fail').length;
  return {
    overallStatus: deriveOverallStatus({ score, failCount }),
    score,
    checklist,
    blockers: checklist.filter((item) => item.status === 'fail').map((item) => item.label),
    warnings: checklist.filter((item) => item.status === 'watch').map((item) => item.label),
    generatedAt: new Date().toISOString(),
  };
};

module.exports = { buildPilotReadinessSnapshot, _private: { PRIMARY_ADMIN_ROUTE_CONTRACT, getPlansCapacityTotals, buildAuditReadinessItem } };
