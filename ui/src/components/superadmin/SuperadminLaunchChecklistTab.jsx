import React, { useMemo } from 'react';
import { Button } from '../common/Button';

const GAUGE_RADIUS = 35;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const STATUS_DOT_MAP = {
  pass: 'bg-emerald-500',
  watch: 'bg-amber-500',
  fail: 'bg-rose-500',
};

export const SuperadminLaunchChecklistTab = ({
  pilotReadiness,
  summary,
  loading = false,
  onOpenChecklist,
  onNavigate,
}) => {
  const dashoffset = useMemo(() => {
    const score = Math.min(100, Math.max(0, summary.score));
    return GAUGE_CIRCUMFERENCE - (GAUGE_CIRCUMFERENCE * score) / 100;
  }, [summary.score]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-36 rounded-xl border border-slate-200 bg-white" />
        <div className="h-48 rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-1">Launch Readiness Summary</h3>
        <p className="text-xs text-slate-500 mb-4">Checklist audit scoring for firm onboarding and system configuration.</p>

        <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50/50 p-5 rounded-xl border border-slate-100 relative overflow-hidden">
          <div className="relative flex items-center justify-center h-28 w-28 shrink-0">
            <svg className="h-full w-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="indigoSkyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0EA5E9" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r={GAUGE_RADIUS} fill="transparent" stroke="#E2E8F0" strokeWidth="5.5" />
              <circle
                cx="50"
                cy="50"
                r={GAUGE_RADIUS}
                fill="transparent"
                stroke="url(#indigoSkyGradient)"
                strokeWidth="5.5"
                strokeDasharray={GAUGE_CIRCUMFERENCE}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
              />
            </svg>
            <div className="relative text-center select-none">
              <p className="text-2xl font-black font-mono text-slate-800 leading-none">{summary.score}</p>
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-1">Readiness</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex rounded-xs px-2 py-0.5 text-xs font-bold border uppercase tracking-wider ${
                  summary.overall === 'READY'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {summary.overall}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Checked: {pilotReadiness?.generatedAt ? new Date(pilotReadiness.generatedAt).toLocaleString() : 'Today'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Telemetry checklist determines pilot provisioning readiness across security, storage, and capacity gates.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
              <span className="text-emerald-600">✓ {summary.pass} Pass</span>
              <span className="text-amber-600">⚠ {summary.watch} Warning</span>
              <span className="text-rose-500">✗ {summary.fail} Blocker</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Checklist review</h2>
            <p className="text-xs text-slate-500">Checklist items validating firm capabilities and systems integration.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenChecklist}>
            Full Checklist
          </Button>
        </div>

        {!pilotReadiness?.checklist?.length ? (
          <p className="text-sm text-slate-500 text-center py-4">No checklist metrics loaded.</p>
        ) : (
          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            {(pilotReadiness.checklist || []).map((item) => (
              <div
                key={item.key}
                className="rounded-lg border border-slate-100 p-3 bg-slate-50/30 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT_MAP[item.status] || STATUS_DOT_MAP.fail}`} />
                    {item.label}
                  </p>
                  <p className="text-slate-500 leading-relaxed">{item.summary}</p>
                  {item.evidence ? (
                    <p className="text-[10px] text-slate-400 font-mono">
                      <strong className="text-indigo-400 font-medium">Evidence:</strong> {item.evidence}
                    </p>
                  ) : null}
                  {item.nextAction ? (
                    <p className="text-[10px] text-indigo-600">
                      <strong className="text-indigo-500 font-bold">Action:</strong> {item.nextAction}
                    </p>
                  ) : null}
                </div>

                {item.href ? (
                  <Button variant="outline" size="sm" onClick={() => onNavigate(item.href)}>
                    Inspect
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
