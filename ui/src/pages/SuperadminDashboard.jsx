import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { superadminService } from '../services/superadminService';

const safeCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const getStorageIssueCount = (diagnostics) => (diagnostics?.firms || []).filter((firm) => {
  const health = String(firm?.storageHealthStatus || '').toUpperCase();
  return health && health !== 'HEALTHY';
}).length;

export const SuperadminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [firmHealth, setFirmHealth] = useState(null);
  const [plans, setPlans] = useState(null);
  const [pilotReadiness, setPilotReadiness] = useState(null);
  const [featureFlags, setFeatureFlags] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    const [statsRes, insightsRes, diagnosticsRes, healthRes, plansRes, pilotRes, featureRes] = await Promise.allSettled([
      superadminService.getPlatformStats(),
      superadminService.getOnboardingInsights({ sinceDays: 30, staleAfterDays: 7, recentLimit: 20 }),
      superadminService.getSupportDiagnostics({ limit: 20 }),
      superadminService.getFirmHealth({ limit: 100 }),
      superadminService.getPlansCapacity(),
      superadminService.getPilotReadiness(),
      superadminService.getFeatureFlags(),
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

  const kpis = useMemo(() => {
    const totalFirms = safeCount(stats?.totalFirms);
    const activeFirms = safeCount(stats?.activeFirms);
    const inactiveFirms = safeCount(stats?.inactiveFirms);
    const totalUsers = safeCount(stats?.totalUsers);
    const followUpFirms = safeCount(insights?.totals?.needsFollowUpFirms || diagnostics?.totals?.firmsNeedingOnboardingFollowUp);
    const otpFailures = safeCount((diagnostics?.loginAndOtpIssues || []).length);
    const slowP95 = diagnostics?.slowEndpointSummary?.p95Ms;

    return [
      { label: 'Total firms', value: totalFirms },
      { label: 'Active firms', value: activeFirms },
      { label: 'Suspended / inactive firms', value: inactiveFirms },
      { label: 'Total users', value: totalUsers },
      { label: 'Firms needing onboarding follow-up', value: followUpFirms },
      { label: 'Recent auth/OTP failures', value: otpFailures },
      { label: 'Slow endpoint p95 (ms)', value: Number.isFinite(Number(slowP95)) ? Number(slowP95) : 'N/A' },
    ];
  }, [stats, insights, diagnostics]);

  const attentionRows = useMemo(() => {
    const staleOnboarding = safeCount(insights?.summary?.staleUsers || insights?.totals?.staleUsers);
    const storageIssues = getStorageIssueCount(diagnostics);
    const unverifiedAdmins = safeCount((diagnostics?.firms || []).filter((firm) => firm?.admin?.emailVerified === false).length);
    const authIssues = safeCount((diagnostics?.loginAndOtpIssues || []).length);

    return [
      { label: 'Stale onboarding firms/users', value: staleOnboarding, severity: staleOnboarding > 0 ? 'text-amber-700' : 'text-gray-900' },
      { label: 'Firms with storage health issues', value: storageIssues, severity: storageIssues > 0 ? 'text-rose-700' : 'text-gray-900' },
      { label: 'Admins not verified / invite pending', value: unverifiedAdmins, severity: unverifiedAdmins > 0 ? 'text-amber-700' : 'text-gray-900' },
      { label: 'Recent failed login/OTP issues', value: authIssues, severity: authIssues > 0 ? 'text-rose-700' : 'text-gray-900' },
    ];
  }, [insights, diagnostics]);

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading platform command center..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Platform Command Center</h1>
            <p className="text-sm text-gray-500">Cross-firm operational health without exposing client, docket, task, or attachment content.</p>
          </div>
          <Button variant="secondary" onClick={loadDashboard}>Refresh</Button>
        </div>

        {error ? (
          <Card>
            <div className="space-y-3">
              <p className="text-sm text-amber-700">{error}</p>
              <Button type="button" variant="secondary" onClick={loadDashboard}>Retry</Button>
            </div>
          </Card>
        ) : null}

        {!stats && !insights && !diagnostics ? (
          <Card>
            <EmptyState title="Command center unavailable" description="No platform metrics are available right now." actionLabel="Retry" onAction={loadDashboard} />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <Card key={kpi.label}>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className="text-2xl font-semibold text-gray-900">{kpi.value}</p>
                </Card>
              ))}
            </div>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Needs attention today</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {attentionRows.map((row) => (
                  <div key={row.label} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm text-gray-500">{row.label}</p>
                    <p className={`text-xl font-semibold ${row.severity}`}>{row.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Firm Health / Risk Queue</h2>
              <p className="text-sm text-gray-600">Critical: {firmHealth?.totals?.critical || 0} · At risk: {firmHealth?.totals?.atRisk || 0}</p>
              <p className="text-sm text-gray-600">Pilot: {plans?.totals?.pilot ?? 'N/A'} · Near capacity: {plans?.totals?.nearCapacity ?? 'N/A'} · Over capacity: {plans?.totals?.overCapacity ?? 'N/A'}</p>
              <Button variant="secondary" onClick={() => navigate('/app/superadmin/firm-health')}>Open Firm Health Queue</Button>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Rollout summary</h2>
              <p className="text-sm text-gray-600">{featureFlags ? `Total flags: ${featureFlags.flags?.length || 0} · High-risk enabled globally: ${(featureFlags.flags || []).filter((f) => f.riskLevel === 'high' && f.enabledGlobally).length}` : 'Feature flag rollout summary unavailable.'}</p>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Quick links</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => navigate('/app/superadmin/firms')}>Firms Management</Button>
                <Button variant="secondary" onClick={() => navigate('/app/superadmin/onboarding-insights')}>Onboarding Insights</Button>
                <Button variant="secondary" onClick={() => navigate('/app/superadmin/firm-health')}>Firm Health</Button>
                <Button variant="secondary" onClick={() => navigate('/app/superadmin/plans')}>Plans & Capacity</Button>
                <Button variant="secondary" onClick={() => navigate('/app/superadmin/feature-flags')}>Feature Flags</Button>
                <Button variant="secondary" onClick={() => navigate('/app/superadmin/pilot-readiness')}>Pilot Readiness{pilotReadiness ? ` (${pilotReadiness.overallStatus} · ${pilotReadiness.score})` : ''}</Button>
                <Button variant="secondary" onClick={() => navigate('/app/superadmin/diagnostics')}>Support Diagnostics</Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminDashboard;
