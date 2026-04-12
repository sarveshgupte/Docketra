import React, { useCallback, useEffect, useState } from 'react';
import { caseApi } from '../src/api/case.api';
import { invalidateCaseCache } from '../src/utils/caseCache';
import { formatDateTime } from '../src/utils/formatDateTime';
import { formatCaseName, formatDocketId } from '../src/utils/formatters';
import { LifecycleBadge } from './LifecycleBadge';
import { useAuth } from '../src/hooks/useAuth';

const normalizeDoc = (data) => data?.case || data;

const CASE_FETCH_PARAMS = {
  commentsPage: 1,
  commentsLimit: 1,
  activityPage: 1,
  activityLimit: 25,
};

const asDisplayValue = (value) => (!value || value === 'N/A' ? '—' : value);

function assignmentLabel(docket) {
  if (!docket) return null;
  const name = docket.assignedToName;
  const xid = docket.assignedToXID;
  if (name != null && String(name).trim() !== '') return String(name).trim();
  if (xid != null && String(xid).trim() !== '') return String(xid).trim();
  return null;
}

/**
 * Loads docket from API (or uses prefetched snapshot). When the server still reports
 * lifecycle in_worklist, performs a cache-bypassing refetch so GET /cases/:id can run
 * activateOnOpen and return the updated record without extra user action.
 */
export function DocketDetails({
  docketId,
  prefetchedCase = null,
  prefetchedSyncKey = '',
  onDocketUpdated,
  openedFromWorklist = false,
  children,
}) {
  const { user } = useAuth();
  const [docket, setDocket] = useState(() => (prefetchedCase ? normalizeDoc(prefetchedCase) : null));
  const [loading, setLoading] = useState(() => {
    if (!prefetchedCase) return true;
    return String(prefetchedCase.lifecycle || '').toLowerCase() === 'in_worklist';
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docketId) return undefined;

    let cancelled = false;

    const run = async () => {
      setError(null);
      const snapshot = prefetchedCase ? normalizeDoc(prefetchedCase) : null;
      if (snapshot) {
        setDocket(snapshot);
      } else {
        setLoading(true);
      }

      const isInWorklist = String(snapshot?.lifecycle || '').toLowerCase() === 'in_worklist';
      const shouldForceRefresh = !snapshot || isInWorklist;

      if (!shouldForceRefresh) {
        setLoading(false);
        return;
      }

      try {
        invalidateCaseCache(docketId);
        const response = await caseApi.getCaseById(docketId, CASE_FETCH_PARAMS);
        const payload = normalizeDoc(response?.data?.case || response?.data || response?.case || response);
        if (cancelled) return;
        if (payload) {
          setDocket(payload);
          onDocketUpdated?.(payload);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError('Unable to refresh docket details right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [docketId, onDocketUpdated, prefetchedCase, prefetchedSyncKey]);

  const handleRetry = useCallback(async () => {
    if (!docketId) return;
    setLoading(true);
    setError(null);
    try {
      invalidateCaseCache(docketId);
      const response = await caseApi.getCaseById(docketId, CASE_FETCH_PARAMS);
      const payload = normalizeDoc(response?.data?.case || response?.data || response?.case || response);
      if (payload) {
        setDocket(payload);
        onDocketUpdated?.(payload);
      }
    } catch (retryError) {
      setError('Unable to refresh docket details right now.');
    } finally {
      setLoading(false);
    }
  }, [docketId, onDocketUpdated]);

  if (error) {
    return (
      <header className="case-detail-header" style={{ borderBottom: '1px solid #fecaca', paddingBottom: 16 }}>
        <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={handleRetry} style={{ marginTop: 12 }}>
          Retry
        </button>
      </header>
    );
  }

  if (!docket && loading) {
    return (
      <header className="case-detail-header">
        <p style={{ color: '#6b7280', margin: 0 }}>Loading docket…</p>
      </header>
    );
  }

  if (!docket) return null;

  const isWorklistLifecycle = String(docket.lifecycle || '').trim().toUpperCase() === 'WL'
    || String(docket.lifecycle || '').trim().toLowerCase() === 'in_worklist';
  const assigned = openedFromWorklist
    ? (user?.name || user?.xID || 'You')
    : (assignmentLabel(docket) || (isWorklistLifecycle ? '—' : 'Unassigned'));
  const title = docket.title || formatCaseName(docket.caseName);
  const lastUpdatedLabel = asDisplayValue(formatDateTime(docket.updatedAt));

  return (
    <header className="case-detail-header">
      <div className="case-detail-header__identity">
        <div className="case-detail-header__title-row">
          <h1 className="case-detail-header__title">{formatDocketId(docket.caseId || docketId)}</h1>
          <LifecycleBadge lifecycle={docket.lifecycle} />
          {loading ? (
            <span className="case-detail-header__sync">Syncing…</span>
          ) : null}
        </div>
        <div className="case-detail-header__secondary">
          <p className="case-detail-header__subtitle">{asDisplayValue(title) === '—' ? 'Untitled docket' : title}</p>
          <div className="case-detail-header__meta">Assigned to: {assigned}</div>
        </div>
        <div className="case-detail-header__meta">Last updated: {lastUpdatedLabel}</div>
      </div>
      {children ? <div className="case-detail-header__actions">{children}</div> : null}
    </header>
  );
}
