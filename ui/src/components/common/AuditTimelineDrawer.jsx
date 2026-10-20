import React, { useEffect, useMemo, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { formatDateTime, getISODateInTimezone } from '../../utils/formatDateTime';
import { buildCsv } from '../../utils/csv';
import { getAuditActionLabel, normalizeAuditAction } from '../../constants/auditEventLabels';
import './AuditTimelineDrawer.css';

// Keep drawer compact while surfacing recent immutable audit activity.
const MAX_TIMELINE_EVENTS = 200;

// Actions that represent lifecycle stage transitions (not comments/attachments)
const LIFECYCLE_ACTIONS = new Set([
  'CREATED', 'OPENED', 'ASSIGNED', 'RESOLVED', 'FILED', 'PENDING', 'UNPENDED',
  'UNASSIGNED', 'PULLED', 'MOVED_TO_GLOBAL', 'STAGE_CHANGE',
  'CASE_CREATED', 'CASE_ASSIGNED', 'CASE_UNASSIGNED', 'CASE_PENDED', 'CASE_UNPENDED',
  'CASE_REOPENED', 'CASE_RESOLVED', 'CASE_FILED', 'CASE_MOVED_TO_WORKBASKET',
]);
const IRREVERSIBLE_ACTIONS = new Set(['RESOLVED', 'FILED', 'CASE_RESOLVED', 'CASE_FILED']);

const ACTION_ICONS = {
  RESOLVED: '✓',
  CASE_RESOLVED: '✓',
  FILED: '📤',
  CASE_FILED: '📤',
  PENDING: '⏳',
  CASE_PENDED: '⏳',
  UNPENDED: '🔁',
  CASE_UNPENDED: '🔁',
  CASE_REOPENED: '🔁',
  CREATED: '📋',
  CASE_CREATED: '📋',
  OPENED: '👁',
  DOCKET_OPENED: '👁',
  DOCKET_VIEWED: '👁',
  DOCKET_EXITED: '🚪',
  ASSIGNED: '👤',
  CASE_ASSIGNED: '👤',
  PULLED: '👤',
  UNASSIGNED: '↩',
  CASE_UNASSIGNED: '↩',
  MOVED_TO_GLOBAL: '↩',
  CASE_COMMENT_ADDED: '💬',
  CASE_FILE_ATTACHED: '📎',
  CASE_ATTACHMENT_ADDED: '📎',
  CASE_CLONED: '⧉',
  CLONED_FROM_OLD_DOCKET: '⧉',
};

const getActionIcon = (action = '') => {
  const key = normalizeAuditAction({ actionType: action, action });
  return ACTION_ICONS[key] || ACTION_ICONS[action] || null;
};

const isLifecycleEvent = (action = '') => LIFECYCLE_ACTIONS.has(normalizeAuditAction({ actionType: action, action }));
const isIrreversible = (action = '') => IRREVERSIBLE_ACTIONS.has(normalizeAuditAction({ actionType: action, action }));

const normalizeEvents = (data = {}) => {
  const history = Array.isArray(data) ? data : (data.history || data.auditLog || []);
  const auditLog = Array.isArray(data) ? [] : (data.auditLog || []);
  
  // Combine both sources to ensure we capture EVERYTHING
  const combined = [...history, ...auditLog];
  
  // Sort combined descending by timestamp
  const sorted = combined.sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
    const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const seen = new Set();
  const deduped = [];

  for (const event of sorted) {
    const timestamp = event.timestamp || event.createdAt;
    const action = event.actionType || event.action || 'Updated';
    const desc = event.description || event.comment || '';
    const key = `${timestamp}-${action}-${desc}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(event);
    }
  }

  return deduped
    .map((event) => ({
      id: event._id || event.id || `${event.timestamp || event.createdAt}-${event.actionType || event.action || 'Updated'}`,
      action: event.actionType || event.action || 'Updated',
      actionLabel: getAuditActionLabel(event),
      actor:
        event.performedByName ||
        event.performedBy ||
        event.actorXID ||
        event.performedByXID ||
        event.createdByName ||
        'System',
      actorXID: event.performedByXID || event.actorXID || null,
      actorRole: event.actorRole || (event.performedBy === 'SYSTEM' ? 'SYSTEM' : 'USER'),
      timestamp: event.timestamp || event.createdAt,
      description: event.description || event.comment || '',
      metadata: event.metadata || {},
    }))
    .slice(0, MAX_TIMELINE_EVENTS);
};

export const AuditTimelineDrawer = ({ isOpen, onClose, caseId, events }) => {
  const [loading, setLoading] = useState(false);
  const [resolvedEvents, setResolvedEvents] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
        const response = await caseApi.getCaseHistory(caseId);
        if (!cancelled && response.success && response.data?.history) {
          setResolvedEvents(normalizeEvents(response.data.history));
        } else if (!cancelled) {
          const detailRes = await caseApi.getCaseById(caseId);
          if (!cancelled && detailRes.success) {
            setResolvedEvents(normalizeEvents(detailRes.data));
          }
        }
      } catch (err) {
        if (!cancelled) {
          try {
            const detailRes = await caseApi.getCaseById(caseId);
            if (!cancelled && detailRes.success) {
              setResolvedEvents(normalizeEvents(detailRes.data));
            }
          } catch (_) {
            // Silence network error fallback
          }
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

  const filteredEvents = useMemo(() => {
    let result = resolvedEvents;

    // Filter by type
    if (activeFilter === 'STATUS') {
      result = result.filter((e) => isLifecycleEvent(e.action));
    } else if (activeFilter === 'VIEWS') {
      result = result.filter((e) => {
        const act = String(e.action).toUpperCase();
        return act.includes('VIEW') || act.includes('OPEN') || act.includes('EXIT');
      });
    } else if (activeFilter === 'CONTENT') {
      result = result.filter((e) => {
        const act = String(e.action).toUpperCase();
        return act.includes('COMMENT') || act.includes('FILE') || act.includes('ATTACHMENT');
      });
    } else if (activeFilter === 'CLONES') {
      result = result.filter((e) => {
        const act = String(e.action).toUpperCase();
        return act.includes('CLONE');
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          String(e.actor).toLowerCase().includes(q) ||
          String(e.actionLabel).toLowerCase().includes(q) ||
          String(e.description).toLowerCase().includes(q) ||
          String(e.actorXID || '').toLowerCase().includes(q)
      );
    }

    return result.slice(0, MAX_TIMELINE_EVENTS);
  }, [resolvedEvents, activeFilter, searchQuery]);

  const handleDownloadCsv = () => {
    if (!filteredEvents.length) return;
    const rows = filteredEvents.map((entry) => [
      entry.action || '',
      entry.actor || '',
      entry.actorRole || '',
      entry.timestamp ? formatDateTime(entry.timestamp) : '',
      entry.description || '',
    ]);
    const csv = buildCsv([['Action', 'Actor', 'Role', 'Timestamp', 'Description'], ...rows]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = getISODateInTimezone(new Date()).replaceAll('-', '');
    link.href = url;
    link.download = `audit_history_${caseId || 'docket'}_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[var(--dt-text)]/45 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!isOpen}
        onClick={onClose}
      />
      <aside
        className={`audit-drawer fixed inset-y-0 right-0 z-50 flex w-full sm:w-[440px] transform flex-col bg-[var(--dt-surface-raised)] shadow-2xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Audit History"
      >
        <div className="audit-drawer__header">
          <div>
            <h3 className="audit-drawer__title">Audit History</h3>
            <p className="audit-drawer__meta">System-recorded immutable audit trail (MongoDB)</p>
            {loading ? <p className="audit-drawer__meta text-indigo-600">Loading audit history...</p> : null}
          </div>
          <button type="button" className="audit-drawer__close" onClick={onClose} aria-label="Close audit history" title="Close audit history">
            ×
          </button>
        </div>

        <div className="px-6 pt-3 pb-2 flex flex-col gap-2 border-b border-[var(--dt-border-whisper)] bg-[var(--dt-surface-muted)]/50">
          <input
            type="text"
            placeholder="Search audit trail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--dt-border)] bg-[var(--dt-surface)] px-3 py-1.5 text-xs text-[var(--dt-text)] focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'STATUS', label: 'Status & Lifecycle' },
              { id: 'VIEWS', label: 'Views & Exit' },
              { id: 'CONTENT', label: 'Comments & Files' },
              { id: 'CLONES', label: 'Cloning' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-[var(--dt-surface)] text-[var(--dt-text-secondary)] border border-[var(--dt-border)] hover:bg-[var(--dt-surface-muted)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="audit-drawer__toolbar">
          <button
            type="button"
            className="audit-drawer__download"
            onClick={handleDownloadCsv}
            disabled={!filteredEvents.length}
          >
            Download Audit Trail (CSV)
          </button>
        </div>

        <div className="audit-drawer__body overflow-y-auto">
          {!filteredEvents.length && !loading ? (
            <div className="py-8 text-center text-xs text-[var(--dt-text-muted)]">
              No audit entries found matching the selected filter.
            </div>
          ) : (
            <div className="audit-drawer__list">
              {filteredEvents.map((entry, idx) => {
                const lifecycle = isLifecycleEvent(entry.action);
                const irreversible = isIrreversible(entry.action);
                const icon = getActionIcon(entry.action);
                const prevLifecycle = idx > 0 && isLifecycleEvent(filteredEvents[idx - 1].action);
                const showSeparator = !lifecycle && prevLifecycle;
                return (
                  <React.Fragment key={entry.id}>
                    {showSeparator && <div className="audit-drawer__separator" aria-hidden="true">Activity Log</div>}
                    <div className={`audit-drawer__item${lifecycle ? ' audit-drawer__item--lifecycle' : ''}${irreversible ? ' audit-drawer__item--irreversible' : ''}`}>
                      <div className="audit-drawer__item-row">
                        {icon && <span className="audit-drawer__icon" aria-hidden="true">{icon}</span>}
                        <p className="audit-drawer__action">{entry.actionLabel || entry.action}</p>
                        {entry.actorRole && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {entry.actorRole}
                          </span>
                        )}
                        {irreversible && <span className="audit-drawer__irreversible-tag" title="This action is irreversible">Final</span>}
                      </div>
                      <p className="audit-drawer__detail">
                        {entry.actor} {entry.actorXID ? `(${entry.actorXID})` : ''} • {formatDateTime(entry.timestamp)}
                      </p>
                      {entry.description ? <p className="audit-drawer__description">{entry.description}</p> : null}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

