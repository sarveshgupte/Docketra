import React, { useEffect, useState } from 'react';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { superadminService } from '../services/superadminService';

const pretty = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const SuperadminDiagnosticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);

  const loadDiagnostics = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await superadminService.getSupportDiagnostics({ limit: 20 });
      if (!response?.success) {
        throw new Error('Diagnostics unavailable');
      }
      setDiagnostics(response.data);
    } catch (_error) {
      setDiagnostics(null);
      setError('Unable to load support diagnostics right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDiagnostics();
  }, []);

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading support diagnostics..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Support Diagnostics</h1>
            <p className="text-sm text-gray-500">Redacted support console for onboarding, auth, storage, and API health triage.</p>
          </div>
          <Button variant="secondary" onClick={loadDiagnostics}>Refresh</Button>
        </div>

        {error ? <Card><p className="text-sm text-red-600">{error}</p></Card> : null}

        {diagnostics ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card><p className="text-xs text-gray-500">Firms in scope</p><p className="text-2xl font-semibold text-gray-900">{diagnostics?.totals?.firmsInScope || 0}</p></Card>
              <Card><p className="text-xs text-gray-500">Needs onboarding follow-up</p><p className="text-2xl font-semibold text-amber-700">{diagnostics?.totals?.firmsNeedingOnboardingFollowUp || 0}</p></Card>
              <Card>
                <p className="text-xs text-gray-500">Slow endpoint summary (p50 / p95)</p>
                <p className="text-2xl font-semibold text-gray-900">{diagnostics?.slowEndpointSummary?.p50Ms ?? '-'} / {diagnostics?.slowEndpointSummary?.p95Ms ?? '-'} ms</p>
                <p className="text-xs text-gray-500 mt-1">Samples: {diagnostics?.slowEndpointSummary?.sampleCount || 0}</p>
              </Card>
            </div>

            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Firm + onboarding + storage status</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-3">Firm</th>
                      <th className="py-2 pr-3">Firm status</th>
                      <th className="py-2 pr-3">Onboarding</th>
                      <th className="py-2 pr-3">Storage</th>
                      <th className="py-2">Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(diagnostics.firms || []).map((firm) => (
                      <tr key={firm.firmId} className="border-t border-gray-100 align-top">
                        <td className="py-2 pr-3">
                          <p className="font-medium text-gray-900">{firm.firmName}</p>
                          <p className="text-xs text-gray-500">{firm.firmCode}</p>
                        </td>
                        <td className="py-2 pr-3">{pretty(firm.firmStatus)}</td>
                        <td className="py-2 pr-3">
                          <p>Incomplete: {firm.onboarding?.incompleteUsers || 0}</p>
                          <p>Stale: {firm.onboarding?.staleUsers || 0}</p>
                          <p className="text-xs text-gray-500">{(firm.onboarding?.blockers || []).slice(0, 2).map(pretty).join(', ') || 'No blockers'}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <p>{pretty(firm.storageMode)} · {pretty(firm.storageProvider)}</p>
                          <p className="text-xs text-gray-500">Health: {pretty(firm.storageHealthStatus)}</p>
                        </td>
                        <td className="py-2">{firm.onboarding?.nextAction || 'Unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Card className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">Recent failed login/OTP issues (redacted)</h2>
                {!(diagnostics.loginAndOtpIssues || []).length ? <p className="text-sm text-gray-500">No recent failures observed.</p> : (
                  <ul className="space-y-2 text-xs">
                    {diagnostics.loginAndOtpIssues.map((entry, idx) => (
                      <li key={`${entry.timestamp}-${idx}`} className="rounded border border-gray-200 p-2">
                        <p className="font-medium text-gray-800">{entry.actionType} · {entry.reasonCode}</p>
                        <p className="text-gray-500">{new Date(entry.timestamp).toLocaleString()} · requestId: {entry.requestId || 'n/a'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">Recent API error counts (by category)</h2>
                {!(diagnostics.apiErrorCountsByCategory || []).length ? <p className="text-sm text-gray-500">No API error counts available.</p> : (
                  <ul className="space-y-2 text-sm">
                    {diagnostics.apiErrorCountsByCategory.map((row) => (
                      <li key={row.category} className="flex items-center justify-between rounded border border-gray-200 p-2">
                        <span>{pretty(row.category)}</span>
                        <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card>
              <h2 className="text-lg font-semibold text-gray-900">Request IDs for support tracing</h2>
              <p className="mt-2 text-xs text-gray-600 break-all">{(diagnostics.requestIds || []).join(', ') || 'No request IDs captured yet.'}</p>
            </Card>
          </>
        ) : null}
      </div>
    </SuperAdminLayout>
  );
};


export default SuperadminDiagnosticsPage;
