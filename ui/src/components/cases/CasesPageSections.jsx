import { Button } from '../common/Button';
import { SectionCard } from '../layout/SectionCard';
import { CASE_STATUS } from '../../utils/constants';

export const CasesHeaderActions = ({
  isHighWorkload,
  openAssignedCount,
  onExportCsv,
  isPartner,
  enablePerformanceView,
  showPerformance,
  onTogglePerformance,
  isAdmin,
  onOpenBulkUpload,
  onCreateDocket,
  exportLabel,
}) => (
  <div className="cases-page__header-actions">
    {isHighWorkload && (
      <span className="cases-page__workload-warning" role="status" aria-live="polite">
        ⚠ High workload ({openAssignedCount} open)
      </span>
    )}
    <Button variant="outline" onClick={onExportCsv}>{exportLabel}</Button>
    {!isPartner && enablePerformanceView && (
      <Button variant="outline" onClick={onTogglePerformance}>
        {showPerformance ? 'Hide Performance View' : 'Show Performance View'}
      </Button>
    )}
    {isAdmin && <Button variant="outline" onClick={onOpenBulkUpload}>Bulk Upload</Button>}
    {isAdmin && <Button variant="primary" onClick={onCreateDocket}>Create Docket</Button>}
  </div>
);

export const CasesSlaSummaryBar = ({ isPartner, slaSummary, setStatusFilter, setActiveView, enableEscalationView }) => {
  if (isPartner) return null;
  return (
    <div className="cases-page__sla-bar cases-page__control-section" role="region" aria-label="SLA Summary">
      <button type="button" className="cases-page__sla-tile" onClick={() => { setStatusFilter('ALL'); setActiveView('MY_OPEN'); }} aria-label={`Total open dockets: ${slaSummary.totalOpen}`}>
        <span className="cases-page__sla-tile-value">{slaSummary.totalOpen}</span>
        <span className="cases-page__sla-tile-label">Open Dockets</span>
      </button>
      <button type="button" className="cases-page__sla-tile cases-page__sla-tile--warning" onClick={() => { setStatusFilter('ALL'); setActiveView('DUE_TODAY'); }} aria-label={`Due today: ${slaSummary.dueToday}`}>
        <span className="cases-page__sla-tile-value">{slaSummary.dueToday}</span>
        <span className="cases-page__sla-tile-label">Due Today</span>
      </button>
      <button type="button" className={`cases-page__sla-tile${slaSummary.overdue > 0 ? ' cases-page__sla-tile--danger' : ''}`} onClick={() => { setStatusFilter('ALL'); setActiveView('OVERDUE'); }} aria-label={`Overdue: ${slaSummary.overdue}`}>
        <span className="cases-page__sla-tile-value">{slaSummary.overdue}</span>
        <span className="cases-page__sla-tile-label">Overdue</span>
      </button>
      {enableEscalationView && (
        <button type="button" className={`cases-page__sla-tile${slaSummary.escalated > 0 ? ' cases-page__sla-tile--escalated' : ''}`} onClick={() => { setStatusFilter('ALL'); setActiveView('ESCALATED'); }} aria-label={`Escalated: ${slaSummary.escalated}`}>
          <span className="cases-page__sla-tile-value">{slaSummary.escalated}</span>
          <span className="cases-page__sla-tile-label">Escalated</span>
        </button>
      )}
      <button type="button" className="cases-page__sla-tile" onClick={() => { setStatusFilter('ALL'); setActiveView('FILED'); }} aria-label={`Filed last 7 days: ${slaSummary.filedLast7}`}>
        <span className="cases-page__sla-tile-value">{slaSummary.filedLast7}</span>
        <span className="cases-page__sla-tile-label">Filed (7d)</span>
      </button>
    </div>
  );
};

export const CasesSavedViews = ({ savedViews, savedViewsOpen, setSavedViewsOpen, handleLoadSavedView, removeView, saveViewName, setSaveViewName, handleSaveCurrentView }) => (
  <div className="cases-page__saved-views cases-page__control-section">
    <div className="cases-page__saved-views-row">
      <button type="button" className="cases-page__saved-views-toggle" onClick={() => setSavedViewsOpen((v) => !v)} aria-expanded={savedViewsOpen}>
        ⭐ Saved Views {savedViews.length > 0 && `(${savedViews.length})`}
      </button>
      {savedViews.map((sv) => (
        <span key={sv.name} className="cases-page__saved-view-chip">
          <button type="button" className="cases-page__saved-view-load" onClick={() => handleLoadSavedView(sv.name)} title={`Load: ${sv.name}`}>
            {sv.name}
          </button>
          <button type="button" className="cases-page__saved-view-remove" onClick={() => removeView(sv.name)} aria-label={`Remove saved view: ${sv.name}`}>
            ×
          </button>
        </span>
      ))}
    </div>
    {savedViewsOpen && (
      <div className="cases-page__saved-views-form">
        <input
          type="text"
          className="cases-page__saved-views-input"
          placeholder="Preset name (e.g. My Overdue Dockets)"
          value={saveViewName}
          onChange={(e) => setSaveViewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrentView()}
          maxLength={60}
          aria-label="Saved view name"
        />
        <Button variant="outline" onClick={handleSaveCurrentView} disabled={!saveViewName.trim()}>
          Save current filters
        </Button>
      </div>
    )}
  </div>
);

export const CasesFiltersCard = ({  statusFilter, setStatusFilter, workTypeFilter, setWorkTypeFilter, qcWorkbaskets, activeWorkbasketId, setActiveWorkbasketId,  }) => {
  const handleWorkbasketTabKeyDown = (event, index) => {
    let newIndex;
    if (event.key === 'ArrowRight') {
      newIndex = (index + 1) % qcWorkbaskets.length;
    } else if (event.key === 'ArrowLeft') {
      newIndex = (index - 1 + qcWorkbaskets.length) % qcWorkbaskets.length;
    }

    if (newIndex !== undefined) {
      event.preventDefault();
      const workbasketId = qcWorkbaskets[newIndex].id;
      setActiveWorkbasketId(workbasketId);

      setTimeout(() => {
        const tabElement = document.getElementById(`workbasket-tab-${workbasketId}`);
        if (tabElement) {
          tabElement.focus();
        }
      }, 0);
    }
  };

  return (
  <SectionCard className="cases-page__filters cases-page__control-section" title="Filters" subtitle="Narrow down the docket list by workflow status.">
    {statusFilter === CASE_STATUS.QC_PENDING && qcWorkbaskets.length > 1 && (
      <>
        <label className="cases-page__filter-label">QC Workbasket</label>
        <div className="cases-page__views" role="tablist" aria-label="QC workbasket selector">
          {qcWorkbaskets.map((workbasket, index) => (
            <button
              key={workbasket.id}
              id={`workbasket-tab-${workbasket.id}`}
              role="tab"
              aria-selected={activeWorkbasketId === workbasket.id}
              className={`cases-page__view-tab${activeWorkbasketId === workbasket.id ? ' cases-page__view-tab--active' : ''}`}
              onClick={() => setActiveWorkbasketId(workbasket.id)}
              onKeyDown={(e) => handleWorkbasketTabKeyDown(e, index)}
              tabIndex={activeWorkbasketId === workbasket.id ? 0 : -1}
              aria-controls="status-filter"
              type="button"
            >
              {workbasket.name}
            </button>
          ))}
        </div>
      </>
    )}
    <label className="cases-page__filter-label" htmlFor="status-filter">Status</label>
    <select id="status-filter" className="cases-page__filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
      <option value="ALL">All statuses</option>
      <option value={CASE_STATUS.OPEN}>Open</option>
      <option value={CASE_STATUS.PENDING}>Pending</option>
      <option value={CASE_STATUS.QC_PENDING}>QC Pending</option>
      <option value={CASE_STATUS.RESOLVED}>Resolved</option>
      <option value={CASE_STATUS.FILED}>Filed</option>
    </select>
    <label className="cases-page__filter-label" htmlFor="work-type-filter">Work Type</label>
    <select id="work-type-filter" className="cases-page__filter-select" value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value)}>
      <option value="ALL">All Work</option>
      <option value="client">Client Work</option>
      <option value="internal">Internal Work</option>
    </select>
  </SectionCard>
  );
};

export const CasesPerformancePanel = ({ isPartner, enablePerformanceView, showPerformance, performanceMetrics }) => {
  if (isPartner || !enablePerformanceView || !showPerformance) return null;

  return (
    <div className="cases-page__perf-panel" role="region" aria-label="Performance metrics">
      {performanceMetrics ? (
        <>
          {performanceMetrics.avgDays !== null && (
            <div className="cases-page__perf-metric">
              <span className="cases-page__perf-metric-label">Avg. Time to Resolve</span>
              <span className="cases-page__perf-metric-value">{performanceMetrics.avgDays} days</span>
            </div>
          )}
          {performanceMetrics.pctBreach !== null && (
            <div className="cases-page__perf-metric">
              <span className="cases-page__perf-metric-label">Dockets Breaching SLA</span>
              <span className={`cases-page__perf-metric-value${performanceMetrics.pctBreach > 20 ? ' cases-page__perf-metric-value--danger' : ''}`}>
                {performanceMetrics.pctBreach}%
              </span>
            </div>
          )}
          {performanceMetrics.pctWithinSla !== null && (
            <div className="cases-page__perf-metric">
              <span className="cases-page__perf-metric-label">Resolved Within SLA</span>
              <span className="cases-page__perf-metric-value cases-page__perf-metric-value--good">{performanceMetrics.pctWithinSla}%</span>
            </div>
          )}
          <div className="cases-page__perf-metric">
            <span className="cases-page__perf-metric-label">Total Resolved/Filed</span>
            <span className="cases-page__perf-metric-value">{performanceMetrics.resolvedCount}</span>
          </div>
        </>
      ) : (
        <p className="cases-page__perf-empty">No resolved dockets to compute metrics.</p>
      )}
    </div>
  );
};
