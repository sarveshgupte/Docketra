/**
 * Subscription Plans & Pricing Configuration
 * Aligned with founder-pricing economics and /pricing tiers.
 */

const PIONEER_COHORT_CONFIG = {
  maxFirms: 26,
  pricingReviewThreshold: 20,
  freeDurationDays: 365,
  billingStatus: 'free_pioneer_1yr',
  plan: 'pilot',
  maxUsers: null, // Unlimited seats during 1-year pilot
  tierName: 'Pilot Cohort (1 Year Free - Unlimited)',
};

/**
 * Determine whether a firm is within an active 1-year Pioneer Pilot Cohort grant.
 * Supports both 'pilot' and legacy 'enterprise' cohort records with free_pioneer_1yr billingStatus.
 */
const isFirmPioneerCohort = (firm) => {
  if (!firm) return false;
  const billingStatus = String(firm.billingStatus || '').trim();
  const expiresAt = firm.subscriptionExpiresAt ? new Date(firm.subscriptionExpiresAt) : null;
  const hasUnexpiredGrant = !expiresAt || (!Number.isNaN(expiresAt.getTime()) && expiresAt > new Date());
  if (billingStatus === PIONEER_COHORT_CONFIG.billingStatus && hasUnexpiredGrant) {
    return true;
  }
  const rawPlan = String(firm.plan || '').toLowerCase();
  return Boolean(expiresAt && hasUnexpiredGrant && rawPlan === 'enterprise');
};

const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter Tier',
    description: 'Boutique Practices (2 to 5 staff)',
    maxUsers: 5,
    maxClients: 50,
    pricing: {
      monthly: 1999,
      annual: 12990, // Founding locked rate
    },
    features: [
      'Up to 5 team seats',
      'Up to 50 active clients',
      'Unlimited dockets',
      'Google Drive BYOS (drive.file scope)',
      'Trainee Laptop Shield',
      'Maker-Checker approval hierarchy',
      '15+ statutory checklists (MCA, GST, 3CD)',
      'WhatsApp forwarder & drop links',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth Tier',
    description: 'Mid-Sized Practices (6 to 12 staff)',
    maxUsers: 12,
    maxClients: 150,
    pricing: {
      monthly: 2499,
      annual: 21990,
    },
    features: [
      'Up to 12 team seats (+₹1,200/seat/yr for extra seats)',
      'Up to 150 active clients',
      'Unlimited dockets',
      'Everything in Starter',
      'Department queues (ROC, Tax, GST, Audit)',
      'Peer-review ready SQC-1 audit logs',
      'Drive Folder Tamper Guard & auto-restore',
      'Priority onboarding & assisted migration',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro Tier',
    description: 'Corporate & Multi-Branch Practices (15+ staff)',
    maxUsers: 25,
    maxClients: null, // Unlimited
    pricing: {
      monthly: 5999,
      annual: 59990,
    },
    features: [
      'Up to 25 team seats',
      'Unlimited active clients & dockets',
      'Everything in Growth',
      'Multi-partner DSC sign-off routing',
      'Custom roles and granular staff permissions',
      'Priority SLA & dedicated onboarding engineer',
    ],
  },
};

const PAYMENT_GATEWAY_CONFIG = {
  defaultUpiVpa: process.env.PAYMENT_UPI_VPA || 'sarveshgupte@oksbi',
  defaultPayeeName: process.env.PAYMENT_PAYEE_NAME || 'Sarvesh Anand Gupte',
  orderExpiryMinutes: 30, // Orders remain active for 30 minutes for scanning and paying
};

module.exports = {
  PIONEER_COHORT_CONFIG,
  SUBSCRIPTION_PLANS,
  PAYMENT_GATEWAY_CONFIG,
  isFirmPioneerCohort,
};
