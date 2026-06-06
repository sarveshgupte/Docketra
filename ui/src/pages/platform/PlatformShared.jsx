import React, { useEffect, useMemo, useState } from 'react';
import { formatDateOnly } from '../../utils/formatDateTime';

export const toArray = (value) => (Array.isArray(value) ? value : []);

export const formatDocketLabel = (item = {}) => {
  const raw = String(item.docketId || item.caseId || item.caseInternalId || item._id || '').trim();
  return raw ? raw.replace(/^CASE-/i, 'DOCKET-') : 'DOCKET-UNKNOWN';
};

export const getDocketRouteId = (item = {}) => {
  const raw = item.caseId
    || item.docketId
    || item.caseInternalId
    || item._id
    || null;
  if (typeof raw === 'string') {
    return raw.replace(/^CASE-/i, 'DOCKET-');
  }
  return raw;
};

export const formatStatusLabel = (value) => String(value || 'UNKNOWN').replace(/_/g, ' ');

export const formatDateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDateOnly(date);
};

export const buildQueueContext = ({ rows = [], rowId, location, origin }) => {
  const sourceList = rows.map((item) => getDocketRouteId(item)).filter(Boolean);
  const index = sourceList.findIndex((item) => String(item) === String(rowId));
  const returnTo = `${location.pathname}${location.search || ''}`;
  return {
    sourceList,
    index: index >= 0 ? index : 0,
    returnTo,
    origin,
  };
};

export const PageSection = ({ id, title, description, actions, children, variant = 'default', className = '' }) => (
  <section className={`section-panel section-panel--${variant} ${className}`.trim()} id={id}>
    {(title || description || actions) && (
      <header className="section-header">
        <div>
          {title ? <h2 className="section-title">{title}</h2> : null}
          {description ? <p className="muted section-description">{description}</p> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </header>
    )}
    {children}
  </section>
);

/**
 * StatRow — flat horizontal KPI strip (replaces gradient/emoji metric cards).
 * Usage: <StatRow items={[{ label: 'Available', value: 12, note: 'in queue' }]} />
 */
export const StatRow = ({ items = [] }) => (
  <div className="stat-row" aria-label="Key metrics">
    {items.map((item) => (
      <div key={item.label} className="stat-row__item">
        <span className="stat-row__label">{item.label}</span>
        <span className="stat-row__value">{item.value ?? '—'}</span>
        {item.note ? <span className="stat-row__note">{item.note}</span> : null}
      </div>
    ))}
  </div>
);

export const FilterBar = ({ children, onClear, clearLabel = 'Clear filters', clearDisabled = false, compact = false }) => (
  <div className={`filter-bar ${compact ? 'filter-bar--compact' : ''}`.trim()} role="region" aria-label="Filters and search">
    <div className="filter-bar__controls">{children}</div>
    {onClear ? (
      <button
        type="button"
        onClick={onClear}
        className="filter-bar__clear"
        disabled={clearDisabled}
        aria-label={clearLabel}
      >
        {clearLabel}
      </button>
    ) : null}
  </div>
);

export const StatGrid = ({ items = [], compact = false, columns = null }) => (
  <section className={`grid-cards ${compact ? 'grid-cards--compact' : ''} ${columns ? `grid-cards--${columns}` : ''}`.trim()} aria-label="Key metrics">
    {items.map((item) => (
      <article className="panel metric-card" key={item.label}>
        <p className="metric-label">{item.label}</p>
        <p className="kpi">{item.value ?? '—'}</p>
        {item.helpText ? <p className="metric-note muted">{item.helpText}</p> : null}
      </article>
    ))}
  </section>
);

export const InlineNotice = ({ tone = 'info', message }) => {
  if (!message) return null;
  return <p className={`inline-notice inline-notice--${tone}`}>{message}</p>;
};

export const StatusMessageStack = ({ messages = [], emphasis = 'normal' }) => {
  const visible = messages.filter((item) => item?.message);
  if (visible.length === 0) return null;
  return (
    <div className={`status-stack status-stack--${emphasis}`.trim()} role="status" aria-live="polite">
      {visible.map((item) => (
        <InlineNotice key={`${item.tone || 'info'}-${item.message}`} tone={item.tone || 'info'} message={item.message} />
      ))}
    </div>
  );
};

export const SectionToolbar = ({ children }) => (
  <div className="section-toolbar" role="region" aria-label="Section actions and filters">
    {children}
  </div>
);

export const RefreshNotice = ({ refreshing = false, message = 'Refreshing in background…' }) => (
  <InlineNotice tone="info" message={refreshing ? message : ''} />
);

/* ── Status / Priority badges ──────────────────────────────────────────────── */

const STATUS_CLASS_MAP = {
  open: 'open',
  in_progress: 'open',
  active: 'active',
  draft: 'draft',
  pending: 'review',
  review: 'review',
  pended: 'review',
  escalated: 'error',
  qc_failed: 'error',
  resolved: 'closed',
  closed: 'closed',
  filed: 'neutral',
  archived: 'archived',
  unassigned: 'draft',
  routed: 'review',
};

export const StatusBadge = ({ status, label }) => {
  const normalized = String(status || '').toLowerCase().replace(/\s+/g, '_');
  const variant = STATUS_CLASS_MAP[normalized] || 'neutral';
  const displayLabel = label || String(status || '').replace(/_/g, ' ');
  return (
    <span className={`status-badge status-badge--${variant}`} aria-label={`Status: ${displayLabel}`}>
      {displayLabel}
    </span>
  );
};

const PRIORITY_CLASS_MAP = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export const PriorityBadge = ({ priority, label }) => {
  const normalized = String(priority || '').toLowerCase();
  const variant = PRIORITY_CLASS_MAP[normalized] || 'none';
  const displayLabel = label || String(priority || '').replace(/_/g, ' ') || 'None';
  return (
    <span className={`priority-badge priority-badge--${variant}`} aria-label={`Priority: ${displayLabel}`}>
      {displayLabel}
    </span>
  );
};

/* ── Empty / Loading / Error states ────────────────────────────────────────── */

export const EmptyState = ({ title = 'No records found', body, actionLabel, onAction, actionHref, tone = 'default', boxed = false }) => (
  <div className={`empty-state empty-state--${tone} ${boxed ? 'empty-state--boxed' : ''}`.trim()} role="status">
    <svg className="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
    </svg>
    <p className="empty-state__title">{title}</p>
    {body ? <p className="empty-state__body">{body}</p> : null}
    {(actionLabel && onAction) ? (
      <button type="button" className="empty-state__action" onClick={onAction}>{actionLabel}</button>
    ) : (actionLabel && actionHref) ? (
      <a className="empty-state__action" href={actionHref}>{actionLabel}</a>
    ) : null}
  </div>
);

export const LoadingState = ({ label = 'Loading…', compact = false }) => (
  <div className={`loading-state ${compact ? 'loading-state--compact' : ''}`.trim()} role="status" aria-live="polite">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <span>{label}</span>
  </div>
);

export const ErrorState = ({
  title = 'Something went wrong',
  body,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tone = 'error',
  boxed = false,
}) => (
  <div className={`empty-state empty-state--${tone} ${boxed ? 'empty-state--boxed' : ''}`.trim()} role="alert">
    <svg className="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <p className="empty-state__title">{title}</p>
    {body ? <p className="empty-state__body">{body}</p> : null}
    {actionLabel && onAction ? (
      <button type="button" className="empty-state__action" onClick={onAction}>{actionLabel}</button>
    ) : null}
    {secondaryActionLabel && onSecondaryAction ? (
      <button type="button" className="empty-state__action" onClick={onSecondaryAction}>{secondaryActionLabel}</button>
    ) : null}
  </div>
);

/* ── DataTable ──────────────────────────────────────────────────────────────── */

export const DataTable = ({
  columns,
  rows,
  loading = false,
  loadingLabel = 'Loading data…',
  emptyLabel = 'No records found.',
  error,
  onRetry,
  retryLabel = 'Retry',
  pageSize = 10,
  compact = false,
  tableClassName = '',
  paginationLabel = 'Table pagination',
  hasActiveFilters = false,
  emptyLabelFiltered = 'No results match the current filters.',
  sortState,
  onSortChange,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [loading, error, safeRows.length]);

  const totalPages = Math.max(1, Math.ceil(safeRows.length / pageSize));
  const clampedPage = Math.min(page, totalPages);

  useEffect(() => {
    if (clampedPage !== page) {
      setPage(clampedPage);
    }
  }, [clampedPage, page]);

  const visibleRows = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return safeRows.slice(start, start + pageSize);
  }, [clampedPage, pageSize, safeRows]);

  const emptyMessage = hasActiveFilters ? emptyLabelFiltered : emptyLabel;

  return (
    <div className={`table-wrap ${compact ? 'table-wrap--compact' : ''}`.trim()} aria-live="polite">
      <table className={`table ${tableClassName}`.trim()}>
        <thead>
          <tr>{columns.map((column) => {
            const definition = typeof column === 'string' ? { label: column } : column;
            const isSorted = sortState && sortState.key === definition.key;
            const dir = isSorted ? sortState.direction : null;
            
            return (
              <th 
                key={definition.key || definition.label} 
                className={definition.widthClass || ''}
                style={definition.width ? { width: definition.width } : undefined}
              >
                {definition.sortable && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextDirection = isSorted && dir === 'asc' ? 'desc' : 'asc';
                      onSortChange({ key: definition.key, direction: nextDirection });
                    }}
                    className="flex items-center gap-1 hover:text-indigo-600 transition-colors w-full text-left"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      font: 'inherit',
                      color: isSorted ? '#2563eb' : 'inherit',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      textTransform: 'inherit',
                      letterSpacing: 'inherit',
                      fontWeight: 'inherit',
                      minHeight: 'auto',
                    }}
                  >
                    <span>{definition.label}</span>
                    <span style={{ fontSize: '12px', opacity: isSorted ? 1 : 0.4, display: 'inline-block', marginLeft: '2px' }}>
                      {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
                    </span>
                  </button>
                ) : (
                  definition.label
                )}
              </th>
            );
          })}</tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="table-message" role="status" aria-live="polite"><LoadingState compact label={loadingLabel} /></td>
            </tr>
          ) : null}
          {!loading && error ? (
            <tr>
              <td colSpan={columns.length} className="table-message table-message--error" role="status" aria-live="polite">
                <div className="table-feedback-stack">
                  <ErrorState title="Could not load table data" body={error} actionLabel={onRetry ? retryLabel : undefined} onAction={onRetry} />
                </div>
              </td>
            </tr>
          ) : null}
          {!loading && !error && safeRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-message" role="status" aria-live="polite"><EmptyState title={emptyMessage} /></td>
            </tr>
          ) : null}
          {!loading && !error && safeRows.length > 0 ? visibleRows : null}
        </tbody>
      </table>

      {!loading && !error && safeRows.length > pageSize ? (
        <div className="table-pagination" role="navigation" aria-label={paginationLabel}>
          <span className="muted">Page {clampedPage} of {totalPages} · {safeRows.length} total</span>
          <div className="action-row" aria-label="Pagination actions">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={clampedPage <= 1}>
              ← Previous
            </button>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={clampedPage >= totalPages}>
              Next →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
