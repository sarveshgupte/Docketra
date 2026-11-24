/**
 * GatewayUptimeGrid Component
 * Adapted from Kokonut UI status & uptime card components with /better-interface polish:
 * - Displays 30-day / 90-day availability history for government portals (MCA V3, GSTN, BYOS)
 * - Interactive ticks with keyboard accessibility and date/latency tooltips
 * - WCAG 2.2 AA compliant: never relies on color alone (rich aria-labels and status text)
 * - B2B SaaS density with tabular typography
 */

import React, { useState } from 'react';
import {
  Globe,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const GatewayUptimeGrid = ({
  gatewayName = 'MCA V3 Portal',
  category = 'Government Gateway',
  uptimePercentage = 99.85,
  currentStatus = 'operational', // 'operational' | 'degraded' | 'outage'
  currentLatencyMs = 148,
  days = 30, // 30 or 90
  history = [], // Array of { date: string, status: 'operational'|'degraded'|'outage'|'maintenance', latencyMs?: number, incident?: string }
  className = '',
}) => {
  const [activeTick, setActiveTick] = useState(null);

  // Fallback history generation if not provided
  const data = React.useMemo(() => {
    if (history && history.length > 0) return history;
    const generated = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      // Occasional realistic degradation
      let st = 'operational';
      let lat = 120 + Math.floor(Math.sin(i * 1.5) * 40 + Math.random() * 30);
      let inc = undefined;
      if (i === 12) {
        st = 'degraded';
        lat = 680;
        inc = 'MCA V3 OTP validation latency spike';
      } else if (i === 4) {
        st = 'degraded';
        lat = 490;
        inc = 'SRN acknowledgment queue backlog';
      }
      generated.push({ date: dateStr, status: st, latencyMs: lat, incident: inc });
    }
    return generated;
  }, [history, days]);

  return (
    <div
      role="region"
      aria-label={`${gatewayName} uptime and reliability monitor`}
      className={cn(
        'w-full rounded-[var(--dt-radius-card,8px)] border border-slate-200/90 bg-white p-4 shadow-sm text-slate-900',
        className
      )}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--dt-radius-control,4px)] bg-slate-100 text-slate-700">
            <Globe className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 leading-tight">
              {gatewayName}
            </h4>
            <span className="text-[10.5px] text-slate-500 font-medium">{category}</span>
          </div>
        </div>

        {/* Live operational summary */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
            <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
            <span>{currentLatencyMs}ms</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              {currentStatus === 'operational' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              )}
            </span>
            <span className="text-[11px] font-semibold text-slate-900">
              {currentStatus === 'operational' ? 'Operational' : 'Degraded'}
            </span>
          </div>
        </div>
      </div>

      {/* Ticks Grid */}
      <div className="mt-3.5">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 mb-1.5">
          <span>{days} days ago</span>
          <span className="font-mono font-semibold text-emerald-700">{uptimePercentage}% Uptime</span>
          <span>Today</span>
        </div>

        {/* Bar ticks */}
        <div className="flex items-center gap-[2.5px] w-full h-8 py-1">
          {data.map((tick, idx) => {
            const isOp = tick.status === 'operational';
            const isDeg = tick.status === 'degraded';
            const isOut = tick.status === 'outage';

            return (
              <div
                key={idx}
                tabIndex={0}
                role="button"
                aria-label={`${tick.date}: ${tick.status}, ${tick.latencyMs}ms latency${tick.incident ? `. Note: ${tick.incident}` : ''}`}
                onMouseEnter={() => setActiveTick(tick)}
                onMouseLeave={() => setActiveTick(null)}
                onFocus={() => setActiveTick(tick)}
                onBlur={() => setActiveTick(null)}
                className={cn(
                  'flex-1 h-full rounded-[1.5px] transition-[transform,opacity] duration-100 cursor-pointer select-none',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:scale-125 z-10',
                  'hover:scale-110 hover:opacity-100',
                  isOp && 'bg-emerald-500/85 hover:bg-emerald-600',
                  isDeg && 'bg-amber-400 hover:bg-amber-500',
                  isOut && 'bg-rose-500 hover:bg-rose-600',
                  !isOp && !isDeg && !isOut && 'bg-slate-300'
                )}
              />
            );
          })}
        </div>

        {/* Active Tick Detail / Inspection Strip */}
        <div className="mt-2 min-h-[22px] flex items-center justify-between text-[11px] px-2 py-1 rounded bg-slate-50 border border-slate-100">
          {activeTick ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{activeTick.date}:</span>
                <span
                  className={cn(
                    'font-medium capitalize',
                    activeTick.status === 'operational' && 'text-emerald-700',
                    activeTick.status === 'degraded' && 'text-amber-800',
                    activeTick.status === 'outage' && 'text-rose-700'
                  )}
                >
                  {activeTick.status}
                </span>
                {activeTick.incident && (
                  <span className="text-slate-500 text-[10.5px] hidden sm:inline">
                    ({activeTick.incident})
                  </span>
                )}
              </div>
              <span className="font-mono text-slate-500 font-medium">{activeTick.latencyMs}ms</span>
            </>
          ) : (
            <span className="text-slate-400 text-[10.5px]">
              Hover or focus on any date bar above to inspect latency and statutory incident logs
            </span>
          )}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[10.5px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[1px] bg-emerald-500" />
            Operational
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[1px] bg-amber-400" />
            Degraded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[1px] bg-rose-500" />
            Outage
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">Automated Probe Checks</span>
      </div>
    </div>
  );
};
