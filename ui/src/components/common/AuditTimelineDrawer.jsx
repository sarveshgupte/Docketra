import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { caseService } from '../../services/caseService';
import { formatDateTime } from '../../utils/formatDateTime';
import { buildCsv } from '../../utils/csv';
import './AuditTimelineDrawer.css';

// Keep drawer compact while surfacing recent immutable audit activity.
const MAX_TIMELINE_EVENTS = 10;

// Actions that represent lifecycle stage transitions (not comments/attachments)
const LIFECYCLE_ACTIONS = new Set([
  'CREATED', 'OPENED', 'ASSIGNED', 'RESOLVED', 'FILED', 'PENDED', 'UNPENDED',
  'UNASSIGNED', 'PULLED', 'MOVED_TO_GLOBAL', 'STAGE_CHANGE',
]);
const IRREVERSIBLE_ACTIONS = new Set(['RESOLVED', 'FILED']);

const ACTION_ICONS = {
  RESOLVED: '✓',
  FILED: '📤',
  PENDED: '⏳',
  UNPENDED: '🔁',
  CREATED: '📋',
  OPENED: '📋',
  ASSIGNED: '👤',
  PULLED: '👤',
  UNASSIGNED: '↩',
  MOVED_TO_GLOBAL: '↩',
};

const getActionIcon = (action = '') => {
  const key = action.toUpperCase();
  return ACTION_ICONS[key] || null;
};

const isLifecycleEvent = (action = '') => LIFECYCLE_ACTIONS.has(action.toUpperCase());
const isIrreversible = (action = '') => IRREVERSIBLE_ACTIONS.has(action.toUpperCase());

const normalizeEvents = (data = {}) => {
  const source = data.auditLog?.length ? data.auditLog : data.history || [];
  return source
    .map((event) => ({
      id: event._id || event.id || `${event.timestamp}-${event.actionType}`,
      action: event.actionType || event.action || 'Updated',
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
        const response = await caseService.getCaseById(caseId);
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
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    link.href = url;
    link.download = `timeline_export_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`audit-drawer${isOpen ? ' audit-drawer--open' : ''}`} aria-hidden={!isOpen}>
      <div className="audit-drawer__backdrop" onClick={onClose} />
      <aside className="audit-drawer__panel" role="dialog" aria-label="Case timeline">
        <div className="audit-drawer__header">
          <h3>Timeline</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={handleDownloadCsv} disabled={!timelineItems.length}>
              Download Timeline (CSV)
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <p className="audit-drawer__meta">Audit log is system-recorded</p>
        {loading ? <p className="audit-drawer__meta">Loading timeline…</p> : null}
        {!loading && !timelineItems.length ? <p className="audit-drawer__meta">No audit events available.</p> : null}
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
                    <p className="audit-drawer__action">{entry.action}</p>
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
      </aside>
    </div>
  );
};
