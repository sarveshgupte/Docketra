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

const METRICS = [
  { key: 'healthy', label: 'Healthy', color: 'text-emerald-700', activeRing: 'ring-2 ring-emerald-500 bg-emerald-50/40' },
  { key: 'watch', label: 'Watch', color: 'text-amber-700', activeRing: 'ring-2 ring-amber-500 bg-amber-50/40' },
  { key: 'atRisk', statusKey: 'at_risk', label: 'At Risk', color: 'text-orange-700', activeRing: 'ring-2 ring-orange-500 bg-orange-50/40' },
  { key: 'critical', label: 'Critical', color: 'text-rose-700', activeRing: 'ring-2 ring-rose-500 bg-rose-50/40' },
];

export const SuperadminFirmHealthPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await superadminService.getFirmHealth({
        limit: 100,
        status: status || undefined,
        search: searchQuery || undefined,
      });
      setData(res?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Firm health is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [status, searchQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals || { healthy: 0, watch: 0, atRisk: 0, critical: 0 };
  const firms = useMemo(() => data?.firms || [], [data]);

  const handleMetricClick = (key) => {
    const targetStatus = key === 'atRisk' ? 'at_risk' : key;
    setStatus((prev) => (prev === targetStatus ? '' : targetStatus));
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const handleClearFilters = () => {
    setStatus('');
    setSearchInput('');
    setSearchQuery('');
  };

  const isFiltered = Boolean(status || searchQuery);

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
          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Reset filters
              </button>
            )}
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Privacy Boundary Banner */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-800 flex items-start gap-2">
          <span className="font-semibold shrink-0">Privacy boundary:</span>
          <span>
            This view only evaluates platform lifecycle/support metadata. It does not inspect client records, dockets, tasks, attachments, credentials, or private firm content.
          </span>
        </div>

        {/* Totals Metric Cards (Clickable for rapid triage) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {METRICS.map((item) => {
            const itemStatus = item.statusKey || item.key;
            const isActive = status === itemStatus;
            const count = data ? totals[item.key] ?? 0 : (loading ? '—' : 0);

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleMetricClick(item.key)}
                className={`text-left rounded-xl border border-gray-200 bg-white p-4 transition-all duration-150 hover:border-gray-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                  isActive ? item.activeRing : ''
                }`}
                aria-pressed={isActive}
                aria-label={`Filter by ${item.label} (${count} firms)`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {item.label}
                  </p>
                  {isActive && (
                    <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                      Active
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${item.color}`}>
                  {count}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {isActive ? 'Click to show all' : 'Click to filter'}
                </p>
              </button>
            );
          })}
        </div>

        {/* Filters & Search Form */}
        <Card className="p-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
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
            <div className="flex-1 relative">
              <input
                aria-label="Search firm name, ID, or slug"
                type="text"
                placeholder="Search firm name, code (FIRM001), or slug..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 pr-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.slice(0, 100))}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Clear search input"
                  onClick={() => {
                    setSearchInput('');
                    setSearchQuery('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-0.5"
                >
                  ✕
                </button>
              )}
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={loading}>
              Search
            </Button>
          </form>
        </Card>

        {loading && <Loading message="Loading firm health queue..." />}

        {!loading && error && (
          <Card className="p-5 border-rose-200 bg-rose-50/30 space-y-3">
            <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
              <span>⚠</span>
              <span>{error}</span>
            </div>
            <p className="text-xs text-rose-700">
              The platform health aggregator was unable to compile the latest snapshot. Check database connectivity or retry below.
            </p>
            <Button variant="secondary" size="sm" onClick={load}>
              Retry Snapshot
            </Button>
          </Card>
        )}

        {!loading && !error && firms.length === 0 && (
          <Card className="p-6">
            <EmptyState
              title="No firms in risk queue"
              description={
                isFiltered
                  ? 'No firms match the selected filters or search query.'
                  : 'All tenant firms are healthy and operating normally.'
              }
              actionLabel={isFiltered ? 'Reset filters' : 'Refresh'}
              onAction={isFiltered ? handleClearFilters : load}
            />
          </Card>
        )}

        {!loading && !error && firms.length > 0 && (
          <Card className="p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Risk queue ({firms.length} {firms.length === 1 ? 'firm' : 'firms'})
              </h2>
              {isFiltered && (
                <span className="text-xs text-gray-500">
                  Filtered view ·{' '}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    View all
                  </button>
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 pr-4">Firm</th>
                    <th className="py-2.5 pr-4">Score</th>
                    <th className="py-2.5 pr-4">Risk Level</th>
                    <th className="py-2.5 pr-4">Signals & Reasons</th>
                    <th className="py-2.5 pr-4">Recommended Next Action</th>
                    <th className="py-2.5 text-right">Actions</th>
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] text-gray-500">
                            {firm.firmId || firm.firmSlug}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            firm.status === 'active' ? 'text-emerald-700 bg-emerald-50' : 'text-gray-600 bg-gray-100'
                          }`}>
                            {firm.status || 'active'}
                          </span>
                        </div>
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
                          <span className="text-emerald-700 bg-emerald-50/60 border border-emerald-100 px-2 py-0.5 rounded text-[11px] font-medium inline-block">
                            ✓ All systems healthy
                          </span>
                        )}
                        {/* Telemetry metadata tags */}
                        {firm.signals && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] text-gray-500">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                              Admins: {firm.signals.adminAccess?.verifiedAdmins || 0}/{firm.signals.adminAccess?.totalAdmins || 0} verified
                            </span>
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                              Storage: {firm.signals.storage?.mode === 'firm_connected' ? 'Google Drive BYOS' : 'Managed'}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 pr-4 text-gray-800">
                        <span className="font-medium text-xs">
                          {firm.nextAction || 'Continue monitoring'}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <Link
                          to={firm.href}
                          className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        >
                          Inspect Firm →
                        </Link>
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
