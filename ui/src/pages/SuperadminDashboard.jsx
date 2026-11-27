import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { superadminService } from '../services/superadminService';
import { useToast } from '../hooks/useToast';
import { productUpdatesService } from '../services/productUpdatesService';
import { APP_VERSION } from '../utils/constants';
import { CreateFirmModal } from './admin/components/CreateFirmModal';
import { LegalConsentCertificateModal } from '../components/superadmin/LegalConsentCertificateModal';
import { SuperadminFeedbackView } from '../components/superadmin/SuperadminFeedbackView';
import { SuperadminLiveClock } from '../components/superadmin/SuperadminLiveClock';
import { SuperadminAuditStreamTab } from '../components/superadmin/SuperadminAuditStreamTab';
import { SuperadminPerformanceTab } from '../components/superadmin/SuperadminPerformanceTab';
import { SuperadminLaunchChecklistTab } from '../components/superadmin/SuperadminLaunchChecklistTab';
import { SuperadminFeatureFlagsTab } from '../components/superadmin/SuperadminFeatureFlagsTab';
import { PILOT_TERMS_VERSION } from '../components/marketing/PilotAgreementModal';

const safeCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const settledData = (result, fallback = null) => (
  result.status === 'fulfilled' && result.value?.success ? (result.value.data ?? fallback) : fallback
);

const getStorageIssueCount = (diagnostics) => (diagnostics?.firms || []).filter((firm) => {
  const health = String(firm?.storageHealthStatus || '').toUpperCase();
  return health && health !== 'HEALTHY';
}).length;

const DASHBOARD_TABS = [
  { id: 'vitals', label: 'Ecosystem Vitals' },
  { id: 'security', label: 'Security Audits' },
  { id: 'performance', label: 'Performance Traces' },
  { id: 'launch', label: 'Launch Checklist' },
  { id: 'flags', label: 'Feature Flags' },
  { id: 'legal', label: 'Legal & Consent' },
  { id: 'feedback', label: 'User Feedback & Bugs' },
];

const VALID_TAB_IDS = new Set(DASHBOARD_TABS.map((tab) => tab.id));

const QUICK_LINKS = [
  { label: 'Firms Management', description: 'Manage, suspend, or provision tenant workspaces.', path: '/app/superadmin/firms' },
  { label: 'Onboarding Insights', description: 'Track registration velocity and onboarding stalls.', path: '/app/superadmin/onboarding-insights' },
  { label: 'Firm Health', description: 'Inspect tenant risk scores and operational alerts.', path: '/app/superadmin/firm-health' },
  { label: 'Plans & Capacity', description: 'Adjust subscription plans and seat limits.', path: '/app/superadmin/plans' },
  { label: 'Feature Flags', description: 'Control module rollouts and pilot overrides.', path: '/app/superadmin/feature-flags' },
  { label: 'Pilot Readiness', description: 'Review readiness gates and audit coverage.', path: '/app/superadmin/pilot-readiness' },
  { label: 'Support Diagnostics', description: 'Trace failed auth attempts and slow endpoints.', path: '/app/superadmin/diagnostics' },
  { label: 'AI Assistant', description: 'Ask product, engineering, or marketing copilot.', path: '/app/superadmin/ai-assistant', highlight: true },
];

const MASTER_TERMS_CLAUSES = [
  { title: '1. Pre-incorporation Operator', body: 'Executed with Sarvesh Gupte in individual founder capacity prior to formal corporate incorporation.' },
  { title: '2. Pilot Evaluation License', body: '1-year revocable evaluation license for the first 26 founding firms for internal operations, client tracking, and statutory compliance.' },
  { title: '3. Zero Advisory Disclaimer', body: 'Software workflow utility only. No legal, tax, chartered accounting, or company secretarial advice is rendered.' },
  { title: '4. Explicit ₹0 Liability Cap', body: 'Offered on an as-evaluated basis without monetary liability for pilot phase operational testing.' },
  { title: '5. Sovereign Data Residency (BYOS)', body: 'Working papers and client filings remain in practice-owned storage under Indian data jurisdiction.' },
  { title: '6. Exclusive Jurisdiction', body: 'Subject to Indian laws, with exclusive legal jurisdiction in the Courts of Mumbai / Thane, Maharashtra.' },
];

const Icons = {
  Firms: () => (
    <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Users: () => (
    <svg className="h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Performance: () => (
    <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Security: () => (
    <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Attention: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  ArrowRight: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  ConsoleLink: () => (
    <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

export const SuperadminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const tabParam = searchParams.get('tab');
  const activeTab = VALID_TAB_IDS.has(tabParam) ? tabParam : 'vitals';

  const setActiveTab = useCallback((nextTab) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      if (nextTab === 'vitals') {
        updated.delete('tab');
      } else {
        updated.set('tab', nextTab);
      }
      return updated;
    }, { replace: true });
  }, [setSearchParams]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Core telemetry state (loaded on initial mount)
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [firmHealth, setFirmHealth] = useState(null);
  const [plans, setPlans] = useState(null);

  // On-demand tab telemetry state
  const [pilotReadiness, setPilotReadiness] = useState(null);
  const [featureFlags, setFeatureFlags] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [firmsList, setFirmsList] = useState([]);
  const [tabLoading, setTabLoading] = useState({});
  const loadedTabsRef = useRef(new Set());

  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showReleasePublisher, setShowReleasePublisher] = useState(false);
  const [selectedCertFirm, setSelectedCertFirm] = useState(null);
  const [legalSearchQuery, setLegalSearchQuery] = useState('');

  const MAX_UPDATE_BULLETS = 5;
  const [updateForm, setUpdateForm] = useState({
    title: '',
    bullets: ['', '', ''],
    isPublished: true,
    version: '',
  });
  const [publishingUpdate, setPublishingUpdate] = useState(false);

  const loadTabData = useCallback(async (tab, { force = false } = {}) => {
    if (!['security', 'launch', 'flags', 'legal'].includes(tab)) return;
    if (!force && loadedTabsRef.current.has(tab)) return;

    setTabLoading((prev) => ({ ...prev, [tab]: true }));
    try {
      if (tab === 'security') {
        const res = await superadminService.getAuditLogs({ limit: 12 });
        if (res?.success) setAuditLogs(res.data || []);
      } else if (tab === 'launch') {
        const res = await superadminService.getPilotReadiness();
        if (res?.success) setPilotReadiness(res.data || null);
      } else if (tab === 'flags') {
        const res = await superadminService.getFeatureFlags();
        if (res?.success) setFeatureFlags(res.data || null);
      } else if (tab === 'legal') {
        const res = await superadminService.listFirms();
        if (res?.success) setFirmsList(Array.isArray(res.data) ? res.data : []);
      }
      loadedTabsRef.current.add(tab);
    } finally {
      setTabLoading((prev) => ({ ...prev, [tab]: false }));
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    loadedTabsRef.current.clear();

    const [statsRes, insightsRes, diagnosticsRes, healthRes, plansRes] = await Promise.allSettled([
      superadminService.getPlatformStats(),
      superadminService.getOnboardingInsights({ sinceDays: 30, staleAfterDays: 7, recentLimit: 20 }),
      superadminService.getSupportDiagnostics({ limit: 20 }),
      superadminService.getFirmHealth({ limit: 100 }),
      superadminService.getPlansCapacity(),
    ]);

    const statsData = settledData(statsRes);
    const insightsData = settledData(insightsRes);
    const diagnosticsData = settledData(diagnosticsRes);

    setStats(statsData);
    setInsights(insightsData);
    setDiagnostics(diagnosticsData);
    setFirmHealth(settledData(healthRes));
    setPlans(settledData(plansRes));

    if (!statsData && !insightsData && !diagnosticsData) {
      setError('Platform command center is temporarily unavailable.');
    } else if (!statsData || !insightsData || !diagnosticsData) {
      setError('Some command center data is temporarily unavailable.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!loading) {
      void loadTabData(activeTab);
    }
  }, [activeTab, loading, loadTabData]);

  // Core KPI values
  const totalFirms = safeCount(stats?.totalFirms);
  const activeFirms = safeCount(stats?.activeFirms);
  const inactiveFirms = safeCount(stats?.inactiveFirms);
  const totalUsers = safeCount(stats?.totalUsers);

  const pilotCohort = stats?.pilotCohort || {
    onboardedFirms: totalFirms,
    reviewThreshold: 20,
    maxFirms: 26,
    remainingSlots: Math.max(0, 26 - totalFirms),
    pricingReviewTriggered: totalFirms >= 20,
    cohortFull: totalFirms >= 26,
  };

  const averageUsersPerFirm = useMemo(
    () => (totalFirms > 0 ? (totalUsers / totalFirms).toFixed(1) : '0'),
    [totalUsers, totalFirms]
  );

  const otpFailures = safeCount((diagnostics?.loginAndOtpIssues || []).length);
  const slowP95 = diagnostics?.slowEndpointSummary?.p95Ms;
  const staleOnboarding = safeCount(insights?.summary?.staleUsers || insights?.totals?.staleUsers);
  const storageIssues = getStorageIssueCount(diagnostics);
  const unverifiedAdmins = safeCount((diagnostics?.firms || []).filter((firm) => firm?.admin?.emailVerified === false).length);
  const authIssues = otpFailures;

  const criticalFirms = useMemo(
    () => (firmHealth?.firms || []).filter((f) => f.riskLevel === 'critical' || f.riskLevel === 'at_risk').slice(0, 4),
    [firmHealth]
  );

  const pilotReadySummary = useMemo(() => {
    const checklist = pilotReadiness?.checklist || [];
    return {
      pass: checklist.filter((i) => i.status === 'pass').length,
      watch: checklist.filter((i) => i.status === 'watch').length,
      fail: checklist.filter((i) => i.status === 'fail').length,
      overall: pilotReadiness?.overallStatus || 'NOT_READY',
      score: safeCount(pilotReadiness?.score || 0),
    };
  }, [pilotReadiness]);

  const consentStats = useMemo(() => {
    const total = firmsList.length;
    const acceptedCount = firmsList.filter((f) => f.termsAccepted === true).length;
    return {
      total,
      acceptedCount,
      percentage: total > 0 ? Math.round((acceptedCount / total) * 100) : 100,
      pendingCount: total - acceptedCount,
      activeVersion: PILOT_TERMS_VERSION || 'v1.0_pilot_2026',
    };
  }, [firmsList]);

  const filteredLegalFirms = useMemo(() => {
    if (!legalSearchQuery.trim()) return firmsList;
    const q = legalSearchQuery.toLowerCase();
    return firmsList.filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.firmId && f.firmId.toLowerCase().includes(q)) ||
        (f.slug && f.slug.toLowerCase().includes(q)) ||
        (f.adminEmail && f.adminEmail.toLowerCase().includes(q))
    );
  }, [firmsList, legalSearchQuery]);

  const attentionCards = [
    {
      label: 'Stale Onboarding',
      count: staleOnboarding,
      hasIssue: staleOnboarding > 0,
      statusText: staleOnboarding > 0 ? 'Review users' : 'Clean funnel',
      tone: 'amber',
      path: '/app/superadmin/onboarding-insights',
    },
    {
      label: 'Storage Issues',
      count: storageIssues,
      hasIssue: storageIssues > 0,
      statusText: storageIssues > 0 ? 'Drives unlinked' : 'All drives online',
      tone: 'rose',
      path: '/app/superadmin/diagnostics',
    },
    {
      label: 'Unverified Admins',
      count: unverifiedAdmins,
      hasIssue: unverifiedAdmins > 0,
      statusText: unverifiedAdmins > 0 ? 'Invite pending' : 'All validated',
      tone: 'amber',
      path: '/app/superadmin/firms',
    },
    {
      label: 'Auth Locks',
      count: authIssues,
      hasIssue: authIssues > 0,
      statusText: authIssues > 0 ? 'Auth failures' : 'No locks detected',
      tone: 'rose',
      path: '/app/superadmin/diagnostics',
    },
  ];

  const capacityMetrics = [
    { label: 'Pilot firms allocation', count: plans?.totals?.pilot ?? 0, valueClass: 'text-slate-700', barClass: 'bg-indigo-500' },
    { label: 'Near capacity limits', count: plans?.totals?.nearCapacity ?? 0, valueClass: 'text-amber-600', barClass: 'bg-amber-400' },
    { label: 'Over capacity boundaries', count: plans?.totals?.overCapacity ?? 0, valueClass: 'text-rose-600', barClass: plans?.totals?.overCapacity > 0 ? 'bg-rose-500' : 'bg-slate-300' },
  ];

  const handleCreateUpdate = async (event) => {
    event.preventDefault();
    const content = updateForm.bullets.map((item) => item.trim()).filter(Boolean);
    if (!updateForm.title.trim() || content.length === 0) {
      toast.error('Add a title and at least one bullet point.');
      return;
    }
    if (content.length > MAX_UPDATE_BULLETS) {
      toast.error(`Use ${MAX_UPDATE_BULLETS} bullet points or fewer.`);
      return;
    }

    try {
      setPublishingUpdate(true);
      const response = await productUpdatesService.create({
        title: updateForm.title.trim(),
        content,
        isPublished: updateForm.isPublished,
        version: updateForm.version.trim() || undefined,
      });
      if (response?.success) {
        toast.success('Product update published.');
        setUpdateForm({ title: '', bullets: ['', '', ''], isPublished: true, version: '' });
      } else {
        toast.error(response?.message || 'Failed to publish update.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to publish update.');
    } finally {
      setPublishingUpdate(false);
    }
  };

  const handleBulletChange = (index, value) => {
    setUpdateForm((prev) => {
      const nextBullets = [...prev.bullets];
      nextBullets[index] = value;
      return { ...prev, bullets: nextBullets };
    });
  };

  const handleAddBullet = () => {
    if (updateForm.bullets.length >= MAX_UPDATE_BULLETS) {
      toast.error(`Maximum ${MAX_UPDATE_BULLETS} bullet points allowed.`);
      return;
    }
    setUpdateForm((prev) => ({ ...prev, bullets: [...prev.bullets, ''] }));
  };

  const handleRemoveBullet = (indexToRemove) => {
    setUpdateForm((prev) => ({
      ...prev,
      bullets: prev.bullets.filter((_, index) => index !== indexToRemove),
    }));
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Preparing Platform Command Center..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 relative">
        {/* Operational Header */}
        <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Platform Command Center
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500 font-medium">Multi-Tenant Oversight</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Platform Command Center</h1>
              <p className="text-xs text-slate-500 mt-0.5">Operational health, risk queues, security telemetry, and tenant diagnostics.</p>
            </div>

            <div className="bg-slate-50 rounded-lg border border-slate-200/80 p-2.5 flex flex-wrap items-center gap-3 self-start md:self-auto">
              <SuperadminLiveClock />
              <div className="hidden sm:block h-7 w-px bg-slate-200" />
              <Button variant="outline" size="sm" onClick={loadDashboard}>
                Reload Diagnostics
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowOnboardModal(true)}>
                + Onboard Firm
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div>
              <h4 className="font-semibold text-rose-700 text-sm">Command center telemetry failure</h4>
              <p className="text-xs text-slate-600">{error}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={loadDashboard}>Retry Diagnostics</Button>
          </div>
        ) : null}

        {/* URL-Synced Section Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2" role="tablist" aria-label="SuperAdmin Dashboard Sections">
          {DASHBOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Tab View */}
        <div>
          {activeTab === 'vitals' && (
            <div className="space-y-6">
              {/* Pilot Cohort Progress & 20-Firm Trigger */}
              <div
                role="status"
                className={`rounded-xl border p-4 shadow-xs transition-colors ${
                  pilotCohort.pricingReviewTriggered ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          pilotCohort.cohortFull
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : pilotCohort.pricingReviewTriggered
                              ? 'bg-amber-200 text-amber-950 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {pilotCohort.cohortFull
                          ? 'Cohort Full (26 / 26)'
                          : pilotCohort.pricingReviewTriggered
                            ? `Pricing Trigger Reached (${pilotCohort.onboardedFirms} / ${pilotCohort.maxFirms})`
                            : `1-Year Pilot Cohort (${pilotCohort.onboardedFirms} / ${pilotCohort.maxFirms})`}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        {pilotCohort.pricingReviewTriggered
                          ? '20-firm milestone reached — review final pricing & post-cohort plan.'
                          : `${pilotCohort.remainingSlots} unlimited pilot slots remaining (20-firm review trigger armed).`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      First {pilotCohort.maxFirms} founding firms get 1 full year free with unlimited seats, clients, and dockets under Pilot. Milestone review triggers at {pilotCohort.reviewThreshold} firms.
                    </p>
                  </div>

                  <div className="sm:w-56 shrink-0">
                    <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-700 mb-1">
                      <span>{pilotCohort.onboardedFirms} onboarded</span>
                      <span>Target: {pilotCohort.maxFirms}</span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          pilotCohort.cohortFull ? 'bg-rose-600' : pilotCohort.pricingReviewTriggered ? 'bg-amber-500' : 'bg-slate-900'
                        }`}
                        style={{ width: `${Math.min(100, (pilotCohort.onboardedFirms / pilotCohort.maxFirms) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Platform Vitals Grid */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Registered Firms</span>
                    <div className="rounded-lg bg-indigo-50 p-2 border border-indigo-100"><Icons.Firms /></div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight font-mono text-slate-900">{totalFirms}</h3>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-indigo-600">{activeFirms} Active</span>
                      <span>{inactiveFirms} Suspended</span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                      <div className="h-full bg-indigo-500 rounded-l" style={{ width: `${totalFirms > 0 ? (activeFirms / totalFirms) * 100 : 0}%` }} />
                      <div className="h-full bg-slate-300 rounded-r" style={{ width: `${totalFirms > 0 ? (inactiveFirms / totalFirms) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">User Footprint</span>
                    <div className="rounded-lg bg-sky-50 p-2 border border-sky-100"><Icons.Users /></div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight font-mono text-slate-900">{totalUsers}</h3>
                    <p className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                      <span>Average per firm</span>
                      <span className="font-semibold text-slate-700 font-mono">{averageUsersPerFirm} users/firm</span>
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {plans?.totals?.overCapacity > 0
                        ? `${plans.totals.overCapacity} over capacity`
                        : plans?.totals?.nearCapacity > 0
                          ? `${plans.totals.nearCapacity} near seat limit`
                          : 'All firms within seat limits'}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Endpoint p95</span>
                    <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-100"><Icons.Performance /></div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight font-mono text-slate-900">
                      {Number.isFinite(Number(slowP95)) ? `${slowP95}ms` : 'N/A'}
                    </h3>
                    <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${Number(slowP95) < 250 ? 'bg-emerald-500' : Number(slowP95) < 600 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      <span className="font-semibold text-slate-600">
                        {!Number.isFinite(Number(slowP95))
                          ? 'No latency baseline yet'
                          : Number(slowP95) < 250
                            ? 'Optimal response'
                            : Number(slowP95) < 600
                              ? 'Nominal response'
                              : 'Elevated latency'}
                      </span>
                    </p>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${Number(slowP95) < 250 ? 'bg-emerald-500' : Number(slowP95) < 600 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, Number(slowP95) > 0 ? (Number(slowP95) / 1000) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Security Auth</span>
                    <div className="rounded-lg bg-rose-50 p-2 border border-rose-100"><Icons.Security /></div>
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-3xl font-extrabold tracking-tight font-mono ${otpFailures > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{otpFailures}</h3>
                    <p className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                      <span>Login / OTP Events</span>
                      <span className={`font-bold uppercase tracking-wider text-[10px] ${otpFailures > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {otpFailures === 0 ? 'Normal' : 'Review'}
                      </span>
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {otpFailures === 0 ? 'No recent lockouts or OTP failures' : `${otpFailures} auth anomalies flagged`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Needs Attention Today */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="rounded-lg bg-amber-50 p-2 border border-amber-100 text-amber-600"><Icons.Attention /></div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Needs attention today</h2>
                    <p className="text-xs text-slate-500">Signals requiring founder or operator follow-up.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {attentionCards.map((card) => {
                    const activeBorder = card.tone === 'rose'
                      ? 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
                      : 'bg-amber-50/40 border-amber-300 hover:border-amber-400';
                    const dotColor = card.tone === 'rose' ? 'bg-rose-500' : 'bg-amber-500';
                    return (
                      <button
                        key={card.label}
                        type="button"
                        onClick={() => navigate(card.path)}
                        className={`text-left rounded-xl border p-4 transition-colors flex flex-col justify-between min-h-[110px] ${
                          card.hasIssue ? activeBorder : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
                          <h4 className="mt-1 text-2xl font-black font-mono text-slate-900">{card.count}</h4>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <span className={`inline-block h-2 w-2 rounded-full ${card.hasIssue ? dotColor : 'bg-slate-400'}`} />
                            {card.statusText}
                          </span>
                          <span className="text-indigo-600 flex items-center gap-0.5">Inspect <Icons.ArrowRight /></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Risk Queue & Plan Capacity */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Firm Risk Queue</h2>
                        <p className="text-xs text-slate-500">Operational health queue across tenant accounts.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/app/superadmin/firm-health')}>
                        Risk Queue
                      </Button>
                    </div>

                    {criticalFirms.length === 0 ? (
                      <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/40 my-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">✓</span>
                        <p className="text-xs font-bold text-slate-800">All tenants operational</p>
                        <p className="text-[10px] text-slate-500">No active firms are flagged as at-risk or critical.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto my-2 border border-slate-100 rounded-lg">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left font-bold text-slate-500 border-b border-slate-100">
                              <th className="py-2.5 px-3">Firm / Tenant</th>
                              <th className="py-2.5 px-2">Score</th>
                              <th className="py-2.5 px-2">Risk Level</th>
                              <th className="py-2.5 px-3">Next Step / Reasons</th>
                              <th className="py-2.5 px-3 text-right">Firm Console</th>
                            </tr>
                          </thead>
                          <tbody>
                            {criticalFirms.map((firm) => (
                              <tr key={firm.firmObjectId} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors align-middle">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-900">{firm.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{firm.firmSlug || firm.firmId}</div>
                                </td>
                                <td className="py-2.5 px-2 font-mono font-semibold text-slate-700">{firm.score}</td>
                                <td className="py-2.5 px-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border capitalize ${
                                      firm.riskLevel === 'critical'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    {firm.riskLevel === 'at_risk' ? 'At Risk' : firm.riskLevel}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 max-w-[160px]">
                                  <span className="font-medium text-slate-800 block truncate" title={firm.nextAction}>
                                    {firm.nextAction || firm.reasons?.[0] || 'Review diagnostics'}
                                  </span>
                                  {firm.reasons?.length > 1 ? (
                                    <span className="text-[10px] text-slate-400 block truncate" title={firm.reasons.join(', ')}>
                                      {firm.reasons.slice(1).join(', ')}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <Button variant="outline" size="sm" onClick={() => navigate(`/app/superadmin/firms/${firm.firmObjectId}`)}>
                                    Manage Firm &rarr;
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                    <span>Platform: Critical ({firmHealth?.totals?.critical || 0}) · At risk ({firmHealth?.totals?.atRisk || 0})</span>
                    <span>Strict tenant isolation</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Tenant Subscription Map</h2>
                        <p className="text-xs text-slate-500">Plan distribution and seat capacity ratios.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/app/superadmin/plans')}>
                        Manage Caps
                      </Button>
                    </div>

                    <div className="space-y-4 my-3">
                      {capacityMetrics.map((metric) => (
                        <div key={metric.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-700">{metric.label}</span>
                            <span className={`font-mono tabular-nums font-bold ${metric.valueClass}`}>{metric.count}</span>
                          </div>
                          <div className="h-2 w-full rounded-xs bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-xs ${metric.barClass}`}
                              style={{ width: `${Math.min(100, metric.count ? (metric.count / (totalFirms || 1)) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="text-slate-400">Plan & seat telemetry</span>
                    <button
                      type="button"
                      onClick={() => navigate('/app/superadmin/plans')}
                      className="text-indigo-600 hover:text-indigo-500 font-bold hover:underline"
                    >
                      Provision caps &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <SuperadminAuditStreamTab
              auditLogs={auditLogs}
              loading={Boolean(tabLoading.security)}
              onOpenFullLogs={() => navigate('/app/superadmin/audit')}
            />
          )}

          {activeTab === 'performance' && (
            <SuperadminPerformanceTab
              diagnostics={diagnostics}
              slowP95={slowP95}
              onOpenDiagnostics={() => navigate('/app/superadmin/diagnostics')}
            />
          )}

          {activeTab === 'launch' && (
            <SuperadminLaunchChecklistTab
              pilotReadiness={pilotReadiness}
              summary={pilotReadySummary}
              loading={Boolean(tabLoading.launch)}
              onOpenChecklist={() => navigate('/app/superadmin/pilot-readiness')}
              onNavigate={(href) => navigate(href)}
            />
          )}

          {activeTab === 'flags' && (
            <SuperadminFeatureFlagsTab
              featureFlags={featureFlags}
              loading={Boolean(tabLoading.flags)}
              onOpenFlags={() => navigate('/app/superadmin/feature-flags')}
            />
          )}

          {activeTab === 'legal' && (
            <div className="space-y-6">
              {tabLoading.legal ? (
                <Loading message="Loading legal consent ledger..." />
              ) : (
                <>
                  {/* LEGAL & CONSENT KPI METRICS */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Total Registered Firms
                      </span>
                      <p className="mt-2 text-2xl font-bold font-mono text-slate-900">{consentStats.total}</p>
                      <p className="mt-1 text-xs text-slate-500">Onboarded tenant practices</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Signed Clickwrap Terms
                      </span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <p className="text-2xl font-bold font-mono text-emerald-600">{consentStats.acceptedCount}</p>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                          {consentStats.percentage}% compliance
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Verified electronic consent</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Pending / Legacy Accounts
                      </span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <p className={`text-2xl font-bold font-mono ${consentStats.pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                          {consentStats.pendingCount}
                        </p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                            consentStats.pendingCount > 0
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {consentStats.pendingCount > 0 ? 'Requires Consent' : '100% Up to Date'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Pre-clickwrap migration accounts</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Active System Terms Version
                      </span>
                      <p className="mt-2 text-xl font-bold font-mono text-indigo-600 truncate">{consentStats.activeVersion}</p>
                      <p className="mt-1 text-xs text-slate-500">Clickwrap pilot agreement</p>
                    </div>
                  </div>

                  {/* MASTER TERMS SUMMARY & LEGAL ARCHITECTURE */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Master Terms &amp; Regulatory Architecture</h3>
                        <p className="text-xs text-slate-500">
                          Enforced electronic agreement parameters for Indian CA, CS, and Legal practices.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200/60">
                        Active Version: {consentStats.activeVersion}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                      {MASTER_TERMS_CLAUSES.map((clause) => (
                        <div key={clause.title} className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/60">
                          <span className="font-bold text-slate-900 block mb-1">{clause.title}</span>
                          <p className="text-slate-600 text-[11px] leading-relaxed">{clause.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* FIRM LEGAL CONSENT AUDIT LEDGER */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Firm Legal Consent Audit Ledger</h3>
                        <p className="text-xs text-slate-500">
                          Recorded clickwrap agreement timestamps, signatory emails, and audit certificates.
                        </p>
                      </div>
                      <div className="w-full sm:w-72">
                        <input
                          type="text"
                          placeholder="Search practice name, ID, or email…"
                          value={legalSearchQuery}
                          onChange={(e) => setLegalSearchQuery(e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    {filteredLegalFirms.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No practice consent records match the search filter.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3">Practice / Firm</th>
                              <th className="py-2.5 px-3">Signatory Email</th>
                              <th className="py-2.5 px-3">Agreement Type</th>
                              <th className="py-2.5 px-3">Terms Version</th>
                              <th className="py-2.5 px-3">Acceptance Date</th>
                              <th className="py-2.5 px-3">Sign-Up IP</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredLegalFirms.map((firm) => {
                              const isAccepted = firm.termsAccepted === true;
                              const firmKey = firm.firmId || firm.slug || firm._id || 'N/A';
                              return (
                                <tr key={firmKey} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <span className="font-semibold text-slate-900 block">{firm.name || 'Unnamed Practice'}</span>
                                    <span className="text-[10px] font-mono text-slate-400">{firmKey}</span>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-700">{firm.adminEmail || '—'}</td>
                                  <td className="py-2.5 px-3 text-[11px]">
                                    {firm.agreementType || (isAccepted ? 'PILOT_CLICKWRAP' : 'PENDING')}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-700">
                                    {firm.termsVersion || (isAccepted ? 'v1.0_pilot_2026' : 'Legacy User')}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                    {firm.termsAcceptedAt
                                      ? new Date(firm.termsAcceptedAt).toLocaleDateString([], {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })
                                      : 'Not Recorded'}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-500">{firm.signupIP || '127.0.0.1'}</td>
                                  <td className="py-2.5 px-3">
                                    {isAccepted ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        Accepted
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-600/20">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <Button variant="outline" size="sm" onClick={() => setSelectedCertFirm(firm)}>
                                      📄 View Certificate
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-6">
              <SuperadminFeedbackView />
            </div>
          )}
        </div>

        {/* Platform Quick Links */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="rounded-lg bg-indigo-50 p-2 border border-indigo-100 text-indigo-600"><Icons.ConsoleLink /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Platform Quick Links</h2>
              <p className="text-xs text-slate-500">Direct routes to tenant controls and operational diagnostics.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {QUICK_LINKS.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`group text-left rounded-xl border p-4 transition-colors ${
                  item.highlight
                    ? 'border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/50 hover:border-indigo-400'
                    : 'border-slate-200 hover:bg-slate-50 hover:border-indigo-300'
                }`}
              >
                <h4 className={`font-bold text-sm transition-colors ${item.highlight ? 'text-indigo-700' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                  {item.label}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">{item.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Product Updates Publisher */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Product Updates Publisher</h2>
              <p className="text-xs text-slate-500">
                Publish platform release notes displayed to authenticated workspaces.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReleasePublisher((prev) => !prev)}
            >
              {showReleasePublisher ? 'Hide Publisher' : 'Compose Release Note'}
            </Button>
          </div>

          {showReleasePublisher ? (
            <form className="mt-4 pt-4 border-t border-slate-100 space-y-4" onSubmit={handleCreateUpdate}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Update Title</label>
                  <input
                    value={updateForm.title}
                    onChange={(event) => setUpdateForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="e.g. Major speed optimizations & multi-workspace support"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    maxLength={160}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Version tag</label>
                  <input
                    value={updateForm.version}
                    onChange={(event) => setUpdateForm((prev) => ({ ...prev, version: event.target.value }))}
                    placeholder={`e.g. v${APP_VERSION}`}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    maxLength={32}
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Release Bullet Points</label>
                {updateForm.bullets.map((bullet, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 w-5 text-right">{index + 1}.</span>
                    <input
                      value={bullet}
                      onChange={(event) => handleBulletChange(index, event.target.value)}
                      placeholder="Highlight bullet point detail"
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      maxLength={180}
                    />
                    {updateForm.bullets.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveBullet(index)}
                        className="rounded-lg hover:bg-slate-100 p-2 text-slate-400 hover:text-slate-600 transition-colors text-xs font-medium"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleAddBullet}>
                    + Add Release Bullet
                  </Button>
                  <span className="text-[10px] text-slate-400">(Up to {MAX_UPDATE_BULLETS} bullets allowed)</span>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateForm.isPublished}
                      onChange={(event) => setUpdateForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Publish immediately to clients
                  </label>
                  <Button type="submit" variant="primary" size="sm" disabled={publishingUpdate}>
                    {publishingUpdate ? 'Publishing…' : 'Publish update'}
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
        </div>

        <CreateFirmModal
          isOpen={showOnboardModal}
          onClose={() => setShowOnboardModal(false)}
          onSuccess={() => {
            void loadDashboard();
          }}
        />

        <LegalConsentCertificateModal
          isOpen={Boolean(selectedCertFirm)}
          onClose={() => setSelectedCertFirm(null)}
          firm={selectedCertFirm}
        />
      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminDashboard;
