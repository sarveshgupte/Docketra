import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { superadminService } from '../services/superadminService';

const STATUS_BADGE_MAP = {
  pass: { label: 'Pass', badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dotClass: 'bg-emerald-500' },
  ready: { label: 'Pass', badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dotClass: 'bg-emerald-500' },
  watch: { label: 'Warning', badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/20', dotClass: 'bg-amber-500' },
  fail: { label: 'Blocker', badgeClass: 'bg-rose-50 text-rose-700 ring-rose-600/20', dotClass: 'bg-rose-500' },
};

const RELATED_SURFACES = [
  { label: 'Firm Health', path: '/app/superadmin/firm-health' },
  { label: 'Plans & Capacity', path: '/app/superadmin/plans' },
  { label: 'Onboarding Insights', path: '/app/superadmin/onboarding-insights' },
  { label: 'Support Diagnostics', path: '/app/superadmin/diagnostics' },
  { label: 'Audit Logs', path: '/app/superadmin/audit' },
];

const getStatusBadge = (status) => {
  const norm = String(status || '').toLowerCase();
  const config = STATUS_BADGE_MAP[norm] || STATUS_BADGE_MAP.fail;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ring-1 ${config.badgeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
};

export const SuperadminPilotReadinessPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'issues' | 'pass'

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await superadminService.getPilotReadiness();
      setData(res?.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load pilot readiness.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const list = data?.checklist || [];
    const pass = list.filter((i) => i.status === 'pass').length;
    const watch = list.filter((i) => i.status === 'watch').length;
    const fail = list.filter((i) => i.status === 'fail').length;
    return { pass, watch, fail, total: list.length };
  }, [data]);

  const filteredChecklist = useMemo(() => {
    const list = data?.checklist || [];
    if (filter === 'issues') {
      return list.filter((i) => i.status === 'fail' || i.status === 'watch');
    }
    if (filter === 'pass') {
      return list.filter((i) => i.status === 'pass');
    }
    return list;
  }, [data, filter]);

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading pilot readiness..." />
      </SuperAdminLayout>
    );
  }

  const overallStatus = String(data?.overallStatus || 'NOT_READY').toUpperCase();

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header Block */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Pilot Readiness Checklist
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Pilot Readiness uses platform metadata only and does not inspect client records, dockets, tasks, attachments, documents, or private client content.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load}>
              Refresh Audit
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-rose-800">
                  Readiness Snapshot Unavailable
                </h3>
                <p className="mt-0.5 text-xs text-rose-600">{error}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={load}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {/* Data View */}
        {data ? (
          <>
            {/* Top Score & Health Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Overall Status
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={`rounded-md px-2.5 py-1 text-sm font-bold uppercase tracking-wider ${
                      overallStatus === 'READY'
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                        : overallStatus === 'WATCH' || overallStatus === 'READY_WITH_WARNINGS'
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                        : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                    }`}
                  >
                    {overallStatus}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Audit evaluated {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : 'now'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Readiness Score
                </span>
                <p className="mt-2 text-2xl font-bold font-mono text-slate-900">
                  {data.score ?? 0}
                  <span className="text-sm font-normal text-slate-400"> / 100</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Weighted launch sentinel score</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Checks Passed
                </span>
                <p className="mt-2 text-2xl font-bold font-mono text-emerald-600">
                  {summary.pass}
                  <span className="text-sm font-normal text-slate-400"> / {summary.total}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Verified platform gates</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Blockers & Warnings
                </span>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-2xl font-bold font-mono text-rose-600">
                    {summary.fail}
                  </span>
                  <span className="text-xs text-slate-400">blockers</span>
                  <span className="text-2xl font-bold font-mono text-amber-600">
                    {summary.watch}
                  </span>
                  <span className="text-xs text-slate-400">warnings</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Requires review before pilot</p>
              </div>
            </div>

            {/* Checklist Audit Section */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Readiness Verification Gates
                  </h2>
                  <p className="text-xs text-slate-500">
                    Automated pre-flight checks across multi-tenant isolation, capacity, and security.
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  {[
                    { key: 'all', label: `All (${summary.total})` },
                    { key: 'issues', label: `Issues (${summary.fail + summary.watch})` },
                    { key: 'pass', label: `Passed (${summary.pass})` },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFilter(option.key)}
                      className={`rounded-md px-3 py-1 transition-colors ${
                        filter === option.key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist Cards */}
              <div className="space-y-3">
                {filteredChecklist.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No items in this filter view.
                  </p>
                ) : (
                  filteredChecklist.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-lg border border-slate-200/80 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">
                              {item.label}
                            </span>
                            {getStatusBadge(item.status)}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {item.summary}
                          </p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-500 font-mono">
                            <span>
                              <strong className="font-semibold text-slate-600 font-sans">Evidence:</strong> {item.evidence}
                            </span>
                            {item.nextAction && item.nextAction !== 'None' ? (
                              <span className="text-amber-700 font-sans font-medium">
                                <strong>Next Action:</strong> {item.nextAction}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {item.href ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(item.href)}
                            className="shrink-0 self-start sm:self-center"
                          >
                            Inspect
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Blockers & Warnings Summary Cards */}
            {(data.blockers?.length > 0 || data.warnings?.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.blockers?.length > 0 ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2">
                      Active Blockers ({data.blockers.length})
                    </h3>
                    <ul className="space-y-1 text-xs text-rose-700 list-disc list-inside">
                      {data.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {data.warnings?.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
                      Active Warnings ({data.warnings.length})
                    </h3>
                    <ul className="space-y-1 text-xs text-amber-700 list-disc list-inside">
                      {data.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Related Diagnostic Views */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Related Diagnostic & Control Surfaces
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {RELATED_SURFACES.map((surface) => (
                  <Button key={surface.path} variant="outline" size="sm" onClick={() => navigate(surface.path)}>
                    {surface.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : !error ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
            <p className="text-sm text-slate-500">No readiness metadata available.</p>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={load}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminPilotReadinessPage;
