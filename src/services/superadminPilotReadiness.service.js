const { getFirmHealthSnapshot } = require('./superadminFirmHealth.service');
const { getSupportDiagnosticsSnapshot } = require('./superadminDiagnostics.service');
const onboardingAnalyticsService = require('./onboardingAnalytics.service');
const SuperadminAudit = require('../models/SuperadminAudit.model');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const { CHECKLIST_KEYS, clampScore, deriveOverallStatus } = require('./superadminPilotReadiness.helpers');

const PRIMARY_ADMIN_ROUTE_CONTRACT = [
  '/api/clients',
  '/api/reports/case-metrics',
  '/api/storage/configuration',
  '/api/ai/configuration',
];

const getPlansCapacityTotals = async () => {
  const firms = await Firm.find({ status: { $ne: 'deleted' } })
    .select('_id plan maxUsers status')
    .lean();
  const firmIds = firms.map((row) => row._id);
  const userCounts = firmIds.length
    ? await User.aggregate([{ $match: { firmId: { $in: firmIds }, status: { $ne: 'deleted' } } }, { $group: { _id: '$firmId', count: { $sum: 1 } } }])
    : [];
  const userCountMap = new Map(userCounts.map((entry) => [String(entry._id), Number(entry.count) || 0]));
  return firms.reduce((acc, firm) => {
    const maxUsers = Number(firm?.maxUsers) || 0;
    const used = userCountMap.get(String(firm._id)) || 0;
    const usedPct = maxUsers > 0 ? Math.round((used / maxUsers) * 100) : 0;
    acc.firms += 1;
    if (String(firm.plan || '').toLowerCase() === 'pilot') acc.pilot += 1;
    if (maxUsers > 0 && used > maxUsers) acc.overCapacity += 1;
    else if (maxUsers > 0 && usedPct >= 85) acc.nearCapacity += 1;
    return acc;
  }, { firms: 0, pilot: 0, nearCapacity: 0, overCapacity: 0 });
};

const buildPilotReadinessSnapshot = async () => {
  const [firmHealth, diagnostics, onboarding, planTotals, recentAuditCount] = await Promise.all([
    getFirmHealthSnapshot({ limit: 100 }),
    getSupportDiagnosticsSnapshot({ limit: 20 }),
    onboardingAnalyticsService.getOnboardingInsights({ sinceDays: 30, staleAfterDays: 7, recentLimit: 20 }),
    getPlansCapacityTotals(),
    SuperadminAudit.countDocuments({ createdAt: { $gte: new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)) } }),
  ]);

  const failedHealth = Number(firmHealth?.totals?.critical || 0);
  const warnedHealth = Number(firmHealth?.totals?.atRisk || 0);
  const staleUsers = Number(onboarding?.summary?.staleUsers || onboarding?.totals?.staleUsers || 0);
  const storageIssues = (diagnostics?.firms || []).filter((row) => String(row?.storageHealthStatus || '').toUpperCase() !== 'HEALTHY').length;

  const checklist = [
    { key: CHECKLIST_KEYS[0], label: 'Superadmin auth and route protection', status: 'pass', summary: 'Route and policy guard configured for readiness endpoint.', evidence: 'requireSuperadmin + SuperAdminPolicy.canViewPlatformStats', nextAction: 'None', href: '/app/superadmin' },
    { key: CHECKLIST_KEYS[1], label: 'Firm creation/admin invite readiness', status: 'pass', summary: 'Firm creation and admin lifecycle routes are available.', evidence: 'Superadmin firm/admin routes are mounted.', nextAction: 'Run dry-run in staging before pilot wave.', href: '/app/superadmin/firms' },
    { key: CHECKLIST_KEYS[2], label: 'Firm health and risk queue readiness', status: failedHealth > 0 ? 'fail' : warnedHealth > 0 ? 'watch' : 'pass', summary: `Critical firms: ${failedHealth}, at-risk firms: ${warnedHealth}.`, evidence: `Firm health totals (${JSON.stringify(firmHealth?.totals || {})})`, nextAction: failedHealth > 0 ? 'Resolve critical firms before onboarding pilots.' : 'Continue monitoring risk queue.', href: '/app/superadmin/firm-health' },
    { key: CHECKLIST_KEYS[3], label: 'Plans/capacity readiness', status: planTotals.overCapacity > 0 ? 'fail' : planTotals.nearCapacity > 0 ? 'watch' : 'pass', summary: `Near capacity: ${planTotals.nearCapacity}, over capacity: ${planTotals.overCapacity}.`, evidence: `Plan totals firms=${planTotals.firms}, pilot=${planTotals.pilot}, nearCapacity=${planTotals.nearCapacity}, overCapacity=${planTotals.overCapacity}`, nextAction: planTotals.overCapacity > 0 ? 'Increase limits before onboarding pilots.' : planTotals.nearCapacity > 0 ? 'Review limits for near-capacity firms.' : 'No plan/capacity blockers detected.', href: '/app/superadmin/plans' },
    { key: CHECKLIST_KEYS[4], label: 'Onboarding readiness', status: staleUsers > 0 ? 'watch' : 'pass', summary: `Stale onboarding users: ${staleUsers}.`, evidence: 'Onboarding insights aggregate totals only.', nextAction: staleUsers > 0 ? 'Follow up stale onboarding flows.' : 'Onboarding flow is healthy for pilots.', href: '/app/superadmin/onboarding-insights' },
    { key: CHECKLIST_KEYS[5], label: 'Storage/BYOS readiness', status: storageIssues > 0 ? 'watch' : 'pass', summary: `Firms with storage non-healthy status: ${storageIssues}.`, evidence: 'Storage health metadata from diagnostics snapshot.', nextAction: storageIssues > 0 ? 'Resolve storage health warnings for pilot firms.' : 'Storage posture appears ready.', href: '/app/superadmin/diagnostics' },
    { key: CHECKLIST_KEYS[6], label: 'Support diagnostics readiness', status: diagnostics ? 'pass' : 'fail', summary: diagnostics ? 'Support diagnostics snapshot is available.' : 'Diagnostics snapshot unavailable.', evidence: diagnostics ? `Diagnostics generated at ${diagnostics.generatedAt}` : 'No diagnostics payload', nextAction: diagnostics ? 'Continue monitoring.' : 'Restore diagnostics endpoint.', href: '/app/superadmin/diagnostics' },
    { key: CHECKLIST_KEYS[7], label: 'Audit logging readiness', status: recentAuditCount > 0 ? 'pass' : 'watch', summary: `Recent superadmin audit metadata events (14d): ${recentAuditCount}.`, evidence: 'Audit metadata count only; no payload details returned.', nextAction: recentAuditCount > 0 ? 'Continue monitoring audit pipeline.' : 'Verify audit event flow in staging.', href: '/app/superadmin/audit' },
    { key: CHECKLIST_KEYS[8], label: 'Primary-admin sidebar route readiness', status: 'pass', summary: 'Primary-admin API contract paths are fixed and covered by dedicated route-boundary checks.', evidence: `tests/primaryAdminSidebarRouteBoundaries.test.js covers ${PRIMARY_ADMIN_ROUTE_CONTRACT.join(', ')} (see docs/PRIMARY_ADMIN_SIDEBAR_API_CONTRACT.md).`, nextAction: 'Keep boundary test and API contract doc in sync.', href: '/app/superadmin/diagnostics' },
    { key: CHECKLIST_KEYS[9], label: 'No public billing/payment flows during pilot', status: 'pass', summary: 'No payment processor/public checkout flow included in pilot readiness surface.', evidence: 'Plans/capacity readiness uses internal metadata-only counters.', nextAction: 'Do not enable public billing flows during pilot.', href: '/app/superadmin/plans' },
  ];

  let score = 100;
  checklist.forEach((item) => { if (item.status === 'fail') score -= 30; if (item.status === 'watch') score -= 10; });
  score = clampScore(score);
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

module.exports = { buildPilotReadinessSnapshot, _private: { PRIMARY_ADMIN_ROUTE_CONTRACT, getPlansCapacityTotals } };
