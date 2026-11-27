import React from 'react';
import { Button } from '../common/Button';

export const SuperadminPerformanceTab = ({ diagnostics, slowP95, onOpenDiagnostics }) => (
  <div className="space-y-6">
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Slow Endpoint Telemetries</h2>
          <p className="text-xs text-slate-500">Live API response distributions (latencies) flagged by diagnostics.</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-100">
          Engine p95: {Number.isFinite(Number(slowP95)) ? `${slowP95}ms` : 'N/A'}
        </div>
      </div>

      {!diagnostics?.slowEndpointSummary?.endpoints?.length ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/40">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-2">✓</span>
          <p className="text-xs font-bold text-slate-800">Nominal response profiles</p>
          <p className="text-[10px] text-slate-500">No endpoints are currently registering high latencies.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left font-bold text-slate-500 border-b border-slate-100">
                <th className="py-2.5 px-3">HTTP Route</th>
                <th className="py-2.5 px-2">Requests</th>
                <th className="py-2.5 px-2">p50 latency</th>
                <th className="py-2.5 px-2 text-rose-500">p95 Latency</th>
              </tr>
            </thead>
            <tbody>
              {(diagnostics.slowEndpointSummary.endpoints || []).slice(0, 5).map((ep, idx) => (
                <tr key={ep.endpoint || idx} className="border-t border-slate-100 hover:bg-slate-50/30 font-mono">
                  <td className="py-2.5 px-3 text-slate-700 font-semibold truncate max-w-[200px]" title={ep.endpoint}>
                    <span className="text-[10px] font-bold bg-slate-100 px-1 rounded mr-1.5 uppercase text-slate-500">{ep.method || 'GET'}</span>
                    {ep.endpoint}
                  </td>
                  <td className="py-2.5 px-2 text-slate-600 font-bold">{ep.count || 0}</td>
                  <td className="py-2.5 px-2 text-slate-500">{ep.p50Ms || ep.avgMs || '0'}ms</td>
                  <td className="py-2.5 px-2 text-rose-600 font-bold">{ep.p95Ms || ep.maxMs || '0'}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Auth / OTP Traces</h2>
          <p className="text-xs text-slate-500">Locked accounts, authentication failures, and OTP delivery exceptions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenDiagnostics}>
          Support Panel
        </Button>
      </div>

      {!diagnostics?.loginAndOtpIssues?.length ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/40">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 mb-2">✓</span>
          <p className="text-xs font-bold text-slate-800">Zero authentication failures</p>
          <p className="text-[10px] text-slate-500">All logins and OTP validations completed without exceptions.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left font-bold text-slate-500 border-b border-slate-100">
                <th className="py-2.5 px-3">Affected Entity</th>
                <th className="py-2.5 px-2">Type</th>
                <th className="py-2.5 px-2">Error / Code</th>
                <th className="py-2.5 px-3">Trace Log</th>
              </tr>
            </thead>
            <tbody>
              {(diagnostics.loginAndOtpIssues || []).slice(0, 5).map((issue, idx) => (
                <tr key={issue.requestId || idx} className="border-t border-slate-100 hover:bg-slate-50/30">
                  <td className="py-2.5 px-3 font-semibold text-slate-800 font-mono text-[11px]">
                    {issue.emailMasked || issue.performedBy || issue.actor || 'Guest User'}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="bg-rose-500/10 text-rose-600 border border-rose-500/20 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">
                      {issue.actionType || issue.issueType || 'AUTH_FAIL'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-slate-600 text-[10px]">{issue.errorCode || issue.code || 'OTP_INVALID'}</td>
                  <td className="py-2.5 px-3 text-slate-500 truncate max-w-[200px]" title={issue.details || issue.userAgent}>
                    {issue.details || issue.userAgent || 'Telemetry lockout threshold triggered'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);
