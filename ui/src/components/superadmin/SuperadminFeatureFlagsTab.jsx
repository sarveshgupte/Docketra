import React from 'react';
import { Button } from '../common/Button';

const RISK_BADGE_MAP = {
  high: 'bg-rose-500/10 text-rose-600 border border-rose-500/15',
  medium: 'bg-amber-500/10 text-amber-600 border border-amber-500/15',
  low: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/15',
};

export const SuperadminFeatureFlagsTab = ({ featureFlags, loading = false, onOpenFlags }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Feature flags config</h2>
        <p className="text-xs text-slate-500">Selective product rollout gates and high-risk overrides.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onOpenFlags}>
        Manage Flags
      </Button>
    </div>

    {loading ? (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
        {[0, 1, 2, 3].map((skeleton) => (
          <div key={skeleton} className="h-28 rounded-lg border border-slate-100 bg-slate-50" />
        ))}
      </div>
    ) : !featureFlags?.flags?.length ? (
      <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
        <span className="text-slate-400 font-bold block">No feature flags registered</span>
        <p className="text-xs text-slate-500 mt-1">Platform rollouts are currently hard-gated in compile code.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(featureFlags.flags || []).map((flag) => (
          <div
            key={flag.key}
            className="rounded-lg border border-slate-100 p-3 bg-slate-50/30 flex flex-col justify-between min-h-[110px] text-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono font-bold text-indigo-600">{flag.key}</span>
                <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${RISK_BADGE_MAP[flag.riskLevel] || RISK_BADGE_MAP.low}`}>
                  {flag.riskLevel || 'low'} risk
                </span>
              </div>
              <p className="font-bold text-slate-800 text-xs">{flag.label || flag.name || 'Core Module Gate'}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]">{flag.description || 'Rollout toggle'}</p>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Globally enabled:</span>
              <span className={`font-bold uppercase text-[10px] ${flag.enabledGlobally ? 'text-emerald-600' : 'text-slate-400'}`}>
                {flag.enabledGlobally ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
