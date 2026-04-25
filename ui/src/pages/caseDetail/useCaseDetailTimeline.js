import { useEffect, useMemo, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { CASE_DETAIL_TABS } from '../../utils/constants';

const normalizeTimelineRows = (rows = []) => {
  const seen = new Set();
  return rows
    .map((entry) => {
      const type = String(entry?.type || entry?.actionType || entry?.action || '').toUpperCase();
      const label = ({
        DOCKET_CREATED: 'Docket created',
        CREATED: 'Docket created',
        STATUS_CHANGED: 'Status changed',
        STATE_TRANSITION: 'Status changed',
        ASSIGNED: 'Assigned',
        ASSIGNMENT: 'Assignment changed',
        REASSIGNED: 'Assignment changed',
        QC_ACTION: 'QC decision recorded',
        QC_APPROVED: 'QC approved',
        QC_PASSED: 'QC approved',
        QC_CORRECTED: 'QC corrected',
        QC_FAILED: 'QC failed',
        WORKBASKET_CHANGED: 'Routed to workbasket',
        ROUTED: 'Routed to workbasket',
        COMMENT_ADDED: 'Comment added',
        UPDATED: 'Docket updated',
      }[type] || null);
      const stableKey = entry?._id
        || entry?.id
        || `${type}:${entry?.createdAt || entry?.timestamp || ''}:${entry?.performedByXID || entry?.actorXID || entry?.performedBy || ''}:${entry?.description || label || ''}`;
      if (seen.has(stableKey)) return null;
      seen.add(stableKey);
      return {
        ...entry,
        timelineLabel: label || entry?.description || entry?.action || entry?.actionType || 'Updated',
        actorLabel: entry?.performedByName || entry?.performedByXID || entry?.performedBy || 'System',
        icon: ({
          DOCKET_CREATED: '🆕',
          CREATED: '🆕',
          STATUS_CHANGED: '🔄',
          STATE_TRANSITION: '🔄',
          QC_ACTION: '🧪',
          QC_APPROVED: '✅',
          QC_PASSED: '✅',
          QC_CORRECTED: '🛠️',
          QC_FAILED: '❌',
          ASSIGNED: '👤',
          ASSIGNMENT: '👤',
          REASSIGNED: '👤',
          WORKBASKET_CHANGED: '🗂️',
          ROUTED: '🗂️',
          PRIORITY_CHANGED: '⚡',
          COMMENT_ADDED: '💬',
          UPDATED: '✏️',
        }[type] || '•'),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftTs = new Date(left?.timestamp || left?.createdAt || left?.updatedAt || 0).getTime();
      const rightTs = new Date(right?.timestamp || right?.createdAt || right?.updatedAt || 0).getTime();
      return rightTs - leftTs;
    })
    .map((entry) => ({
      ...entry,
      description: entry.timelineLabel,
    }));
};

export const useCaseDetailTimeline = ({
  activeTab,
  caseId,
  timelineFilter,
  timelinePage,
  sortedTimelineEvents,
}) => {
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineApiData, setTimelineApiData] = useState([]);
  const [timelineHasNextPage, setTimelineHasNextPage] = useState(false);

  useEffect(() => {
    if (activeTab !== CASE_DETAIL_TABS.ACTIVITY) return undefined;
    let cancelled = false;
    const loadTimeline = async () => {
      if (!caseId) return;
      setTimelineLoading(true);
      try {
        const params = {
          page: timelinePage,
          limit: 10,
          ...(timelineFilter !== 'ALL' ? { type: timelineFilter } : {}),
        };
        const result = await caseApi.getDocketTimeline(caseId, params);
        if (cancelled) return;
        setTimelineApiData(Array.isArray(result?.data) ? result.data : []);
        setTimelineHasNextPage(Boolean(result?.pagination?.hasNextPage));
      } catch (_error) {
        if (!cancelled) {
          setTimelineApiData([]);
          setTimelineHasNextPage(false);
        }
      } finally {
        if (!cancelled) setTimelineLoading(false);
      }
    };
    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [activeTab, caseId, timelineFilter, timelinePage]);

  const mergedTimelineEvents = useMemo(() => {
    const fromApi = Array.isArray(timelineApiData) ? timelineApiData : [];
    const fallback = sortedTimelineEvents || [];
    const sourceRows = fromApi.length ? fromApi : fallback;
    return normalizeTimelineRows(sourceRows);
  }, [timelineApiData, sortedTimelineEvents]);

  return {
    timelineLoading,
    timelineHasNextPage,
    mergedTimelineEvents,
  };
};

