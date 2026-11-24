/**
 * StatutoryDiffViewer Component
 * Adapted from Kokonut UI diff components with /better-interface polish:
 * - Compares statutory records (MCA master data, shareholding, resolutions)
 * - Split side-by-side or unified inline diff modes
 * - WCAG 2.2 AA compliant: never uses color alone (explicit + / - / delta badges)
 * - Tabular monospace alignment with Inter UI shell
 * - "Changes only" filter toggle for high-density compliance reviews
 */

import React, { useState, useMemo } from 'react';
import {
  Columns2,
  Rows3,
  Filter,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const StatutoryDiffViewer = ({
  items = [], // Array of { key: string, label: string, oldValue: any, newValue: any, type?: 'string'|'currency'|'number' }
  oldTitle = 'Previous Record',
  newTitle = 'Proposed / Filed Record',
  title = 'Statutory Comparison',
  subtitle,
  defaultViewMode = 'split', // 'split' | 'unified'
  className = '',
}) => {
  const [viewMode, setViewMode] = useState(defaultViewMode);
  const [showChangesOnly, setShowChangesOnly] = useState(false);

  // Compute differences
  const processedItems = useMemo(() => {
    return items.map((item) => {
      const oldStr = item.oldValue !== undefined && item.oldValue !== null ? String(item.oldValue) : '';
      const newStr = item.newValue !== undefined && item.newValue !== null ? String(item.newValue) : '';
      
      let changeType = 'unchanged';
      if (!oldStr && newStr) changeType = 'added';
      else if (oldStr && !newStr) changeType = 'removed';
      else if (oldStr !== newStr) changeType = 'modified';

      return {
        ...item,
        oldStr,
        newStr,
        changeType,
        hasChanged: changeType !== 'unchanged',
      };
    });
  }, [items]);

  const displayedItems = useMemo(() => {
    if (!showChangesOnly) return processedItems;
    return processedItems.filter((i) => i.hasChanged);
  }, [processedItems, showChangesOnly]);

  const totalChanges = processedItems.filter((i) => i.hasChanged).length;

  return (
    <div
      role="region"
      aria-label={title}
      className={cn(
        'w-full rounded-[var(--dt-radius-card,8px)] border border-slate-200/90 bg-white text-slate-900 shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              {title}
            </h3>
            {totalChanges > 0 ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
                <AlertCircle className="h-3 w-3 text-amber-600" aria-hidden="true" />
                {totalChanges} {totalChanges === 1 ? 'Change' : 'Changes'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                In Sync
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-2">
          {/* Changes only filter */}
          <button
            type="button"
            onClick={() => setShowChangesOnly((prev) => !prev)}
            aria-pressed={showChangesOnly}
            className={cn(
              'inline-flex items-center gap-1 h-7 px-2 rounded-[var(--dt-radius-control,4px)] text-xs font-medium transition-colors cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900',
              showChangesOnly
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            )}
          >
            <Filter className="h-3 w-3" aria-hidden="true" />
            <span>Changes Only</span>
          </button>

          {/* Mode switch */}
          <div className="inline-flex rounded-[var(--dt-radius-control,4px)] border border-slate-200 bg-slate-100/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              aria-pressed={viewMode === 'split'}
              title="Side by side split view"
              className={cn(
                'inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer',
                viewMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Columns2 className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              aria-pressed={viewMode === 'unified'}
              title="Unified inline diff view"
              className={cn(
                'inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer',
                viewMode === 'unified'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Rows3 className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Unified</span>
            </button>
          </div>
        </div>
      </div>

      {/* Diff Table Header */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-12 gap-0 border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          <div className="col-span-4 px-3 py-1.5 border-r border-slate-200">Statutory Field</div>
          <div className="col-span-4 px-3 py-1.5 border-r border-slate-200 text-rose-900 flex items-center gap-1">
            <Minus className="h-3 w-3" aria-hidden="true" />
            {oldTitle}
          </div>
          <div className="col-span-4 px-3 py-1.5 text-emerald-900 flex items-center gap-1">
            <Plus className="h-3 w-3" aria-hidden="true" />
            {newTitle}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-0 border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          <div className="col-span-4 px-3 py-1.5 border-r border-slate-200">Statutory Field</div>
          <div className="col-span-8 px-3 py-1.5">Record Delta & Content</div>
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-slate-100 text-xs">
        {displayedItems.length > 0 ? (
          displayedItems.map((item) => {
            const isModified = item.changeType === 'modified';
            const isAdded = item.changeType === 'added';
            const isRemoved = item.changeType === 'removed';

            if (viewMode === 'split') {
              return (
                <div
                  key={item.key}
                  className={cn(
                    'grid grid-cols-12 gap-0 transition-colors',
                    item.hasChanged ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-slate-50/60'
                  )}
                >
                  {/* Field label */}
                  <div className="col-span-4 px-3 py-2 border-r border-slate-100 flex items-center justify-between gap-1">
                    <span className="font-medium text-slate-800">{item.label || item.key}</span>
                    {item.hasChanged && (
                      <span
                        className={cn(
                          'text-[9.5px] font-semibold px-1 py-0.2 rounded uppercase tracking-wider shrink-0',
                          isModified && 'bg-amber-100 text-amber-800',
                          isAdded && 'bg-emerald-100 text-emerald-800',
                          isRemoved && 'bg-rose-100 text-rose-800'
                        )}
                      >
                        {item.changeType}
                      </span>
                    )}
                  </div>

                  {/* Previous value */}
                  <div
                    className={cn(
                      'col-span-4 px-3 py-2 font-mono text-[11px] border-r border-slate-100 break-all select-all flex items-start gap-1.5',
                      (isModified || isRemoved) && 'bg-rose-50/70 text-rose-950 font-medium'
                    )}
                  >
                    {(isModified || isRemoved) && (
                      <span className="text-rose-500 font-bold select-none shrink-0">-</span>
                    )}
                    <span>{item.oldStr || <span className="text-slate-300 italic font-sans">Empty</span>}</span>
                  </div>

                  {/* Proposed value */}
                  <div
                    className={cn(
                      'col-span-4 px-3 py-2 font-mono text-[11px] break-all select-all flex items-start gap-1.5',
                      (isModified || isAdded) && 'bg-emerald-50/70 text-emerald-950 font-medium'
                    )}
                  >
                    {(isModified || isAdded) && (
                      <span className="text-emerald-600 font-bold select-none shrink-0">+</span>
                    )}
                    <span>{item.newStr || <span className="text-slate-300 italic font-sans">Empty</span>}</span>
                  </div>
                </div>
              );
            }

            // Unified mode
            return (
              <div
                key={item.key}
                className={cn(
                  'grid grid-cols-12 gap-0 transition-colors',
                  item.hasChanged ? 'bg-amber-50/20' : 'hover:bg-slate-50/60'
                )}
              >
                {/* Field label */}
                <div className="col-span-4 px-3 py-2.5 border-r border-slate-100">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-slate-800">{item.label || item.key}</span>
                    {item.hasChanged && (
                      <span
                        className={cn(
                          'text-[9.5px] font-semibold px-1 py-0.2 rounded uppercase tracking-wider',
                          isModified && 'bg-amber-100 text-amber-800',
                          isAdded && 'bg-emerald-100 text-emerald-800',
                          isRemoved && 'bg-rose-100 text-rose-800'
                        )}
                      >
                        {item.changeType}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline delta */}
                <div className="col-span-8 p-1.5 space-y-1">
                  {item.hasChanged ? (
                    <>
                      {item.oldStr && (
                        <div className="flex items-start gap-2 px-2 py-1 rounded bg-rose-50/80 text-rose-950 font-mono text-[11px]">
                          <span className="text-rose-600 font-bold select-none">-</span>
                          <span className="break-all select-all line-through decoration-rose-400">{item.oldStr}</span>
                        </div>
                      )}
                      {item.newStr && (
                        <div className="flex items-start gap-2 px-2 py-1 rounded bg-emerald-50/80 text-emerald-950 font-mono text-[11px]">
                          <span className="text-emerald-600 font-bold select-none">+</span>
                          <span className="break-all select-all font-medium">{item.newStr}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-2 py-1 font-mono text-[11px] text-slate-600 select-all">
                      {item.oldStr}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">
            {showChangesOnly ? 'No changes detected between the two records.' : 'No items to compare.'}
          </div>
        )}
      </div>
    </div>
  );
};
