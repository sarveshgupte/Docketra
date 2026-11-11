import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { superadminService } from '../services/superadminService';

const RISK_BADGES = {
  healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  at_risk: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

const formatRiskLabel = (level) => {
  switch (level) {
    case 'healthy':
      return 'Healthy';
    case 'watch':
      return 'Watch';
    case 'at_risk':
      return 'At Risk';
    case 'critical':
      return 'Critical';
    default:
      return level || 'Unknown';
  }
};

const getScoreColor = (score) => {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
  if (score >= 40) return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
};

export const SuperadminFirmHealthPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await superadminService.getFirmHealth({
        limit: 100,
        status: status || undefined,
        search: search || undefined,
      });
      setData(res?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Firm health is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals || { healthy: 0, watch: 0, atRisk: 0, critical: 0 };
  const firms = useMemo(() => data?.firms || [], [data]);

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Firm Health & Risk Queue
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Automated operational telemetry & risk scoring for tenant lifecycle, admin access, storage, and onboarding.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Privacy Boundary Banner */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-800 flex items-start gap-2">
          <span className="font-semibold shrink-0">Privacy Boundary:</span>
          <span>
            This view only evaluates platform lifecycle/support metadata. It does not inspect client records, dockets, tasks, attachments, credentials, or private firm content.
          </span>
        </div>

        {/* Totals Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Healthy', count: totals.healthy, color: 'text-emerald-700' },
            { label: 'Watch', count: totals.watch, color: 'text-amber-700' },
            { label: 'At Risk', count: totals.atRisk, color: 'text-orange-700' },
            { label: 'Critical', count: totals.critical, color: 'text-rose-700' },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {item.label}
              </p>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${item.color}`}>
                {item.count || 0}
              </p>
            </Card>
          ))}
        </div>

        {/* Filters & Search */}
        <Card className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              aria-label="Filter by risk level"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All risk levels</option>
              <option value="healthy">Healthy</option>
              <option value="watch">Watch</option>
              <option value="at_risk">At risk</option>
              <option value="critical">Critical</option>
            </select>
            <input
              aria-label="Search firm name, ID, or slug"
              type="text"
              placeholder="Search firm name, code (FIRM001), or slug..."
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
              value={search}
              onChange={(e) => setSearch(e.target.value.slice(0, 100))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load();
              }}
            />
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
              Apply filters
            </Button>
          </div>
        </Card>

        {loading && <Loading message="Loading firm health queue..." />}

        {!loading && error && (
          <Card className="p-4 space-y-3">
            <p className="text-sm text-rose-700">{error}</p>
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          </Card>
        )}

        {!loading && !error && firms.length === 0 && (
          <Card className="p-6">
            <EmptyState
              title="No firms in risk queue"
              description="No firms matched the selected filters."
              actionLabel="Reset filters"
              onAction={() => {
                setStatus('');
                setSearch('');
              }}
            />
          </Card>
        )}

        {!loading && !error && firms.length > 0 && (
          <Card className="p-5 overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Firm Health Queue ({firms.length} firms)
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 pr-4">Firm</th>
                    <th className="py-2.5 pr-4">Score</th>
                    <th className="py-2.5 pr-4">Risk Level</th>
                    <th className="py-2.5 pr-4">Diagnostic Reasons</th>
                    <th className="py-2.5">Recommended Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {firms.map((firm) => (
                    <tr key={firm.firmObjectId} className="align-top hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 pr-4">
                        <Link
                          to={firm.href}
                          className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors block"
                        >
                          {firm.name}
                        </Link>
                        <span className="font-mono text-[11px] text-gray-500">
                          {firm.firmId || firm.firmSlug}
                        </span>
                      </td>

                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border font-mono font-bold text-xs ${getScoreColor(firm.score)}`}>
                          {firm.score} / 100
                        </span>
                      </td>

                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                            RISK_BADGES[firm.riskLevel] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {formatRiskLabel(firm.riskLevel)}
                        </span>
                      </td>

                      <td className="py-3 pr-4 max-w-md">
                        {firm.reasons && firm.reasons.length > 0 ? (
                          <ul className="space-y-1">
                            {firm.reasons.slice(0, 3).map((reason, idx) => (
                              <li key={idx} className="text-gray-700 flex items-start gap-1.5 leading-snug">
                                <span className="text-amber-500 font-bold shrink-0">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-gray-400 italic">None · Healthy posture</span>
                        )}
                      </td>

                      <td className="py-3 text-gray-800">
                        <span className="font-medium">
                          {firm.nextAction || 'Continue monitoring'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminFirmHealthPage;
