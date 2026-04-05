import React, { useEffect, useState } from 'react';
import { caseApi } from '../src/api/case.api';
import { invalidateCaseCache } from '../src/utils/caseCache';
import { formatDateTime } from '../src/utils/formatDateTime';
import { LifecycleBadge } from './LifecycleBadge';

const normalizeDoc = (data) => data?.case || data;

const formatDocketId = (value = '') => String(value || '').replace(/^CASE-/, 'DOCKET-');

const CASE_FETCH_PARAMS = {
  commentsPage: 1,
  commentsLimit: 25,
  activityPage: 1,
  activityLimit: 25,
};

function assignmentLabel(docket) {
  if (!docket) return null;
  const name = docket.assignedToName;
  const xid = docket.assignedToXID;
  const parts = [name, xid].filter((p) => p != null && String(p).trim() !== '');
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

/**
 * Loads docket from API (or uses prefetched snapshot). When the server still reports
 * lifecycle in_worklist, performs a cache-bypassing refetch so GET /cases/:id can run
 * activateOnOpen and return the updated record without extra user action.
 */
export function DocketDetails({
  docketId,
  prefetchedCase = null,
  /** Stable string so parent identity changes do not retrigger network (e.g. `${lifecycle}:${updatedAt}`). */
  prefetchedSyncKey = '',
  onDocketUpdated,
  /** If true, details should be treated as opened from worklist context. */
  openedFromWorklist = false,
  children,
}) {
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
      const needsActivationPass = snapshot && String(snapshot.lifecycle || '').toLowerCase() === 'in_worklist';

      if (snapshot && !needsActivationPass) {
        setDocket(snapshot);
        setLoading(false);
        return;
      }

      if (snapshot) {
        setDocket(snapshot);
      }

      setLoading(true);
      try {
        invalidateCaseCache(docketId);
        let res = await caseApi.getCaseById(docketId, CASE_FETCH_PARAMS);
        if (!res?.success) {
          throw new Error(res?.message || 'Failed to load docket');
        }
        let doc = normalizeDoc(res.data);
        if (cancelled) return;

        if (String(doc?.lifecycle || '').toLowerCase() === 'in_worklist') {
          invalidateCaseCache(docketId);
          res = await caseApi.getCaseById(docketId, CASE_FETCH_PARAMS);
          doc = normalizeDoc(res.data);
        }

        if (cancelled) return;
        setDocket(doc);
        onDocketUpdated?.(doc);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load docket');
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
  }, [docketId, prefetchedSyncKey, onDocketUpdated]);

  if (error) {
    return (
      <header className="case-detail-header" style={{ borderBottom: '1px solid #fecaca', paddingBottom: 16 }}>
        <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
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

  if (!docket) {
    return null;
  }

  const assigned = openedFromWorklist ? 'You' : (assignmentLabel(docket) || 'You');
  const title = docket.title || docket.caseName || 'Untitled docket';

  return (
    <>
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
            <p className="case-detail-header__subtitle">{title}</p>
            <div className="case-detail-header__meta">Assigned to: {assigned}</div>
          </div>
          <div className="case-detail-header__meta">Updated {formatDateTime(docket.updatedAt)}</div>
        </div>

        {children ? (
          <div className="case-detail-header__actions">
            {children}
          </div>
        ) : null}
      </header>

      <section
        aria-labelledby="docket-activity-heading"
        style={{
          marginTop: 20,
          padding: 16,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fafafa',
        }}
      >
        <h2 id="docket-activity-heading" style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 8px' }}>
          Activity
        </h2>
        <h3 style={{ margin: '0 0 6px', fontSize: '0.88rem', fontWeight: 600, color: '#111827' }}>No activity yet</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Actions, updates, and comments on this docket will appear here.</p>
      </section>
    </>
  );
}
