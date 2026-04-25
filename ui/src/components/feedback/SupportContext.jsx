import React from 'react';

const LabelValue = ({ label, value }) => (
  <div className="flex gap-2 text-xs text-slate-600">
    <span className="font-medium text-slate-700">{label}:</span>
    <span className="break-all">{value || '—'}</span>
  </div>
);

export const SupportContext = ({ context, className = '' }) => {
  if (!context) return null;
  const {
    requestId,
    reasonCode,
    module,
    timestamp,
    status,
  } = context;

  return (
    <div className={`mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 ${className}`.trim()}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">Support context</p>
      <div className="space-y-1">
        <LabelValue label="Request ID" value={requestId} />
        <LabelValue label="Reason code" value={reasonCode} />
        <LabelValue label="Module" value={module} />
        <LabelValue label="Status" value={status} />
        <LabelValue label="Timestamp" value={timestamp} />
      </div>
    </div>
  );
};
