import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { superadminService } from '../services/superadminService';

const prettyBlocker = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const buildGuidance = ({ firm, users = [] }) => {
  const guidance = [];

  if (!firm?.missingSetup?.hasActiveClient) {
    guidance.push('Needs first active client');
  }
  if (!firm?.missingSetup?.hasCategory || !firm?.missingSetup?.hasPrimaryWorkbasket) {
    guidance.push('Needs category/workbasket setup');
  }
  if (users.some((user) => user.role === 'MANAGER' && (user.blockers || []).includes('manager_without_queue'))) {
    guidance.push('Managers need queue assignment');
  }
  if (users.some((user) => user.role === 'USER' && (user.blockers || []).includes('user_without_dockets'))) {
    guidance.push('Users have no assigned dockets');
  }
  if (users.some((user) => (user.blockers || []).includes('tutorial_skipped_incomplete'))) {
    guidance.push('Tutorial skipped but setup still incomplete');
  }

  return guidance;
};

export const SuperadminFirmOnboardingDetailPage = () => {
  const navigate = useNavigate();
  const { firmId } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);

  const blockerType = searchParams.get('blockerType') || '';
  const completionState = searchParams.get('completionState') || 'all';
  const staleAfterDays = Number(searchParams.get('staleAfterDays') || 7);
  const sinceDays = Number(searchParams.get('sinceDays') || 30);

  const loadDetails = async () => {
    if (!firmId) return;

    setLoading(true);
    setError('');
    try {
      const response = await superadminService.getOnboardingInsightDetails({
        firmId,
        blockerType,
        completionState,
        staleAfterDays,
        sinceDays,
        limit: 100,
      });

      if (!response?.success) {
        throw new Error('Firm detail unavailable');
      }

      setDetails(response.data);
    } catch (loadError) {
      setDetails(null);
      setError('Unable to load firm onboarding detail right now. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetails();
  }, [firmId, blockerType, completionState, staleAfterDays, sinceDays]);

  const firm = details?.firms?.[0] || null;
  const firmUsers = useMemo(
    () => (details?.users || []).filter((user) => String(user.firmId) === String(firmId)),
    [details, firmId],
  );

  const guidance = useMemo(() => buildGuidance({ firm, users: firmUsers }), [firm, firmUsers]);
  const tutorialSkippedIncompleteCount = useMemo(
    () => firmUsers.filter((user) => (user.blockers || []).includes('tutorial_skipped_incomplete')).length,
    [firmUsers],
  );

  const backToInsightsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (blockerType) params.set('blockerType', blockerType);
    if (completionState) params.set('completionState', completionState);
    if (Number.isFinite(staleAfterDays) && staleAfterDays > 0) params.set('staleAfterDays', String(staleAfterDays));
    if (Number.isFinite(sinceDays) && sinceDays > 0) params.set('sinceDays', String(sinceDays));
    const query = params.toString();
    return query ? `/app/superadmin/onboarding-insights?${query}` : '/app/superadmin/onboarding-insights';
  }, [blockerType, completionState, staleAfterDays, sinceDays]);

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading firm onboarding detail..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Firm Onboarding Detail</h1>
            <p className="text-sm text-gray-500">Operational drill-down for firm-specific onboarding triage.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(backToInsightsUrl)}>Back to Insights</Button>
            <Button variant="primary" onClick={() => navigate('/app/superadmin/firms')}>Open firm controls</Button>
          </div>
        </div>

        {error ? <Card><p className="text-sm text-red-600">{error}</p></Card> : null}

        {!details || !firm ? (
          <Card>
            <EmptyState title="No firm onboarding detail found" description="This firm has no onboarding detail for the selected filters." actionLabel="Retry" onAction={loadDetails} />
          </Card>
        ) : (
          <>
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{firm.name}</h2>
                  <p className="text-xs text-gray-500">{firm.firmCode || 'N/A'} • {firm.firmSlug || 'No slug'} • {firm.status || 'Unknown status'}</p>
                </div>
                {firm.firmSlug ? <Link className="text-sm text-blue-600 underline" to={`/f/${firm.firmSlug}/login`} target="_blank" rel="noreferrer">Firm login URL</Link> : null}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card><p className="text-xs text-gray-500">Incomplete users</p><p className="text-2xl font-semibold text-rose-700">{firm.incompleteUsers || 0}</p></Card>
                <Card><p className="text-xs text-gray-500">Stale users</p><p className="text-2xl font-semibold text-amber-700">{firm.staleUsers || 0}</p></Card>
                <Card><p className="text-xs text-gray-500">Tutorial skipped + incomplete</p><p className="text-2xl font-semibold text-violet-700">{tutorialSkippedIncompleteCount}</p></Card>
                <Card><p className="text-xs text-gray-500">Top blockers in firm</p><p className="text-sm font-semibold text-gray-900">{(firm.blockers || []).slice(0, 3).map(prettyBlocker).join(', ') || 'None'}</p></Card>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">Active client: <strong>{firm.missingSetup?.hasActiveClient ? 'Present' : 'Missing'}</strong></div>
                <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">Category: <strong>{firm.missingSetup?.hasCategory ? 'Present' : 'Missing'}</strong></div>
                <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">Workbasket: <strong>{firm.missingSetup?.hasPrimaryWorkbasket ? 'Present' : 'Missing'}</strong></div>
              </div>
            </Card>

            <Card className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Recommended next actions</h2>
              {!guidance.length ? <p className="text-sm text-gray-500">No high-risk blockers detected. Continue monitoring and nudge pending users.</p> : (
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                  {guidance.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Users needing follow-up</h2>
              {!firmUsers.length ? <p className="text-sm text-gray-500">No users matched current filter state in this firm.</p> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Role</th>
                        <th className="py-2 pr-3">xID</th>
                        <th className="py-2 pr-3">Progress</th>
                        <th className="py-2 pr-3">Incomplete steps</th>
                        <th className="py-2 pr-3">Tutorial</th>
                        <th className="py-2 pr-3">Stale</th>
                        <th className="py-2 pr-3">Refresh</th>
                        <th className="py-2 pr-3">Blockers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firmUsers.map((user) => (
                        <tr key={user.userId} className="border-t border-gray-100 align-top">
                          <td className="py-2 pr-3 font-medium text-gray-900">{user.userXID || user.userId.slice(-6)}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.role}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.userXID || '—'}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.completedSteps}/{user.totalSteps}</td>
                          <td className="py-2 pr-3 text-gray-700">{(user.incompleteStepIds || []).slice(0, 4).join(', ') || '—'}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.tutorial?.skipped ? 'Skipped' : (user.tutorial?.completed ? 'Completed' : 'Pending')}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.isStale ? 'Yes' : 'No'}</td>
                          <td className="py-2 pr-3 text-gray-700">{user.lastProgressRefreshedAt ? new Date(user.lastProgressRefreshedAt).toLocaleString() : 'Never'}</td>
                          <td className="py-2 pr-3 text-gray-700">{(user.blockers || []).map(prettyBlocker).join(', ') || 'None'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Recent onboarding events (firm)</h2>
              {!details.recentEvents?.length ? <p className="text-sm text-gray-500">No recent onboarding events for this firm in selected timeframe.</p> : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {details.recentEvents.slice(0, 12).map((event, index) => (
                    <li key={`${event.eventName}-${index}`} className="rounded border border-slate-200 p-2">
                      <strong>{event.eventName}</strong> • {event.role || 'N/A'} • {event.stepId || '—'} • {new Date(event.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminFirmOnboardingDetailPage;
