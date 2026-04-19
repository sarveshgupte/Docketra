import React, { useEffect, useMemo, useState } from 'react';

export const toArray = (value) => (Array.isArray(value) ? value : []);

export const formatDocketLabel = (item = {}) => {
  const raw = String(item.docketId || item.caseId || item.caseInternalId || item._id || '').trim();
  return raw ? raw.replace(/^CASE-/i, 'DOCKET-') : 'DOCKET-UNKNOWN';
};

export const getDocketRouteId = (item = {}) => (
  item.caseId
  || item.docketId
  || item.caseInternalId
  || item._id
  || null
);

export const formatStatusLabel = (value) => String(value || 'UNKNOWN').replace(/_/g, ' ');

export const formatDateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
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

export const PageSection = ({ id, title, description, actions, children }) => (
  <section className="panel section-panel" id={id}>
    {(title || description || actions) && (
      <header className="section-header">
        <div>
          {title ? <h2 className="section-title">{title}</h2> : null}
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </header>
    )}
    {children}
  </section>
);

export const FilterBar = ({ children, onClear, clearLabel = 'Clear filters', clearDisabled = false }) => (
  <div className="filter-bar" role="region" aria-label="Filters and search">
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

export const StatGrid = ({ items = [] }) => (
  <section className="grid-cards" aria-label="Key metrics">
    {items.map((item) => (
      <article className="panel metric-card" key={item.label}>
        <p className="muted">{item.label}</p>
        <p className="kpi">{item.value}</p>
        {item.helpText ? <p className="metric-note">{item.helpText}</p> : null}
      </article>
    ))}
  </section>
);

export const InlineNotice = ({ tone = 'info', message }) => {
  if (!message) return null;
  return <p className={`inline-notice inline-notice--${tone}`}>{message}</p>;
};

export const RefreshNotice = ({ refreshing = false, message = 'Refreshing in background…' }) => (
  <InlineNotice tone="info" message={refreshing ? message : ''} />
);

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
  paginationLabel = 'Table pagination',
  hasActiveFilters = false,
  emptyLabelFiltered = 'No results match the current filters.',
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
    <div className="table-wrap" aria-live="polite">
      <table className="table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="table-message">{loadingLabel}</td>
            </tr>
          ) : null}
          {!loading && error ? (
            <tr>
              <td colSpan={columns.length} className="table-message table-message--error">
                <div className="table-feedback-stack">
                  <p>{error}</p>
                  {onRetry ? (
                    <button type="button" onClick={onRetry}>{retryLabel}</button>
                  ) : null}
                </div>
              </td>
            </tr>
          ) : null}
          {!loading && !error && safeRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-message">{emptyMessage}</td>
            </tr>
          ) : null}
          {!loading && !error && safeRows.length > 0 ? visibleRows : null}
        </tbody>
      </table>

      {!loading && !error && safeRows.length > pageSize ? (
        <div className="table-pagination" role="navigation" aria-label={paginationLabel}>
          <span className="muted">Page {clampedPage} of {totalPages}</span>
          <div className="action-row">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={clampedPage <= 1}>
              Previous
            </button>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={clampedPage >= totalPages}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
