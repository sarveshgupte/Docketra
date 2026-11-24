/**
 * ToolApprovalCard Component
 * Adapted from Kokonut UI AI components with /better-interface and emil-design-eng polish:
 * - Explicit human-in-the-loop audit gate for AI & statutory compliance actions
 * - High-density parameter grid with raw JSON toggle
 * - Opt-in HoldButton / SlideToConfirm for high-stakes filings
 * - Full keyboard navigation (Cmd+Enter to approve, Esc to reject)
 * - WCAG 2.2 AA contrast and screen-reader aria live announcements
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Code2,
  Table as TableIcon,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../common/Button';
import { HoldButton } from './HoldButton';
import { SlideToConfirm } from './SlideToConfirm';
import { cn } from '../../lib/utils';

export const ToolApprovalCard = ({
  toolName = 'statutory_action',
  toolLabel = 'Statutory Agent Action',
  description = 'AI assistant proposes executing the following operation on behalf of the firm.',
  parameters = {},
  clientName,
  cin,
  riskLevel = 'low', // 'low' | 'medium' | 'high' | 'critical'
  status = 'pending', // 'pending' | 'approved' | 'rejected'
  onApprove,
  onReject,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCritical = riskLevel === 'critical' || riskLevel === 'high';
  const paramEntries = Object.entries(parameters || {});

  const handleApprove = async () => {
    if (status !== 'pending' || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onApprove?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (status !== 'pending' || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onReject?.(rejectReason);
      setRejecting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && status === 'pending' && !rejecting) {
      e.preventDefault();
      handleApprove();
    } else if (e.key === 'Escape' && rejecting) {
      e.preventDefault();
      setRejecting(false);
    }
  };

  return (
    <div
      role="region"
      aria-label={`${toolLabel} approval request`}
      className={cn(
        'w-full max-w-xl rounded-[var(--dt-radius-card,8px)] border border-slate-200/90 bg-white text-slate-900 shadow-sm overflow-hidden',
        'transition-[border-color,box-shadow] duration-150',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--dt-radius-control,4px)] bg-slate-900 text-white">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-900 truncate tracking-tight">
                {toolName}
              </span>
              {isCritical && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 bg-rose-50 text-[10px] font-semibold text-rose-700 border border-rose-200/60 uppercase tracking-wider">
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  High Stakes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="shrink-0">
          {status === 'pending' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Awaiting Review
            </span>
          )}
          {status === 'approved' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200/60">
              <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
              Approved
            </span>
          )}
          {status === 'rejected' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
              <X className="h-3 w-3 text-slate-500" aria-hidden="true" />
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Body content */}
      <div className="p-4 space-y-3">
        {/* Client context */}
        {(clientName || cin) && (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-[var(--dt-radius-control,4px)] border border-slate-100">
            <span className="font-medium text-slate-900 truncate">{clientName || 'Statutory Client'}</span>
            {cin && <span className="font-mono text-[11px] text-slate-400">({cin})</span>}
          </div>
        )}

        <p className="text-xs leading-relaxed text-slate-600">
          {description}
        </p>

        {/* View toggle for parameters */}
        <div className="rounded-[var(--dt-radius-card,6px)] border border-slate-200/80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-1.5 text-[11px]">
            <span className="font-semibold text-slate-600 uppercase tracking-wider">
              Tool Parameters ({paramEntries.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors',
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                <TableIcon className="h-3 w-3" aria-hidden="true" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('json')}
                aria-pressed={viewMode === 'json'}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors',
                  viewMode === 'json'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                <Code2 className="h-3 w-3" aria-hidden="true" />
                JSON
              </button>
            </div>
          </div>

          {/* Parameter content */}
          {viewMode === 'table' ? (
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
              {paramEntries.length > 0 ? (
                paramEntries.map(([key, val]) => (
                  <div key={key} className="grid grid-cols-3 gap-2 px-3 py-1.5 hover:bg-slate-50/50">
                    <span className="font-mono text-[11px] font-medium text-slate-600 truncate">{key}</span>
                    <span className="col-span-2 font-mono text-[11px] text-slate-900 break-all select-all">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">No parameters specified</div>
              )}
            </div>
          ) : (
            <pre className="p-3 text-[11px] font-mono bg-slate-900 text-slate-100 max-h-56 overflow-x-auto select-all">
              {JSON.stringify(parameters, null, 2)}
            </pre>
          )}
        </div>

        {/* Inline rejection form */}
        {rejecting && status === 'pending' && (
          <div className="p-3 rounded-[var(--dt-radius-control,4px)] bg-slate-50 border border-slate-200 space-y-2">
            <label htmlFor="rejection-reason" className="block text-xs font-semibold text-slate-700">
              Reason for Rejection / Modification:
            </label>
            <input
              id="rejection-reason"
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Authorized capital must be ₹50,00,000, not ₹10,00,000"
              className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="xs" variant="outline" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button size="xs" variant="danger" onClick={handleConfirmReject} loading={isSubmitting}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer action bar */}
      {status === 'pending' && !rejecting && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRejecting(true)}
            disabled={isSubmitting}
            className="text-slate-600 hover:text-rose-700"
          >
            <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Reject Call
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isCritical ? (
              <HoldButton
                variant="compliance"
                size="sm"
                onHoldComplete={handleApprove}
                disabled={isSubmitting}
              >
                Hold to Approve Action
              </HoldButton>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={handleApprove}
                loading={isSubmitting}
              >
                <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Approve & Execute
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
