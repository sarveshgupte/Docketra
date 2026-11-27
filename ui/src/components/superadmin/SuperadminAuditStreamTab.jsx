import React, { useState } from 'react';
import { Button } from '../common/Button';

const getActionBadgeClass = (actionType) => {
  const normalized = String(actionType || '').toUpperCase();
  if (normalized.includes('CREATE')) {
    return 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/15';
  }
  if (normalized.includes('DELETE') || normalized.includes('SUSPEND')) {
    return 'bg-rose-500/10 text-rose-600 border border-rose-500/15';
  }
  return 'bg-slate-500/10 text-slate-600 border border-slate-500/15';
};

export const SuperadminAuditStreamTab = ({ auditLogs, loading = false, onOpenFullLogs }) => {
  const [expandedLogId, setExpandedLogId] = useState(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Security Audit Stream</h2>
          <p className="text-xs text-slate-500">Real-time platform administrative mutations and authorization logs.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenFullLogs}>
          Full Audit Logs
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 py-2" aria-busy="true">
          {[0, 1, 2].map((skeleton) => (
            <div key={skeleton} className="h-11 rounded-lg border border-slate-100 bg-slate-50" />
          ))}
        </div>
      ) : !auditLogs.length ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/20">
          <span className="text-slate-400 font-bold block">Zero system activities logged</span>
          <p className="text-xs text-slate-500 mt-1">Audit log traces are currently empty.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {auditLogs.map((log) => {
            const isExpanded = expandedLogId === log._id;
            const date = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
            return (
              <div
                key={log._id}
                className={`rounded-lg border text-xs transition-colors ${
                  isExpanded
                    ? 'bg-slate-50/80 border-indigo-200 shadow-sm'
                    : 'bg-white border-slate-100 hover:bg-slate-50/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                  aria-expanded={isExpanded}
                  className="w-full p-3 flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded px-1.5 py-0.5 font-bold uppercase text-[9px] ${getActionBadgeClass(log.actionType)}`}>
                      {log.actionType || 'UNKNOWN'}
                    </span>
                    <span className="font-semibold text-slate-800">{log.performedBy || 'System Admin'}</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="font-mono text-[10px]">{log.firmName || log.firmId || 'Platform'}</span>
                    <span className="font-mono text-[10px]">{date}</span>
                    <span className="text-slate-400 text-base">{isExpanded ? '▴' : '▾'}</span>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-indigo-100/40 p-3 bg-slate-900 text-indigo-200 rounded-b-lg font-mono text-[11px] space-y-2 overflow-x-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-indigo-300">
                      <p><strong className="text-indigo-400">Action:</strong> {log.actionType}</p>
                      <p><strong className="text-indigo-400">Target Entity:</strong> {log.targetEntityType || 'N/A'} ({log.targetEntityId || 'N/A'})</p>
                      <p><strong className="text-indigo-400">Request Ref ID:</strong> {log.requestId || 'N/A'}</p>
                      <p><strong className="text-indigo-400">Origin IP:</strong> {log.ipAddress || 'N/A'}</p>
                    </div>
                    {log.userAgent ? (
                      <p className="text-indigo-300/80"><strong className="text-indigo-400">User Agent:</strong> {log.userAgent}</p>
                    ) : null}
                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                      <div className="pt-2 border-t border-slate-800">
                        <p className="text-indigo-400 font-bold mb-1">Audit Metadata Context:</p>
                        <pre className="text-[10px] bg-slate-950 p-2 rounded text-indigo-200/90 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
