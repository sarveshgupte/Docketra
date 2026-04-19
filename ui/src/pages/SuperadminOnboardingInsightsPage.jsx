import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { superadminService } from '../services/superadminService';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'PRIMARY_ADMIN', label: 'Primary Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'USER', label: 'User' },
];

const BLOCKER_OPTIONS = [
  { value: '', label: 'All blockers' },
  { value: 'zero_active_clients', label: 'Zero active clients' },
  { value: 'missing_category_or_workbasket', label: 'Missing category/workbasket' },
  { value: 'manager_without_queue', label: 'Managers without queues' },
  { value: 'user_without_dockets', label: 'Users without dockets' },
  { value: 'tutorial_skipped_incomplete', label: 'Tutorial skipped + incomplete' },
  { value: 'stale_onboarding', label: 'Stale onboarding state' },
];

const COMPLETION_OPTIONS = [
  { value: 'all', label: 'All states' },
  { value: 'incomplete', label: 'Incomplete only' },
  { value: 'completed', label: 'Completed only' },
  { value: 'stale', label: 'Stale only' },
];

const STALE_OPTIONS = [3, 7, 14, 30];
const SINCE_OPTIONS = [7, 30, 60, 90];

const prettyBlocker = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const buildFirmDetailQuery = ({ blockerType, completionState, staleAfterDays, sinceDays }) => {
  const query = new URLSearchParams();
  if (blockerType) query.set('blockerType', blockerType);
  if (completionState) query.set('completionState', completionState);
  if (staleAfterDays) query.set('staleAfterDays', String(staleAfterDays));
  if (sinceDays) query.set('sinceDays', String(sinceDays));
  return query.toString();
};

export const SuperadminOnboardingInsightsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [details, setDetails] = useState(null);
  const [filters, setFilters] = useState({
    sinceDays: Number(searchParams.get('sinceDays') || 30),
    staleAfterDays: Number(searchParams.get('staleAfterDays') || 7),
    role: searchParams.get('role') || '',
    blockerType: searchParams.get('blockerType') || '',
    completionState: searchParams.get('completionState') || 'all',
    limit: 50,
  });

  const loadInsights = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryResponse, detailResponse] = await Promise.all([
        superadminService.getOnboardingInsights({
          sinceDays: filters.sinceDays,
          staleAfterDays: filters.staleAfterDays,
          recentLimit: 20,
        }),
        superadminService.getOnboardingInsightDetails(filters),
      ]);

      if (!summaryResponse?.success || !detailResponse?.success) {
        throw new Error('Insights unavailable');
      }

      setSummary(summaryResponse.data);
      setDetails(detailResponse.data);
    } catch (loadError) {
      setSummary(null);
      setDetails(null);
      setError('Unable to load onboarding insights right now. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInsights();
  }, [filters.sinceDays, filters.staleAfterDays, filters.role, filters.blockerType, filters.completionState]);


  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.sinceDays) next.set('sinceDays', String(filters.sinceDays));
    if (filters.staleAfterDays) next.set('staleAfterDays', String(filters.staleAfterDays));
    if (filters.role) next.set('role', filters.role);
    if (filters.blockerType) next.set('blockerType', filters.blockerType);
    if (filters.completionState) next.set('completionState', filters.completionState);
    setSearchParams(next, { replace: true });
  }, [filters.sinceDays, filters.staleAfterDays, filters.role, filters.blockerType, filters.completionState, setSearchParams]);

  const topPriorities = useMemo(() => {
    if (!details?.topBlockers?.length) return [];
    const total = details.topBlockers.reduce((sum, row) => sum + Number(row.count || 0), 0) || 1;
    return details.topBlockers.slice(0, 5).map((row) => ({
      ...row,
      priority: Math.round((Number(row.count || 0) / total) * 100),
    }));
  }, [details]);

  const toFirmDetailPath = (firmId, blockerOverride = '') => {
    const query = buildFirmDetailQuery({
      blockerType: blockerOverride || filters.blockerType,
      completionState: filters.completionState,
      staleAfterDays: filters.staleAfterDays,
      sinceDays: filters.sinceDays,
    });
    return query
      ? `/app/superadmin/onboarding-insights/${firmId}?${query}`
      : `/app/superadmin/onboarding-insights/${firmId}`;
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading onboarding insight details..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Onboarding Insights</h1>
            <p className="text-sm text-gray-500">Operational triage view for stuck firms and users.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/app/superadmin')}>Back to Platform Dashboard</Button>
            <Button variant="primary" onClick={() => navigate('/app/superadmin/firms')}>Open Firms Management</Button>
          </div>
        </div>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={filters.sinceDays} onChange={(event) => setFilters((prev) => ({ ...prev, sinceDays: Number(event.target.value) }))}>
              {SINCE_OPTIONS.map((days) => <option key={days} value={days}>Last {days} days</option>)}
            </select>
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={filters.staleAfterDays} onChange={(event) => setFilters((prev) => ({ ...prev, staleAfterDays: Number(event.target.value) }))}>
              {STALE_OPTIONS.map((days) => <option key={days} value={days}>Stale after {days} days</option>)}
            </select>
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={filters.role} onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))}>
              {ROLE_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={filters.blockerType} onChange={(event) => setFilters((prev) => ({ ...prev, blockerType: event.target.value }))}>
              {BLOCKER_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
            <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={filters.completionState} onChange={(event) => setFilters((prev) => ({ ...prev, completionState: event.target.value }))}>
              {COMPLETION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Button variant="ghost" onClick={loadInsights}>Refresh</Button>
          </div>
        </Card>

        {error ? <Card><p className="text-sm text-red-600">{error}</p></Card> : null}

        {!details ? (
          <Card>
            <EmptyState title="Insights unavailable" description="Try reloading onboarding insight details." actionLabel="Retry" onAction={loadInsights} />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Card><p className="text-xs text-gray-500">Firms in view</p><p className="text-2xl font-semibold text-gray-900">{details?.totals?.firms || 0}</p></Card>
              <Card><p className="text-xs text-gray-500">Users in view</p><p className="text-2xl font-semibold text-gray-900">{details?.totals?.users || 0}</p></Card>
              <Card><p className="text-xs text-gray-500">Stale onboarding users</p><p className="text-2xl font-semibold text-amber-700">{details?.totals?.staleUsers || 0}</p></Card>
              <Card><p className="text-xs text-gray-500">Needs follow-up firms</p><p className="text-2xl font-semibold text-rose-700">{details?.totals?.needsFollowUpFirms || 0}</p></Card>
            </div>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Top blockers & priority</h2>
              {topPriorities.length ? (
                <div className="space-y-2">
                  {topPriorities.map((row) => (
                    <div key={row.type} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-900">{prettyBlocker(row.type)}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600">{row.count} impacted • {row.priority}% priority weight</span>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const matchingFirm = (details?.firms || []).find((firm) => (firm.blockers || []).includes(row.type));
                              if (matchingFirm?.firmId) navigate(toFirmDetailPath(matchingFirm.firmId, row.type));
                            }}
                          >
                            Open impacted firm
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-500">No blockers matched current filters.</p>}
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Firms needing triage</h2>
              {!details.firms?.length ? <p className="text-sm text-gray-500">No firm blockers found for current filters.</p> : (
                <div className="space-y-2">
                  {details.firms.slice(0, 12).map((firm) => (
                    <div key={firm.firmId} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{firm.name} {firm.firmCode ? `(${firm.firmCode})` : ''}</p>
                          <p className="text-xs text-gray-500">{firm.nextAction} • {firm.incompleteUsers}/{firm.users} users incomplete • {firm.staleUsers} stale</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="primary" onClick={() => navigate(toFirmDetailPath(firm.firmId))}>Open onboarding detail</Button>
                          <Button variant="secondary" onClick={() => navigate('/app/superadmin/firms')}>Open firm controls</Button>
                          {firm.firmSlug ? <Link className="text-sm text-blue-600 underline" to={`/f/${firm.firmSlug}/login`} target="_blank" rel="noreferrer">Firm login URL</Link> : null}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">Blockers: {(firm.blockers || []).map(prettyBlocker).join(', ') || 'None'}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Users needing follow-up</h2>
              {!details.users?.length ? <p className="text-sm text-gray-500">No users matched current filters.</p> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Role</th>
                        <th className="py-2 pr-3">Firm</th>
                        <th className="py-2 pr-3">Progress</th>
                        <th className="py-2 pr-3">Incomplete steps</th>
                        <th className="py-2 pr-3">Tutorial</th>
                        <th className="py-2 pr-3">Refresh</th>
                        <th className="py-2 pr-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.users.slice(0, 20).map((user) => (
                        <tr key={user.userId} className="border-t border-gray-100 align-top">
                          <td className="py-2 pr-3 font-medium text-gray-900">{user.userXID || user.userId.slice(-6)}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.role}</td>
                          <td className="py-2 pr-3 text-gray-700">{details.firms?.find((firm) => firm.firmId === user.firmId)?.name || '—'}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.completedSteps}/{user.totalSteps}</td>
                          <td className="py-2 pr-3 text-gray-700">{(user.incompleteStepIds || []).slice(0, 3).join(', ') || '—'}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.tutorial?.skipped ? 'Skipped' : (user.tutorial?.completed ? 'Completed' : 'Pending')}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.lastProgressRefreshedAt ? new Date(user.lastProgressRefreshedAt).toLocaleString() : 'Never'}</td>
                          <td className="py-2 pr-3">
                            <Button variant="ghost" onClick={() => navigate(toFirmDetailPath(user.firmId))}>Open firm detail</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Recent onboarding events</h2>
              {!details.recentEvents?.length ? <p className="text-sm text-gray-500">No recent onboarding events in selected timeframe.</p> : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {details.recentEvents.slice(0, 12).map((event, index) => (
                    <li key={`${event.eventName}-${index}`} className="rounded border border-slate-200 p-2">
                      <strong>{event.eventName}</strong> • {event.role || 'N/A'} • {event.stepId || '—'} • {new Date(event.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {summary?.tutorialFunnel ? (
              <Card className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">Tutorial completion snapshot</h2>
                <p className="text-sm text-gray-700">Completed: {summary.tutorialFunnel.completed || 0} • Skipped: {summary.tutorialFunnel.skipped || 0} • Skipped + still incomplete (&gt;{summary?.timeframe?.staleAfterDays || 3} days): {summary.tutorialFunnel.skippedStillIncompleteAfterThreshold || 0}</p>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminOnboardingInsightsPage;
