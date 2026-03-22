import React from 'react';
import './Skeleton.css';

export const SkeletonBlock = ({ className = '', style = {} }) => (
  <div className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />
);

const TABLE_HEADER_WIDTHS = ['22%', '18%', '18%', '16%', '12%'];
const TABLE_ROW_WIDTHS = [
  ['34%', '26%', '24%', '18%', '16%'],
  ['28%', '20%', '22%', '14%', '18%'],
  ['32%', '24%', '18%', '16%', '12%'],
  ['26%', '28%', '20%', '15%', '17%'],
  ['30%', '18%', '22%', '14%', '16%'],
];

const TableGridSkeleton = ({ rows = 5 }) => (
  <div className="table-skeleton__grid" aria-hidden="true">
    <div className="table-skeleton__table-head">
      {TABLE_HEADER_WIDTHS.map((width, index) => (
        <SkeletonBlock key={`head-${index}`} className="table-skeleton__cell table-skeleton__cell--header" style={{ width }} />
      ))}
    </div>
    <div className="table-skeleton__table-body">
      {TABLE_ROW_WIDTHS.slice(0, rows).map((widths, rowIndex) => (
        <div key={`row-${rowIndex}`} className="table-skeleton__table-row">
          {widths.map((width, cellIndex) => (
            <SkeletonBlock key={`row-${rowIndex}-cell-${cellIndex}`} className="table-skeleton__cell" style={{ width }} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const PageSkeleton = ({ variant = 'page' }) => (
  <div className={`page-skeleton page-skeleton--${variant}`} aria-hidden="true">
    <div className="page-skeleton__header">
      <div className="page-skeleton__title">
        <SkeletonBlock style={{ width: '36%', height: '28px' }} />
        <SkeletonBlock style={{ width: '56%', height: '14px' }} />
      </div>
      <div className="page-skeleton__actions">
        <SkeletonBlock style={{ width: '128px', height: '36px' }} />
      </div>
    </div>

    <div className="page-skeleton__content">
      <div className="page-skeleton__card">
        <SkeletonBlock style={{ width: '44%', height: '18px', marginBottom: 'var(--space-4)' }} />
        <SkeletonBlock style={{ width: '100%', height: '14px', marginBottom: 'var(--space-2)' }} />
        <SkeletonBlock style={{ width: '88%', height: '14px', marginBottom: 'var(--space-2)' }} />
        <SkeletonBlock style={{ width: '72%', height: '14px' }} />
      </div>
      <div className="page-skeleton__card">
        <SkeletonBlock style={{ width: '52%', height: '18px', marginBottom: 'var(--space-4)' }} />
        <SkeletonBlock style={{ width: '100%', height: '14px', marginBottom: 'var(--space-2)' }} />
        <SkeletonBlock style={{ width: '84%', height: '14px', marginBottom: 'var(--space-2)' }} />
        <SkeletonBlock style={{ width: '68%', height: '14px' }} />
      </div>
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="dashboard-skeleton" aria-hidden="true">
    <div className="dashboard-skeleton__header">
      <div className="dashboard-skeleton__title">
        <SkeletonBlock style={{ width: '32%', height: '32px' }} />
        <SkeletonBlock style={{ width: '48%', height: '14px' }} />
      </div>
      <SkeletonBlock style={{ width: '138px', height: '36px' }} />
    </div>

    <div className="dashboard-skeleton__kpis">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="dashboard-skeleton__kpi">
          <SkeletonBlock style={{ width: '42%', height: '28px' }} />
          <SkeletonBlock style={{ width: '78%', height: '12px' }} />
          <SkeletonBlock style={{ width: '54%', height: '12px' }} />
        </div>
      ))}
    </div>

    <div className="dashboard-skeleton__panel">
      <SkeletonBlock style={{ width: '28%', height: '18px', marginBottom: 'var(--space-4)' }} />
      <div className="dashboard-skeleton__workflow">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="dashboard-skeleton__workflow-step">
            <SkeletonBlock className="skeleton-block--circle" style={{ width: '40px', height: '40px' }} />
            <SkeletonBlock style={{ width: '72px', height: '12px' }} />
          </div>
        ))}
      </div>
    </div>

    <div className="dashboard-skeleton__panel">
      <SkeletonBlock style={{ width: '24%', height: '18px', marginBottom: 'var(--space-4)' }} />
      <TableGridSkeleton rows={5} />
    </div>
  </div>
);

export const TableSkeleton = ({ rows = 5, showToolbar = true }) => (
  <div className="table-skeleton" aria-hidden="true">
    <div className="table-skeleton__header">
      <div className="table-skeleton__title">
        <SkeletonBlock style={{ width: '26%', height: '28px' }} />
        <SkeletonBlock style={{ width: '42%', height: '14px' }} />
      </div>
      <div className="table-skeleton__actions">
        <SkeletonBlock style={{ width: '118px', height: '36px' }} />
      </div>
    </div>

    {showToolbar ? (
      <div className="table-skeleton__toolbar">
        <SkeletonBlock style={{ width: '132px', height: '14px' }} />
        <SkeletonBlock style={{ width: '220px', height: '36px' }} />
      </div>
    ) : null}

    <div className="table-skeleton__card">
      <TableGridSkeleton rows={rows} />
    </div>
  </div>
);

export const FormSkeleton = () => (
  <div className="form-skeleton" aria-hidden="true">
    <div className="form-skeleton__header">
      <div className="form-skeleton__title">
        <SkeletonBlock style={{ width: '30%', height: '28px' }} />
        <SkeletonBlock style={{ width: '46%', height: '14px' }} />
      </div>
      <div className="form-skeleton__actions">
        <SkeletonBlock style={{ width: '108px', height: '36px' }} />
        <SkeletonBlock style={{ width: '96px', height: '36px' }} />
      </div>
    </div>

    <div className="form-skeleton__card">
      <div className="form-skeleton__body">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="form-skeleton__field">
            <SkeletonBlock style={{ width: '34%', height: '12px' }} />
            <SkeletonBlock style={{ width: '100%', height: '40px' }} />
          </div>
        ))}
        <div className="form-skeleton__field form-skeleton__field--full">
          <SkeletonBlock style={{ width: '28%', height: '12px' }} />
          <SkeletonBlock style={{ width: '100%', height: '120px' }} />
        </div>
      </div>
    </div>
  </div>
);
