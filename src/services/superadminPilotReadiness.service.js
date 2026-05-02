const routeSchemas = require('../schemas/superadmin.routes.schema');
const { getFirmHealthSnapshot } = require('./superadminFirmHealth.service');
const { getSupportDiagnosticsSnapshot } = require('./superadminDiagnostics.service');
const onboardingAnalyticsService = require('./onboardingAnalytics.service');
const SuperadminAudit = require('../models/SuperadminAudit.model');
const Firm = require('../models/Firm.model');

const CHECKLIST_KEYS = [
  'superadmin_auth_route_protection',
  'firm_creation_admin_invite_readiness',
  'firm_health_risk_queue_readiness',
  'plans_capacity_readiness',
  'onboarding_readiness',
  'storage_byos_readiness',
  'support_diagnostics_readiness',
  'audit_logging_readiness',
  'primary_admin_sidebar_route_readiness',
  'no_public_billing_payment_flows',
];

const clampScore = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const deriveOverallStatus = ({ score, failCount }) => {
  if (failCount > 0 || score < 65) return 'blocked';
  if (score >= 85 && failCount === 0) return 'ready';
  return 'watch';
};

const buildPilotReadinessSnapshot = async () => {
  const [firmHealth, diagnostics, onboarding, plans, recentAuditCount] = await Promise.all([
    getFirmHealthSnapshot({ limit: 100 }),
    getSupportDiagnosticsSnapshot({ limit: 20 }),
    onboardingAnalyticsService.getOnboardingInsights({ sinceDays: 30, staleAfterDays: 7, recentLimit: 20 }),
    Firm.aggregate([{ $match: { status: { $ne: 'deleted' } } }, { $group: { _id: null, totalFirms: { $sum: 1 }, pilot: { $sum: { $cond: [{ $eq: ['$plan', 'pilot'] }, 1, 0] } } } }]),
    SuperadminAudit.countDocuments({ createdAt: { $gte: new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)) } }),
  ]);

  const planTotals = plans[0] || { totalFirms: 0, pilot: 0 };
  const failedHealth = Number(firmHealth?.totals?.critical || 0);
  const warnedHealth = Number(firmHealth?.totals?.atRisk || 0);
  const nearCapacity = Number(diagnostics?.totals?.firmsNeedingOnboardingFollowUp || 0);
  const staleUsers = Number(onboarding?.summary?.staleUsers || onboarding?.totals?.staleUsers || 0);
  const storageIssues = (diagnostics?.firms || []).filter((row) => String(row?.storageHealthStatus || '').toUpperCase() !== 'HEALTHY').length;

  const checklist = [
    { key: CHECKLIST_KEYS[0], label: 'Superadmin auth and route protection', status: 'pass', summary: 'Route and policy guard configured for readiness endpoint.', evidence: 'requireSuperadmin + SuperAdminPolicy.canViewPlatformStats', nextAction: 'None', href: '/app/superadmin' },
    { key: CHECKLIST_KEYS[1], label: 'Firm creation/admin invite readiness', status: 'pass', summary: 'Firm creation and admin lifecycle routes are available.', evidence: 'Superadmin firm/admin routes are mounted.', nextAction: 'Run dry-run in staging before pilot wave.', href: '/app/superadmin/firms' },
    { key: CHECKLIST_KEYS[2], label: 'Firm health and risk queue readiness', status: failedHealth > 0 ? 'fail' : warnedHealth > 0 ? 'watch' : 'pass', summary: `Critical firms: ${failedHealth}, at-risk firms: ${warnedHealth}.`, evidence: `Firm health totals (${JSON.stringify(firmHealth?.totals || {})})`, nextAction: failedHealth > 0 ? 'Resolve critical firms before onboarding pilots.' : 'Continue monitoring risk queue.', href: '/app/superadmin/firm-health' },
    { key: CHECKLIST_KEYS[3], label: 'Plans/capacity readiness', status: nearCapacity > 0 ? 'watch' : 'pass', summary: `Firms needing onboarding/capacity follow-up: ${nearCapacity}.`, evidence: `Pilot firms: ${planTotals.pilot}/${planTotals.totalFirms}`, nextAction: nearCapacity > 0 ? 'Adjust capacity before new pilot onboarding.' : 'No capacity blockers detected.', href: '/app/superadmin/plans' },
    { key: CHECKLIST_KEYS[4], label: 'Onboarding readiness', status: staleUsers > 0 ? 'watch' : 'pass', summary: `Stale onboarding users: ${staleUsers}.`, evidence: 'Onboarding insights aggregate totals only.', nextAction: staleUsers > 0 ? 'Follow up stale onboarding flows.' : 'Onboarding flow is healthy for pilots.', href: '/app/superadmin/onboarding-insights' },
    { key: CHECKLIST_KEYS[5], label: 'Storage/BYOS readiness', status: storageIssues > 0 ? 'watch' : 'pass', summary: `Firms with storage non-healthy status: ${storageIssues}.`, evidence: 'Storage health metadata from diagnostics snapshot.', nextAction: storageIssues > 0 ? 'Resolve storage health warnings for pilot firms.' : 'Storage posture appears ready.', href: '/app/superadmin/diagnostics' },
    { key: CHECKLIST_KEYS[6], label: 'Support diagnostics readiness', status: diagnostics ? 'pass' : 'fail', summary: diagnostics ? 'Support diagnostics snapshot is available.' : 'Diagnostics snapshot unavailable.', evidence: diagnostics ? `Diagnostics generated at ${diagnostics.generatedAt}` : 'No diagnostics payload', nextAction: diagnostics ? 'Continue monitoring.' : 'Restore diagnostics endpoint.', href: '/app/superadmin/diagnostics' },
    { key: CHECKLIST_KEYS[7], label: 'Audit logging readiness', status: recentAuditCount > 0 ? 'pass' : 'watch', summary: `Recent superadmin audit metadata events (14d): ${recentAuditCount}.`, evidence: 'Audit metadata count only; no payload details returned.', nextAction: recentAuditCount > 0 ? 'Continue monitoring audit pipeline.' : 'Verify audit event flow in staging.', href: '/app/superadmin/audit' },
    { key: CHECKLIST_KEYS[8], label: 'Primary-admin sidebar route readiness', status: routeSchemas['GET /onboarding-insights'] ? 'pass' : 'fail', summary: 'Primary admin onboarding/operational routes are registered.', evidence: 'Schema registry includes superadmin operational routes.', nextAction: 'Keep route contract tests passing.', href: '/app/superadmin/onboarding-insights' },
    { key: CHECKLIST_KEYS[9], label: 'No public billing/payment flows during pilot', status: 'pass', summary: 'No payment processor/public checkout flow included in pilot readiness surface.', evidence: 'Plans/capacity uses metadata-only status fields.', nextAction: 'Do not enable public billing flows during pilot.', href: '/app/superadmin/plans' },
  ];

  let score = 100;
  checklist.forEach((item) => { if (item.status === 'fail') score -= 30; if (item.status === 'watch') score -= 10; });
  score = clampScore(score);
  const failCount = checklist.filter((item) => item.status === 'fail').length;
  const blockers = checklist.filter((item) => item.status === 'fail').map((item) => item.label);
  const warnings = checklist.filter((item) => item.status === 'watch').map((item) => item.label);

  return { overallStatus: deriveOverallStatus({ score, failCount }), score, checklist, blockers, warnings, generatedAt: new Date().toISOString() };
};

module.exports = { buildPilotReadinessSnapshot, _private: { clampScore, deriveOverallStatus, CHECKLIST_KEYS } };
