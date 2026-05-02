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

module.exports = { CHECKLIST_KEYS, clampScore, deriveOverallStatus };
