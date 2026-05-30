import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { superadminService } from '../services/superadminService';
import { useToast } from '../hooks/useToast';
import { productUpdatesService } from '../services/productUpdatesService';
import { APP_VERSION } from '../utils/constants';

const safeCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const getStorageIssueCount = (diagnostics) => (diagnostics?.firms || []).filter((firm) => {
  const health = String(firm?.storageHealthStatus || '').toUpperCase();
  return health && health !== 'HEALTHY';
}).length;

// Beautiful inline SVG Icons for a premium Light Glassmorphism Cockpit
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
  VitalsTab: () => (
    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  ),
  AuditTab: () => (
    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  PerformanceTab: () => (
    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  LaunchTab: () => (
    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  FlagsTab: () => (
    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  ConsoleLink: () => (
    <svg className="h-5 w-5 text-indigo-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Info: () => (
    <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export const SuperadminDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Platform telemetry hooks
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [firmHealth, setFirmHealth] = useState(null);
  const [plans, setPlans] = useState(null);
  const [pilotReadiness, setPilotReadiness] = useState(null);
  const [featureFlags, setFeatureFlags] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [onboardingAlerts, setOnboardingAlerts] = useState([]);

  // UI Interactive States
  const [activeTab, setActiveTab] = useState('vitals'); // 'vitals' | 'security' | 'performance' | 'launch' | 'flags'
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time HUD Clock ticks
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedClock = useMemo(() => {
    const dateStr = currentTime.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = currentTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return { dateStr, timeStr };
  }, [currentTime]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    const [
      statsRes,
      insightsRes,
      diagnosticsRes,
      healthRes,
      plansRes,
      pilotRes,
      featureRes,
      auditRes,
      alertsRes,
    ] = await Promise.allSettled([
      superadminService.getPlatformStats(),
      superadminService.getOnboardingInsights({ sinceDays: 30, staleAfterDays: 7, recentLimit: 20 }),
      superadminService.getSupportDiagnostics({ limit: 20 }),
      superadminService.getFirmHealth({ limit: 100 }),
      superadminService.getPlansCapacity(),
      superadminService.getPilotReadiness(),
      superadminService.getFeatureFlags(),
      superadminService.getAuditLogs({ limit: 12 }),
      superadminService.getOnboardingAlerts({ status: 'open', limit: 8 }),
    ]);

    const statsData = statsRes.status === 'fulfilled' && statsRes.value?.success ? statsRes.value.data : null;
    const insightsData = insightsRes.status === 'fulfilled' && insightsRes.value?.success ? insightsRes.value.data : null;
    const diagnosticsData = diagnosticsRes.status === 'fulfilled' && diagnosticsRes.value?.success ? diagnosticsRes.value.data : null;
    const healthData = healthRes.status === 'fulfilled' && healthRes.value?.success ? healthRes.value.data : null;

    setStats(statsData);
    setInsights(insightsData);
    setDiagnostics(diagnosticsData);
    setFirmHealth(healthData);
    setPlans(plansRes.status === 'fulfilled' && plansRes.value?.success ? plansRes.value.data : null);
    setPilotReadiness(pilotRes.status === 'fulfilled' && pilotRes.value?.success ? pilotRes.value.data : null);
    setFeatureFlags(featureRes.status === 'fulfilled' && featureRes.value?.success ? featureRes.value.data : null);
    setAuditLogs(auditRes.status === 'fulfilled' && auditRes.value?.success ? (auditRes.value.data || []) : []);
    setOnboardingAlerts(alertsRes.status === 'fulfilled' && alertsRes.value?.success ? (alertsRes.value.data?.alerts || []) : []);

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

  // Telemetry mappings
  const totalFirms = safeCount(stats?.totalFirms);
  const activeFirms = safeCount(stats?.activeFirms);
  const inactiveFirms = safeCount(stats?.inactiveFirms);
  const totalUsers = safeCount(stats?.totalUsers);
  
  const averageUsersPerFirm = useMemo(() => {
    return totalFirms > 0 ? (totalUsers / totalFirms).toFixed(1) : '0';
  }, [totalUsers, totalFirms]);

  const otpFailures = safeCount((diagnostics?.loginAndOtpIssues || []).length);
  const slowP95 = diagnostics?.slowEndpointSummary?.p95Ms;

  const staleOnboarding = safeCount(insights?.summary?.staleUsers || insights?.totals?.staleUsers);
  const storageIssues = getStorageIssueCount(diagnostics);
  const unverifiedAdmins = safeCount((diagnostics?.firms || []).filter((firm) => firm?.admin?.emailVerified === false).length);
  const authIssues = safeCount((diagnostics?.loginAndOtpIssues || []).length);

  // Filtered lists for rendering
  const criticalFirms = useMemo(() => {
    return (firmHealth?.firms || [])
      .filter((f) => f.riskLevel === 'critical' || f.riskLevel === 'at_risk')
      .slice(0, 4);
  }, [firmHealth]);

  const pilotReadySummary = useMemo(() => {
    const checklist = pilotReadiness?.checklist || [];
    return {
      pass: checklist.filter((i) => i.status === 'pass').length,
      watch: checklist.filter((i) => i.status === 'watch').length,
      fail: checklist.filter((i) => i.status === 'fail').length,
      overall: pilotReadiness?.overallStatus || 'NOT_READY',
      score: safeCount(pilotReadiness?.score || 0)
    };
  }, [pilotReadiness]);

  // Pilot Circular Progress Stroke math
  const radialGaugeCircumference = 2 * Math.PI * 35; // 219.91
  const radialGaugeDashoffset = useMemo(() => {
    const score = Math.min(100, Math.max(0, pilotReadySummary.score));
    return radialGaugeCircumference - (radialGaugeCircumference * score) / 100;
  }, [pilotReadySummary.score]);

  // Product Updates Sentinel States & Handlers
  const MAX_UPDATE_BULLETS = 5;
  const [updateForm, setUpdateForm] = useState({
    title: '',
    bullets: ['', '', ''],
    isPublished: true,
    version: '',
  });
  const [publishingUpdate, setPublishingUpdate] = useState(false);

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
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to publish update.');
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
        <Loading message="Preparing platform Command Cockpit..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6 relative">
        
        {/* Soft Background blur aura glows (White Glassmorphic lighting) */}
        <div className="absolute top-0 -left-10 h-80 w-80 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="absolute bottom-20 -right-10 h-80 w-80 bg-sky-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

        {/* 1. PERSONALIZED FOUNDER COMMAND HUD HEADER */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-white via-indigo-50/20 to-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-indigo-100/80 z-10">
          
          {/* Laser Status Pulser */}
          <div className="absolute right-6 top-6 flex items-center gap-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Platform Active</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 border border-indigo-500/20 shadow-sm">
                  ★ Owner & Founder Command Bridge
                </span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Platform Command Center</h1>
              <h2 className="mt-0.5 text-lg font-semibold text-indigo-600">Welcome back, Sarvesh</h2>
              <p className="mt-2.5 text-sm text-slate-500 max-w-xl">
                Absolute platform view-control at your fingertips. Oversee client registrations, onboarding health, latency bounds, and tenant audit trails.
              </p>
            </div>
            
            {/* Dynamic System HUD Clock */}
            <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200 p-3.5 flex items-center gap-4 self-start md:self-auto shadow-sm">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{formattedClock.dateStr}</p>
                <p className="text-xl font-mono font-black tracking-widest text-indigo-600">{formattedClock.timeStr}</p>
              </div>
              <div className="h-9 w-px bg-slate-200" />
              <Button 
                variant="primary" 
                onClick={loadDashboard}
                allowUnsafeClassName={true}
                className="!min-h-9 !px-3.5 !py-1 text-xs border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-sm hover:shadow shadow-indigo-600/10"
              >
                Reload Diagnostics
              </Button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm z-10 relative">
            <div>
              <h4 className="font-semibold text-rose-600 text-sm">Command center telemetry failure</h4>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
            <Button variant="secondary" onClick={loadDashboard}>Retry Diagnostics</Button>
          </div>
        ) : null}

        {/* 2. THE TELEMETRY VIEW CONTROLLER (HUD INTERACTIVE TAB SELECTORS) */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-1 z-10 relative">
          {[
            { id: 'vitals', label: '📊 Ecosystem Vitals' },
            { id: 'security', label: '🛡️ Security Audits' },
            { id: 'performance', label: '⚡ Performance Traces' },
            { id: 'launch', label: '🚀 Launch Checklist' },
            { id: 'flags', label: '⚙️ Feature Flags' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-bold tracking-wide transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3. DYNAMIC HUD SUB-VIEWS */}
        <div className="z-10 relative">
          
          {/* ==================== TAB A: ECOSYSTEM VITALS ==================== */}
          {activeTab === 'vitals' && (
            <div className="space-y-6">
              
              {/* PLATFORM VITALS GRID */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                
                {/* VITALS TILE 1: REGISTERED FIRMS */}
                <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Registered Firms</span>
                    <div className="rounded-lg bg-indigo-50 p-2 border border-indigo-100">
                      <Icons.Firms />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">{totalFirms}</h3>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-indigo-600">{activeFirms} Active</span>
                      <span>{inactiveFirms} Suspended</span>
                    </div>
                    {/* Ratio visual indicator bar */}
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                      <div 
                        className="h-full bg-indigo-500 rounded-l" 
                        style={{ width: `${totalFirms > 0 ? (activeFirms / totalFirms) * 100 : 0}%` }}
                      />
                      <div 
                        className="h-full bg-slate-300 rounded-r" 
                        style={{ width: `${totalFirms > 0 ? (inactiveFirms / totalFirms) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* VITALS TILE 2: TOTAL PLATFORM USERS */}
                <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">User Footprint</span>
                    <div className="rounded-lg bg-sky-50 p-2 border border-sky-100">
                      <Icons.Users />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">{totalUsers}</h3>
                    <p className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                      <span>Total Allocated Seats</span>
                      <span className="font-semibold text-slate-700">{averageUsersPerFirm} users/firm avg</span>
                    </p>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-sky-400 w-3/4 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* VITALS TILE 3: PERFORMANCE LATENCY */}
                <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Endpoint p95</span>
                    <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-100">
                      <Icons.Performance />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {Number.isFinite(Number(slowP95)) ? `${slowP95}ms` : 'N/A'}
                    </h3>
                    <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${Number(slowP95) < 250 ? 'bg-emerald-500' : Number(slowP95) < 600 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      <span className="font-semibold text-slate-600">
                        {Number(slowP95) < 250 ? 'Excellent response' : Number(slowP95) < 600 ? 'Nominal response' : 'Slow latency threshold'}
                      </span>
                    </p>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${Number(slowP95) < 250 ? 'bg-emerald-400' : Number(slowP95) < 600 ? 'bg-amber-400' : 'bg-rose-400'}`}
                        style={{ width: `${Math.min(100, Number(slowP95) > 0 ? (Number(slowP95) / 1000) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* VITALS TILE 4: SECURITY GUARD */}
                <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Security Auth</span>
                    <div className="rounded-lg bg-rose-50 p-2 border border-rose-100">
                      <Icons.Security />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-3xl font-extrabold tracking-tight ${otpFailures > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{otpFailures}</h3>
                    <p className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                      <span>Auth Sentinel Failures</span>
                      <span className={`font-bold uppercase tracking-wider text-[10px] ${otpFailures > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-600'}`}>
                        {otpFailures === 0 ? 'Secure Shield' : 'Warning'}
                      </span>
                    </p>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${otpFailures > 0 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* IMMEDIATE ATTENTION TODAY SECTION */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="rounded-lg bg-amber-50 p-2 border border-amber-100 text-amber-600">
                    <Icons.Attention />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Needs attention today</h2>
                    <p className="text-xs text-slate-500">Telemetry logs that trigger validation errors or require founder follow-up.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  
                  {/* ATTENTION 1: STALE ONBOARDINGS */}
                  <div 
                    onClick={() => navigate('/app/superadmin/onboarding-insights')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md flex flex-col justify-between min-h-[110px] ${staleOnboarding > 0 ? 'bg-amber-50/40 border-amber-300 shadow-sm shadow-amber-500/5 hover:border-amber-400' : 'bg-slate-50/50 border-slate-200'}`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stale Onboarding</p>
                      <h4 className="mt-1 text-2xl font-black text-slate-900">{staleOnboarding}</h4>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${staleOnboarding > 0 ? 'bg-amber-500 animate-ping' : 'bg-slate-400'}`} />
                        {staleOnboarding > 0 ? 'Review users' : 'Clean funnel'}
                      </span>
                      <span className="text-indigo-600 flex items-center gap-0.5">Inspect <Icons.ArrowRight /></span>
                    </div>
                  </div>

                  {/* ATTENTION 2: STORAGE FAILURES */}
                  <div 
                    onClick={() => navigate('/app/superadmin/diagnostics')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md flex flex-col justify-between min-h-[110px] ${storageIssues > 0 ? 'bg-rose-50/40 border-rose-300 shadow-sm shadow-rose-500/5 hover:border-rose-400' : 'bg-slate-50/50 border-slate-200'}`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Storage Issues</p>
                      <h4 className="mt-1 text-2xl font-black text-slate-900">{storageIssues}</h4>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${storageIssues > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
                        {storageIssues > 0 ? 'Drives unlinked' : 'All drives online'}
                      </span>
                      <span className="text-indigo-600 flex items-center gap-0.5">Inspect <Icons.ArrowRight /></span>
                    </div>
                  </div>

                  {/* ATTENTION 3: UNVERIFIED ADMINS */}
                  <div 
                    onClick={() => navigate('/app/superadmin/firms')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md flex flex-col justify-between min-h-[110px] ${unverifiedAdmins > 0 ? 'bg-amber-50/40 border-amber-300 shadow-sm shadow-amber-500/5 hover:border-amber-400' : 'bg-slate-50/50 border-slate-200'}`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unverified Admins</p>
                      <h4 className="mt-1 text-2xl font-black text-slate-900">{unverifiedAdmins}</h4>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${unverifiedAdmins > 0 ? 'bg-amber-500 animate-ping' : 'bg-slate-400'}`} />
                        {unverifiedAdmins > 0 ? 'Invite pending' : 'All validated'}
                      </span>
                      <span className="text-indigo-600 flex items-center gap-0.5">Inspect <Icons.ArrowRight /></span>
                    </div>
                  </div>

                  {/* ATTENTION 4: RECENT LOGIN LOGOUT LOCKS */}
                  <div 
                    onClick={() => navigate('/app/superadmin/diagnostics')}
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md flex flex-col justify-between min-h-[110px] ${authIssues > 0 ? 'bg-rose-50/40 border-rose-300 shadow-sm shadow-rose-500/5 hover:border-rose-400' : 'bg-slate-50/50 border-slate-200'}`}
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Auth Locks</p>
                      <h4 className="mt-1 text-2xl font-black text-slate-900">{authIssues}</h4>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${authIssues > 0 ? 'bg-rose-500' : 'bg-slate-400'}`} />
                        {authIssues > 0 ? 'Auth failures' : 'Shield safe'}
                      </span>
                      <span className="text-indigo-600 flex items-center gap-0.5">Inspect <Icons.ArrowRight /></span>
                    </div>
                  </div>

                </div>
              </div>

              {/* DUAL SENTINELS: RISK SENTINEL & PLAN CAPACITY */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                
                {/* RISK SENTINEL PANEL */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Ecosystem Risk Sentinel</h2>
                        <p className="text-xs text-slate-500">Live operational health queues matching risk parameters.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="small" 
                        onClick={() => navigate('/app/superadmin/firm-health')}
                        allowUnsafeClassName={true}
                        className="!min-h-8 text-xs font-bold border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-600"
                      >
                        Risk Queue
                      </Button>
                    </div>

                    {criticalFirms.length === 0 ? (
                      <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/40 my-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-2">✓</span>
                        <p className="text-xs font-bold text-slate-800">All tenants operational</p>
                        <p className="text-[10px] text-slate-500">Zero active firms currently trigger high-risk sentinel metrics.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto my-2 border border-slate-100 rounded-lg shadow-sm">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left font-bold text-slate-500 border-b border-slate-100">
                              <th className="py-2.5 px-3">Firm Name</th>
                              <th className="py-2.5 px-2">Score</th>
                              <th className="py-2.5 px-2">Risk</th>
                              <th className="py-2.5 px-3">Top reasons</th>
                            </tr>
                          </thead>
                          <tbody>
                            {criticalFirms.map((firm) => (
                              <tr key={firm.firmObjectId} className="border-t border-slate-100 hover:bg-slate-50/30 transition-colors align-middle">
                                <td className="py-2.5 px-3 font-semibold">
                                  <span 
                                    onClick={() => navigate(`/app/superadmin/firms/${firm.firmObjectId}`)}
                                    className="text-indigo-600 hover:text-indigo-500 cursor-pointer underline decoration-dotted"
                                  >
                                    {firm.name}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 font-mono font-medium text-slate-600">{firm.score}</td>
                                <td className="py-2.5 px-2">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border capitalize ${
                                    firm.riskLevel === 'critical' 
                                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                                      : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                  }`}>
                                    {firm.riskLevel}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 truncate max-w-[130px]" title={firm.reasons?.join(', ')}>
                                  {firm.reasons?.slice(0, 2).join(', ') || 'None'}
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
                    <span>Safeguarded bounds</span>
                  </div>
                </div>

                {/* CAPACITY METERS PANEL */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Tenant Subscription Map</h2>
                        <p className="text-xs text-slate-500">Plan distribution and capacity ratios.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="small" 
                        onClick={() => navigate('/app/superadmin/plans')}
                        allowUnsafeClassName={true}
                        className="!min-h-8 text-xs font-bold border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-600"
                      >
                        Edit Plan Caps
                      </Button>
                    </div>

                    <div className="space-y-4 my-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">Pilot firms allocation</span>
                          <span className="font-mono text-slate-600 font-semibold">{plans?.totals?.pilot ?? 0}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, plans?.totals?.pilot ? (plans.totals.pilot / (totalFirms || 1)) * 100 : 0)}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">Near capacity limits</span>
                          <span className="font-mono text-amber-600 font-bold">{plans?.totals?.nearCapacity ?? 0}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, plans?.totals?.nearCapacity ? (plans.totals.nearCapacity / (totalFirms || 1)) * 100 : 0)}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700">Over capacity boundaries</span>
                          <span className="font-mono text-rose-500 font-bold">{plans?.totals?.overCapacity ?? 0}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${plans?.totals?.overCapacity > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} style={{ width: `${Math.min(100, plans?.totals?.overCapacity ? (plans.totals.overCapacity / (totalFirms || 1)) * 100 : 0)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="text-slate-400">Secure Billing telemetry</span>
                    <span onClick={() => navigate('/app/superadmin/plans')} className="text-indigo-600 hover:text-indigo-500 cursor-pointer font-bold hover:underline">
                      Provision caps &rarr;
                    </span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== TAB B: SECURITY & AUDIT STREAM ==================== */}
          {activeTab === 'security' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Security Audit Stream</h2>
                  <p className="text-xs text-slate-500">Real-time platform administrative mutations and authorization logs.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="small" 
                  onClick={() => navigate('/app/superadmin/audit')}
                  allowUnsafeClassName={true}
                  className="!min-h-8 text-xs font-bold border-indigo-200 text-indigo-600"
                >
                  Full Audit Logs
                </Button>
              </div>

              {!auditLogs.length ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                  <span className="text-slate-400 font-bold block">Zero system activities logged</span>
                  <p className="text-xs text-slate-500 mt-1">Audit log traces are currently empty.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {auditLogs.map((log) => {
                    const isExpanded = expandedLogId === log._id;
                    const date = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
                    return (
                      <div 
                        key={log._id} 
                        className={`rounded-lg border text-xs transition-all ${
                          isExpanded 
                            ? 'bg-slate-50/80 border-indigo-200 shadow-sm' 
                            : 'bg-white border-slate-100 hover:bg-slate-50/30'
                        }`}
                      >
                        {/* Summary Line */}
                        <div 
                          onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                          className="p-3 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded px-1.5 py-0.5 font-bold uppercase text-[9px] ${
                              String(log.actionType).includes('CREATE') 
                                ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/15' 
                                : String(log.actionType).includes('DELETE') || String(log.actionType).includes('SUSPEND')
                                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/15'
                                : 'bg-slate-500/10 text-slate-600 border border-slate-500/15'
                            }`}>
                              {log.actionType || 'UNKNOWN'}
                            </span>
                            <span className="font-semibold text-slate-800">{log.performedBy || 'System Admin'}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-slate-400">
                            <span className="font-mono text-[10px]">{log.firmName || log.firmId || 'Platform'}</span>
                            <span className="font-mono text-[10px]">{date}</span>
                            <span className="text-slate-400 text-base">{isExpanded ? '▴' : '▾'}</span>
                          </div>
                        </div>

                        {/* Collapsed Trace Detail */}
                        {isExpanded && (
                          <div className="border-t border-indigo-100/40 p-3 bg-slate-900 text-indigo-200 rounded-b-lg font-mono text-[11px] space-y-2 overflow-x-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-indigo-300">
                              <p><strong className="text-indigo-400">Action:</strong> {log.actionType}</p>
                              <p><strong className="text-indigo-400">Target Entity:</strong> {log.targetEntityType || 'N/A'} ({log.targetEntityId || 'N/A'})</p>
                              <p><strong className="text-indigo-400">Request Ref ID:</strong> {log.requestId || 'N/A'}</p>
                              <p><strong className="text-indigo-400">Origin IP:</strong> {log.ipAddress || 'N/A'}</p>
                            </div>
                            {log.userAgent && (
                              <p className="text-indigo-300/80"><strong className="text-indigo-400">User Agent:</strong> {log.userAgent}</p>
                            )}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div className="pt-2 border-t border-slate-800">
                                <p className="text-indigo-400 font-bold mb-1">Audit Metadata Context:</p>
                                <pre className="text-[10px] bg-slate-950 p-2 rounded text-indigo-200/90 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB C: PERFORMANCE & SUPPORT TRACES ==================== */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              
              {/* SLOW ENDPOINTS & LATENCY DETECT */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Slow Endpoint Telemetries</h2>
                    <p className="text-xs text-slate-500">Live API response distributions (latencies) flagged by diagnostics.</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                    Engine p95: {Number.isFinite(Number(slowP95)) ? `${slowP95}ms` : 'N/A'}
                  </div>
                </div>

                {!diagnostics?.slowEndpointSummary?.endpoints?.length ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/40">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-2">✓</span>
                    <p className="text-xs font-bold text-slate-800">Perfect response profiles</p>
                    <p className="text-[10px] text-slate-500">No endpoints are currently registering high latencies.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left font-bold text-slate-500 border-b border-slate-100">
                          <th className="py-2.5 px-3">HTTP Route</th>
                          <th className="py-2.5 px-2">Requests</th>
                          <th className="py-2.5 px-2">p50 latency</th>
                          <th className="py-2.5 px-2 text-rose-500">p95 Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(diagnostics.slowEndpointSummary.endpoints || []).slice(0, 5).map((ep, idx) => (
                          <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/30 font-mono">
                            <td className="py-2.5 px-3 text-slate-700 font-semibold truncate max-w-[200px]" title={ep.endpoint}>
                              <span className="text-[10px] font-bold bg-slate-100 px-1 rounded mr-1.5 uppercase text-slate-500">{ep.method || 'GET'}</span>
                              {ep.endpoint}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 font-bold">{ep.count || 0}</td>
                            <td className="py-2.5 px-2 text-slate-500">{ep.p50Ms || ep.avgMs || '0'}ms</td>
                            <td className="py-2.5 px-2 text-rose-600 font-bold">{ep.p95Ms || ep.maxMs || '0'}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* AUTH & OTP EXCEPTION SENTINELS */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Auth / OTP Traces</h2>
                    <p className="text-xs text-slate-500">Locked accounts, authentication failures, and OTP delivery exceptions.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="small" 
                    onClick={() => navigate('/app/superadmin/diagnostics')}
                    allowUnsafeClassName={true}
                    className="!min-h-8 text-xs font-bold border-indigo-200 text-indigo-600"
                  >
                    Support Panel
                  </Button>
                </div>

                {!diagnostics?.loginAndOtpIssues?.length ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/40">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-2">✓</span>
                    <p className="text-xs font-bold text-slate-800">Zero authentication failures</p>
                    <p className="text-[10px] text-slate-500">All logins and OTP validations completed without exceptions.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left font-bold text-slate-500 border-b border-slate-100">
                          <th className="py-2.5 px-3">Affected Entity</th>
                          <th className="py-2.5 px-2">Type</th>
                          <th className="py-2.5 px-2">Error / Code</th>
                          <th className="py-2.5 px-3">Trace Log</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(diagnostics.loginAndOtpIssues || []).slice(0, 5).map((issue, idx) => (
                          <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/30">
                            <td className="py-2.5 px-3 font-semibold text-slate-800 font-mono text-[11px]">{issue.emailMasked || issue.performedBy || issue.actor || 'Guest User'}</td>
                            <td className="py-2.5 px-2">
                              <span className="bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                {issue.actionType || issue.issueType || 'AUTH_FAIL'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-slate-600 text-[10px]">{issue.errorCode || issue.code || 'OTP_INVALID'}</td>
                            <td className="py-2.5 px-3 text-slate-500 truncate max-w-[200px]" title={issue.details || issue.userAgent}>
                              {issue.details || issue.userAgent || 'Telemetry lockout threshold triggered'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================== TAB D: LAUNCH CHECKLIST & BLOCKERS ==================== */}
          {activeTab === 'launch' && (
            <div className="space-y-6">
              
              {/* RADAR SPEED DIAL RADAR BLOCK */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-1">Launch Readiness Sentinel</h3>
                <p className="text-xs text-slate-500 mb-4">Checklist audit scoring for firm onboarding and system configuration.</p>
                
                <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                  
                  {/* Neon SVG Gradient radial score dial */}
                  <div className="relative flex items-center justify-center h-28 w-28 shrink-0">
                    <Icons.Firms />
                    <svg className="h-full w-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="indigoSkyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#0EA5E9" /> {/* Sky blue */}
                          <stop offset="100%" stopColor="#4F46E5" /> {/* Deep indigo */}
                        </linearGradient>
                        <filter id="gaugeShadow">
                          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#4F46E5" floodOpacity="0.2" />
                        </filter>
                      </defs>
                      {/* Background circle track */}
                      <circle cx="50" cy="50" r="35" fill="transparent" stroke="#E2E8F0" strokeWidth="5.5" />
                      {/* Active circular gauge track */}
                      <circle
                        cx="50"
                        cy="50"
                        r="35"
                        fill="transparent"
                        stroke="url(#indigoSkyGradient)"
                        strokeWidth="5.5"
                        strokeDasharray={radialGaugeCircumference}
                        strokeDashoffset={radialGaugeDashoffset}
                        strokeLinecap="round"
                        filter="url(#gaugeShadow)"
                        style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                      />
                    </svg>
                    {/* Inner score overlay */}
                    <div className="absolute text-center select-none">
                      <p className="text-2xl font-black font-mono text-slate-800 leading-none">{pilotReadySummary.score}</p>
                      <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-1">Readiness</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border uppercase tracking-wider ${
                        pilotReadySummary.overall === 'READY' 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25 animate-pulse' 
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/25'
                      }`}>
                        {pilotReadySummary.overall}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Checked: {pilotReadiness?.generatedAt || 'Today'}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Telemetry checklist determines pilot provisioning capabilities. Pass items must equal 100% to activate automated sandbox domains.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                      <span className="text-emerald-600">✓ {pilotReadySummary.pass} Pass</span>
                      <span className="text-amber-600">⚠ {pilotReadySummary.watch} Warning</span>
                      <span className="text-rose-500">✗ {pilotReadySummary.fail} Blocker</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DETAILED CHECKLIST REVIEWS */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Checklist review</h2>
                    <p className="text-xs text-slate-500">Checklist items validating firm capabilities and systems integration.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="small" 
                    onClick={() => navigate('/app/superadmin/pilot-readiness')}
                    allowUnsafeClassName={true}
                    className="!min-h-8 text-xs font-bold border-indigo-200 text-indigo-600"
                  >
                    Full Checklist
                  </Button>
                </div>

                {!pilotReadiness?.checklist?.length ? (
                  <p className="text-sm text-slate-500 text-center py-4">No checklist metrics loaded.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {(pilotReadiness.checklist || []).map((item) => (
                      <div key={item.key} className="rounded-lg border border-slate-100 p-3 bg-slate-50/30 hover:bg-slate-50/60 transition-all flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className={`inline-block h-2 w-2 rounded-full ${
                              item.status === 'pass' ? 'bg-emerald-500' : item.status === 'watch' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                            {item.label}
                          </p>
                          <p className="text-slate-500 leading-relaxed">{item.summary}</p>
                          {item.evidence && (
                            <p className="text-[10px] text-slate-400 font-mono"><strong className="text-indigo-400 font-medium">Evidence:</strong> {item.evidence}</p>
                          )}
                          {item.nextAction && (
                            <p className="text-[10px] text-indigo-600"><strong className="text-indigo-500 font-bold">Action:</strong> {item.nextAction}</p>
                          )}
                        </div>

                        {item.href && (
                          <Button 
                            variant="outline" 
                            size="small" 
                            onClick={() => navigate(item.href)}
                            allowUnsafeClassName={true}
                            className="!min-h-8 text-[11px] font-semibold text-slate-600 border-slate-200 bg-white"
                          >
                            Open bounds
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================== TAB E: FEATURE FLAGS ==================== */}
          {activeTab === 'flags' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Feature flags config</h2>
                  <p className="text-xs text-slate-500">Selective product rollout gates and high-risk overrides.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="small" 
                  onClick={() => navigate('/app/superadmin/feature-flags')}
                  allowUnsafeClassName={true}
                  className="!min-h-8 text-xs font-bold border-indigo-200 text-indigo-600"
                >
                  Manage Flags
                </Button>
              </div>

              {!featureFlags?.flags?.length ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
                  <span className="text-slate-400 font-bold block">No feature flags registered</span>
                  <p className="text-xs text-slate-500 mt-1">Platform rollouts are currently hard-gated in compile code.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(featureFlags.flags || []).map((flag) => (
                    <div key={flag.key} className="rounded-lg border border-slate-100 p-3 bg-slate-50/30 flex flex-col justify-between min-h-[110px] text-xs">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-bold text-indigo-600">{flag.key}</span>
                          <span className={`inline-flex rounded px-1 text-[9px] font-bold uppercase tracking-wider ${
                            flag.riskLevel === 'high' 
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/15' 
                              : flag.riskLevel === 'medium'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/15'
                          }`}>
                            {flag.riskLevel || 'low'} risk
                          </span>
                        </div>
                        <p className="font-bold text-slate-800 text-xs">{flag.name || 'Core Module Gate'}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-[250px]">{flag.description || 'Rollout toggle'}</p>
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Globally enabled:</span>
                        <span className={`font-bold uppercase text-[10px] ${flag.enabledGlobally ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`}>
                          {flag.enabledGlobally ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* 4. FOUNDER'S QUICK LAUNCH CONSOLE */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm z-10 relative">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="rounded-lg bg-indigo-50 p-2 border border-indigo-100 text-indigo-600">
              <Icons.ConsoleLink />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Founder's Quick Launch Console</h2>
              <p className="text-xs text-slate-500">Direct portal links to provision settings and inspect metadata.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* LINK 1: FIRMS */}
            <div 
              onClick={() => navigate('/app/superadmin/firms')}
              className="group cursor-pointer rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:bg-slate-900/5 hover:border-indigo-400 hover:shadow-sm"
            >
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Firms Management</h4>
              <p className="text-[10px] text-slate-400 mt-1">Manage, suspend, or provision secure tenant bounds.</p>
            </div>

            {/* LINK 2: ONBOARDING */}
            <div 
              onClick={() => navigate('/app/superadmin/onboarding-insights')}
              className="group cursor-pointer rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:bg-slate-900/5 hover:border-indigo-400 hover:shadow-sm"
            >
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Onboarding Insights</h4>
              <p className="text-[10px] text-slate-400 mt-1">Analyze client registration velocity and onboarding flow.</p>
            </div>

            {/* LINK 3: FIRM HEALTH */}
            <div 
              onClick={() => navigate('/app/superadmin/firm-health')}
              className="group cursor-pointer rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:bg-slate-900/5 hover:border-indigo-400 hover:shadow-sm"
            >
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Firm Health</h4>
              <p className="text-[10px] text-slate-400 mt-1">Track tenant risk metrics and health score logs.</p>
            </div>

            {/* LINK 4: PLANS */}
            <div 
              onClick={() => navigate('/app/superadmin/plans')}
              className="group cursor-pointer rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:bg-slate-900/5 hover:border-indigo-400 hover:shadow-sm"
            >
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Plans & Capacity</h4>
              <p className="text-[10px] text-slate-400 mt-1">Adjust subscription plans, max user bounds, and billing.</p>
            </div>

            {/* LINK 5: FEATURE FLAGS */}
            <div 
              onClick={() => navigate('/app/superadmin/feature-flags')}
              className="group cursor-pointer rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:bg-slate-900/5 hover:border-indigo-400 hover:shadow-sm"
            >
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Feature Flags</h4>
              <p className="text-[10px] text-slate-400 mt-1">Safely toggle new modules and manage selective rollouts.</p>
            </div>

            {/* LINK 6: PILOT READINESS */}
            <div 
              onClick={() => navigate('/app/superadmin/pilot-readiness')}
              className="group cursor-pointer rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:bg-slate-900/5 hover:border-indigo-400 hover:shadow-sm"
            >
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Pilot Readiness</h4>
              <p className="text-[10px] text-slate-400 mt-1">Audit platform readiness score and resolve blockers.</p>
            </div>

            {/* LINK 7: SUPPORT DIAGNOSTICS */}
            <div 
              onClick={() => navigate('/app/superadmin/diagnostics')}
              className="group cursor-pointer rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:bg-slate-900/5 hover:border-indigo-400 hover:shadow-sm"
            >
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Support Diagnostics</h4>
              <p className="text-[10px] text-slate-400 mt-1">Trace failed authentication attempts and slow request times.</p>
            </div>

            {/* LINK 8: AI ASSISTANT */}
            <div 
              onClick={() => navigate('/app/superadmin/ai-assistant')}
              className="group cursor-pointer rounded-xl border border-indigo-200 p-4 transition-all duration-200 hover:bg-indigo-600/5 hover:border-indigo-500 hover:shadow-sm bg-indigo-50/10"
            >
              <h4 className="font-bold text-indigo-600 text-sm flex items-center gap-1">
                AI Assistant
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              </h4>
              <p className="text-[10px] text-slate-400 mt-1">Consult the Product, Developer, or Marketing Gemini intelligence.</p>
            </div>

          </div>
        </div>

        {/* 5. PRODUCT UPDATES SENTINEL */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm z-10 relative">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <h2 className="text-lg font-bold text-slate-900">Product Updates Publisher</h2>
            </div>
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
              Release Sentinel
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Publish the latest platform release notes shown to users upon their next secure login context.
          </p>

          <form className="space-y-4" onSubmit={handleCreateUpdate}>
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
                    placeholder={`Highlight bullet point detail`}
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
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleAddBullet}
                  allowUnsafeClassName={true}
                  className="!min-h-9 !px-3 !py-1 text-xs border-slate-200 text-slate-700 font-semibold"
                >
                  + Add Release Bullet
                </Button>
                <span className="text-[10px] text-slate-400">
                  (Up to {MAX_UPDATE_BULLETS} bullets allowed)
                </span>
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
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={publishingUpdate}
                  allowUnsafeClassName={true}
                  className="!min-h-9 !px-4 !py-1.5 text-xs font-bold border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {publishingUpdate ? 'Publishing…' : 'Publish update'}
                </Button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminDashboard;
