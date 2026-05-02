const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const TenantStorageHealth = require('../models/TenantStorageHealth.model');
const onboardingAnalyticsService = require('./onboardingAnalytics.service');

const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const ADMIN_ROLES = ['PRIMARY_ADMIN', 'ADMIN'];

const escapeRegex = (value) => String(value || '').trim().slice(0, MAX_SEARCH_LENGTH).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toSafeRegex = (value) => {
  const escaped = escapeRegex(value);
  return escaped ? { $regex: escaped, $options: 'i' } : null;
};

const toRiskLevel = (score) => {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'at_risk';
  return 'critical';
};

const clampScore = (score) => Math.max(0, Math.min(100, Number(score) || 0));

const getFirmHealthSnapshot = async ({ limit = 25, status, search } = {}) => {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 25, 1), MAX_LIMIT);
  const searchRegex = toSafeRegex(search);

  const firmQuery = { status: { $ne: 'deleted' } };
  if (searchRegex) {
    firmQuery.$or = [{ firmId: searchRegex }, { firmSlug: searchRegex }, { name: searchRegex }];
  }

  const [firms, onboarding, storageRows] = await Promise.all([
    Firm.find(firmQuery).select('_id firmId firmSlug name status createdAt').sort({ createdAt: -1 }).limit(safeLimit).lean(),
    onboardingAnalyticsService.getOnboardingInsightDetails({ sinceDays: 30, staleAfterDays: 7, completionState: 'all', limit: safeLimit }),
    TenantStorageHealth.find({}).select('tenantId status').lean(),
  ]);

  const onboardingByFirm = new Map((onboarding?.firms || []).map((row) => [String(row.firmId), row]));
  const storageByFirm = new Map(storageRows.map((row) => [String(row.tenantId), row]));
  const adminAgg = await User.aggregate([
    { $match: { firmId: { $in: firms.map((f) => f._id) }, role: { $in: ADMIN_ROLES }, status: { $ne: 'deleted' } } },
    { $group: { _id: '$firmId', total: { $sum: 1 }, verified: { $sum: { $cond: [{ $eq: ['$emailVerified', true] }, 1, 0] } } } },
  ]);
  const adminsByFirm = new Map(adminAgg.map((row) => [String(row._id), row]));

  const healthRows = firms.map((firm) => {
    const onboardingRow = onboardingByFirm.get(String(firm._id)) || onboardingByFirm.get(String(firm.firmId)) || {};
    const storageRow = storageByFirm.get(String(firm._id)) || storageByFirm.get(String(firm.firmId));
    const adminRow = adminsByFirm.get(String(firm._id)) || { total: 0, verified: 0 };
    const reasons = [];
    let score = 100;

    if (['inactive', 'suspended', 'disabled'].includes(String(firm.status || '').toLowerCase())) { score -= 30; reasons.push('Firm status is not active.'); }
    if (adminRow.total === 0) { score -= 25; reasons.push('No platform admin account found.'); }
    else if ((adminRow.verified || 0) === 0) { score -= 15; reasons.push('No verified admin access signal.'); }
    const staleUsers = Number(onboardingRow.staleUsers || 0);
    const incompleteUsers = Number(onboardingRow.incompleteUsers || 0);
    if (staleUsers > 0) { score -= Math.min(20, staleUsers * 4); reasons.push(`Onboarding stale users: ${staleUsers}.`); }
    if (incompleteUsers > 0) { score -= Math.min(15, incompleteUsers * 2); reasons.push(`Onboarding incomplete users: ${incompleteUsers}.`); }
    const storageStatus = String(storageRow?.status || 'UNKNOWN').toUpperCase();
    if (storageStatus !== 'HEALTHY') { score -= 12; reasons.push('Storage health is not healthy or unknown.'); }
    if (Number(adminRow.total || 0) === 0) { score -= 8; reasons.push('Zero active usage/admin signal available.'); }

    score = clampScore(score);
    const riskLevel = toRiskLevel(score);
    return {
      firmId: firm.firmId,
      firmObjectId: String(firm._id),
      firmSlug: firm.firmSlug,
      name: firm.name,
      status: firm.status,
      score,
      riskLevel,
      reasons: reasons.slice(0, 4),
      signals: {
        onboarding: { staleUsers, incompleteUsers, completionState: onboardingRow.completionState || 'unknown' },
        adminAccess: { totalAdmins: Number(adminRow.total || 0), verifiedAdmins: Number(adminRow.verified || 0) },
        storage: { status: storageStatus },
        auth: { status: 'platform_monitored' },
        usage: { hasActiveSignal: Number(adminRow.total || 0) > 0 },
      },
      nextAction: onboardingRow.nextAction || (riskLevel === 'healthy' ? 'Continue monitoring' : 'Review firm lifecycle and admin access'),
      href: `/app/superadmin/firms/${firm._id}`,
    };
  });

  const filtered = status ? healthRows.filter((row) => row.riskLevel === status) : healthRows;
  return {
    totals: {
      firms: filtered.length,
      healthy: filtered.filter((f) => f.riskLevel === 'healthy').length,
      watch: filtered.filter((f) => f.riskLevel === 'watch').length,
      atRisk: filtered.filter((f) => f.riskLevel === 'at_risk').length,
      critical: filtered.filter((f) => f.riskLevel === 'critical').length,
    },
    firms: filtered,
  };
};

module.exports = {
  getFirmHealthSnapshot,
  _private: { clampScore, toRiskLevel, escapeRegex, MAX_LIMIT, MAX_SEARCH_LENGTH },
};
