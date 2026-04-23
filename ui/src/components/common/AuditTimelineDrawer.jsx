import React, { useEffect, useMemo, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { formatDateTime, getISODateInTimezone } from '../../utils/formatDateTime';
import { buildCsv } from '../../utils/csv';
import { getAuditActionLabel, normalizeAuditAction } from '../../constants/auditEventLabels';
import './AuditTimelineDrawer.css';

// Keep drawer compact while surfacing recent immutable audit activity.
const MAX_TIMELINE_EVENTS = 10;

// Actions that represent lifecycle stage transitions (not comments/attachments)
const LIFECYCLE_ACTIONS = new Set([
  'CREATED', 'OPENED', 'ASSIGNED', 'RESOLVED', 'FILED', 'PENDING', 'UNPENDED',
  'UNASSIGNED', 'PULLED', 'MOVED_TO_GLOBAL', 'STAGE_CHANGE',
]);
const IRREVERSIBLE_ACTIONS = new Set(['RESOLVED', 'FILED']);

const ACTION_ICONS = {
  RESOLVED: '✓',
  FILED: '📤',
  PENDING: '⏳',
  UNPENDED: '🔁',
  CREATED: '📋',
  OPENED: '📋',
  ASSIGNED: '👤',
  PULLED: '👤',
  UNASSIGNED: '↩',
  MOVED_TO_GLOBAL: '↩',
};

const getActionIcon = (action = '') => {
  const key = normalizeAuditAction({ action });
  return ACTION_ICONS[key] || null;
};

const isLifecycleEvent = (action = '') => LIFECYCLE_ACTIONS.has(normalizeAuditAction({ action }));
const isIrreversible = (action = '') => IRREVERSIBLE_ACTIONS.has(normalizeAuditAction({ action }));

const normalizeEvents = (data = {}) => {
  const source = data.auditLog?.length ? data.auditLog : data.history || [];
  return source
    .map((event) => ({
      id: event._id || event.id || `${event.timestamp}-${event.actionType}`,
      action: event.actionType || event.action || 'Updated',
      actionLabel: getAuditActionLabel(event),
      actor:
        event.performedByName ||
        event.actorXID ||
        event.performedByXID ||
        event.createdByName ||
        'System',
      timestamp: event.timestamp || event.createdAt,
      // description: auditLog entries provide `description`; legacy history entries may provide `comment`
      description: event.description || event.comment || '',
    }))
    .slice(0, MAX_TIMELINE_EVENTS);
};

export const AuditTimelineDrawer = ({ isOpen, onClose, caseId, events }) => {
  const [loading, setLoading] = useState(false);
  const [resolvedEvents, setResolvedEvents] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    if (events?.length) {
      setResolvedEvents(events.slice(0, MAX_TIMELINE_EVENTS));
      return;
    }
    if (!caseId) return;

    let cancelled = false;
    const loadTimeline = async () => {
      setLoading(true);
      try {
        const response = await caseApi.getCaseById(caseId);
        if (!cancelled && response.success) {
          setResolvedEvents(normalizeEvents(response.data));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [caseId, events, isOpen]);

  const timelineItems = useMemo(() => resolvedEvents.slice(0, MAX_TIMELINE_EVENTS), [resolvedEvents]);

  const handleDownloadCsv = () => {
    if (!timelineItems.length) return;
    const rows = timelineItems.map((entry) => [
      entry.action || '',
      entry.actor || '',
      entry.timestamp ? formatDateTime(entry.timestamp) : '',
      entry.description || '',
    ]);
    const csv = buildCsv([['Action', 'Actor', 'Timestamp', 'Description'], ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = getISODateInTimezone(new Date()).replaceAll('-', '');
    link.href = url;
    link.download = `timeline_export_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isOpen}
        onClick={onClose}
      />
      <aside
        className={`audit-drawer fixed inset-y-0 right-0 z-50 flex w-full sm:w-[400px] transform flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Audit History"
      >
        <div className="audit-drawer__header">
          <div>
            <h3 className="audit-drawer__title">Audit History</h3>
            <p className="audit-drawer__meta">Audit log is system-recorded</p>
            {loading ? <p className="audit-drawer__meta">Loading audit history...</p> : null}
          </div>
          <button type="button" className="audit-drawer__close" onClick={onClose} aria-label="Close audit history">
            ×
          </button>
        </div>
        <div className="audit-drawer__toolbar">
          <button
            type="button"
            className="audit-drawer__download"
            onClick={handleDownloadCsv}
            disabled={!timelineItems.length}
          >
            Download Audit History (CSV)
          </button>
        </div>
        <div className="audit-drawer__body overflow-y-auto">
          <div className="audit-drawer__list">
          {timelineItems.map((entry, idx) => {
            const lifecycle = isLifecycleEvent(entry.action);
            const irreversible = isIrreversible(entry.action);
            const icon = getActionIcon(entry.action);
            // Insert a separator before the first comment after lifecycle events
            const prevLifecycle = idx > 0 && isLifecycleEvent(timelineItems[idx - 1].action);
            const showSeparator = !lifecycle && prevLifecycle;
            return (
              <React.Fragment key={entry.id}>
                {showSeparator && <div className="audit-drawer__separator" aria-hidden="true">Comments &amp; Notes</div>}
                <div className={`audit-drawer__item${lifecycle ? ' audit-drawer__item--lifecycle' : ''}${irreversible ? ' audit-drawer__item--irreversible' : ''}`}>
                  <div className="audit-drawer__item-row">
                    {icon && <span className="audit-drawer__icon" aria-hidden="true">{icon}</span>}
                    <p className="audit-drawer__action">{entry.actionLabel || entry.action}</p>
                    {irreversible && <span className="audit-drawer__irreversible-tag" title="This action is irreversible">Final</span>}
                  </div>
                  <p className="audit-drawer__detail">
                    {entry.actor} • {formatDateTime(entry.timestamp)}
                  </p>
                  {entry.description ? <p className="audit-drawer__description">{entry.description}</p> : null}
                </div>
              </React.Fragment>
            );
          })}
          </div>
        </div>
      </aside>
    </>
  );
};
