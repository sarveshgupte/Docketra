import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './Button';
import { caseService } from '../../services/caseService';
import { formatDateTime } from '../../utils/formatDateTime';
import './AuditTimelineDrawer.css';

// Keep drawer compact while surfacing recent immutable audit activity.
const MAX_TIMELINE_EVENTS = 10;

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

  return (
    <div className={`audit-drawer${isOpen ? ' audit-drawer--open' : ''}`} aria-hidden={!isOpen}>
      <div className="audit-drawer__backdrop" onClick={onClose} />
      <aside className="audit-drawer__panel" role="dialog" aria-label="Case timeline">
        <div className="audit-drawer__header">
          <h3>Timeline</h3>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <p className="audit-drawer__meta">Audit log is system-recorded</p>
        {loading ? <p className="audit-drawer__meta">Loading timeline…</p> : null}
        {!loading && !timelineItems.length ? <p className="audit-drawer__meta">No audit events available.</p> : null}
        <div className="audit-drawer__list">
          {timelineItems.map((entry) => (
            <div key={entry.id} className="audit-drawer__item">
              <p className="audit-drawer__action">{entry.action}</p>
              <p className="audit-drawer__detail">
                {entry.actor} • {formatDateTime(entry.timestamp)}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};
