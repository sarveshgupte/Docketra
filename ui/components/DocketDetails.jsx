import React, { useCallback, useEffect, useRef, useState } from 'react';
import { caseApi } from '../src/api/case.api';
import { invalidateCaseCache } from '../src/utils/caseCache';
import { formatDateTime } from '../src/utils/formatDateTime';
import { formatCaseName, formatDocketId } from '../src/utils/formatters';
import { LifecycleBadge } from './LifecycleBadge';
import { ActivityTimeline } from '../src/components/docket/ActivityTimeline';
import { CommentList } from '../src/components/docket/CommentList';
import { CommentInput } from '../src/components/docket/CommentInput';
import { useAuth } from '../src/hooks/useAuth';
import { RequestDocumentsModal } from './RequestDocumentsModal';

const normalizeDoc = (data) => data?.case || data;

const CASE_FETCH_PARAMS = {
  commentsPage: 1,
  commentsLimit: 1,
  activityPage: 1,
  activityLimit: 25,
};

const POLL_INTERVAL_MS = 12000;
const COMMENTS_PAGE_SIZE = 25;

const normalizeComment = (comment, index = 0) => ({
  ...comment,
  id: comment?.id || comment?._id || `comment-${comment?.createdAt || 'unknown'}-${index}`,
  text: comment?.text || '',
  createdAt: comment?.createdAt || new Date().toISOString(),
});

const extractCommentsPayload = (response) => {
  const payload = response?.data?.case || response?.data || {};
  if (Array.isArray(payload)) {
    return {
      comments: payload,
      pagination: { hasMore: false },
    };
  }
  if (Array.isArray(payload?.data)) {
    return {
      comments: payload.data,
      pagination: payload.pagination || {},
    };
  }
  return {
    comments: Array.isArray(payload?.comments) ? payload.comments : [],
    pagination: payload?.pagination?.comments || {},
  };
};

const extractActivityPayload = (response) => {
  const payload = response?.data || {};
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.activity) ? payload.activity : [];
};

const commentIdentity = (comment) => comment?._id || comment?.id;
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
  /** Stable string so parent identity changes do not retrigger network (e.g. `${lifecycle}:${updatedAt}`). */
  prefetchedSyncKey = '',
  onDocketUpdated,
  /** If true, details should be treated as opened from worklist context. */
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

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [commentRefreshKey, setCommentRefreshKey] = useState(0);
  const [activityUserRefreshToken, setActivityUserRefreshToken] = useState(0);
  const [commentUserRefreshToken, setCommentUserRefreshToken] = useState(0);
  const [highlightedCommentIds, setHighlightedCommentIds] = useState([]);
  const [firstNewCommentId, setFirstNewCommentId] = useState(null);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [newCommentCount, setNewCommentCount] = useState(0);
  const [requestDocumentsOpen, setRequestDocumentsOpen] = useState(false);
  const [uploadLinkGenerating, setUploadLinkGenerating] = useState(false);
  const [uploadLinkResult, setUploadLinkResult] = useState(null);
  const [uploadLinkStatus, setUploadLinkStatus] = useState(null);
  const commentHighlightTimeoutRef = useRef(null);
  const handledCommentRefreshTokenRef = useRef(0);
  const latestActivityHeadRef = useRef(null);
  const latestCommentHeadRef = useRef(null);

  const clearCommentHighlights = useCallback(() => {
    if (commentHighlightTimeoutRef.current) {
      window.clearTimeout(commentHighlightTimeoutRef.current);
      commentHighlightTimeoutRef.current = null;
    }
    setHighlightedCommentIds([]);
    setFirstNewCommentId(null);
  }, []);

  const loadComments = useCallback(async ({ page = 1, append = false, shouldFocusNewItems = false } = {}) => {
    if (!docketId) return;

    setCommentsError('');
    if (append) {
      setCommentsLoadingMore(true);
    } else {
      setCommentsLoading(true);
    }

    try {
      const response = await caseApi.getDocketComments(docketId, {
        page,
        limit: COMMENTS_PAGE_SIZE,
      });
      const payload = extractCommentsPayload(response);
      const normalized = payload.comments.map((comment, index) => normalizeComment(comment, index));
      const nextHeadId = commentIdentity(normalized[0]) || null;
      const previousHeadId = latestCommentHeadRef.current;
      let newCommentIds = [];

      if (!append && shouldFocusNewItems && nextHeadId && previousHeadId && nextHeadId !== previousHeadId) {
        for (const comment of normalized) {
          const id = commentIdentity(comment);
          if (!id || id === previousHeadId) break;
          newCommentIds.push(id);
        }
      }

      latestCommentHeadRef.current = commentIdentity(normalized[0]) || latestCommentHeadRef.current;
      setComments((prev) => {
        if (!append) return normalized;
        return [...prev, ...normalized.filter((next) => !prev.some((existing) => (existing._id || existing.id) === (next._id || next.id)))];
      });
      setCommentsPage(page);
      setCommentsHasMore(Boolean(payload.pagination?.hasMore));

      if (!append && shouldFocusNewItems) {
        if (newCommentIds.length > 0) {
          setHighlightedCommentIds(newCommentIds);
          setFirstNewCommentId(newCommentIds[0]);
          if (commentHighlightTimeoutRef.current) {
            window.clearTimeout(commentHighlightTimeoutRef.current);
          }
          commentHighlightTimeoutRef.current = window.setTimeout(() => {
            setHighlightedCommentIds([]);
            setFirstNewCommentId(null);
            commentHighlightTimeoutRef.current = null;
          }, 2500);
        } else {
          clearCommentHighlights();
        }
      }
    } catch (loadError) {
      setCommentsError('Unable to load comments. Retry.');
    } finally {
      setCommentsLoading(false);
      setCommentsLoadingMore(false);
    }
  }, [clearCommentHighlights, docketId]);

  const pollLatestUpdates = useCallback(async () => {
    if (!docketId || typeof document === 'undefined' || document.visibilityState !== 'visible') return;

    try {
      const [commentsResponse, activityResponse] = await Promise.all([
        caseApi.getDocketComments(docketId, {
          page: 1,
          limit: COMMENTS_PAGE_SIZE,
        }),
        caseApi.getCaseHistory(docketId),
      ]);

      const latestCommentsPayload = extractCommentsPayload(commentsResponse);
      const latestComments = latestCommentsPayload.comments.map((comment, index) => normalizeComment(comment, index));
      const latestCommentHeadId = commentIdentity(latestComments[0]) || null;

      if (latestCommentHeadId && latestCommentHeadId !== latestCommentHeadRef.current) {
        latestCommentHeadRef.current = latestCommentHeadId;
        setNewCommentCount((prev) => prev + 1);
      }

      setCommentsHasMore(Boolean(latestCommentsPayload.pagination?.hasMore));

      const latestActivity = extractActivityPayload(activityResponse);
      const latestActivityHeadId = latestActivity[0]?._id || latestActivity[0]?.id || null;
      if (latestActivityHeadId && latestActivityHeadId !== latestActivityHeadRef.current) {
        latestActivityHeadRef.current = latestActivityHeadId;
        setNewActivityCount((prev) => prev + 1);
      }
    } catch (pollError) {
      // Polling is intentionally silent.
    }
  }, [docketId]);

  const handleLoadMoreComments = useCallback(() => {
    if (!commentsHasMore || commentsLoadingMore) return;
    void loadComments({ page: commentsPage + 1, append: true });
  }, [commentsHasMore, commentsLoadingMore, commentsPage, loadComments]);

  const handleAddComment = useCallback(async (commentText) => {
    if (!docketId || !commentText.trim() || commentSubmitting) return false;

    setCommentSubmitting(true);
    setCommentsError('');

    const tempId = `temp-comment-${Date.now()}`;
    const optimisticComment = normalizeComment({
      _id: tempId,
      tempId,
      text: commentText.trim(),
      createdBy: user?.email || 'you@local',
      createdByName: user?.name || 'You',
      createdByXID: user?.xID || null,
      createdAt: new Date().toISOString(),
      optimistic: true,
    });

    setComments((prev) => [...prev, optimisticComment]);

    try {
      const response = await caseApi.addComment(docketId, commentText.trim());
      const savedComment = response?.data?.comment || null;
      const normalizedSaved = savedComment ? normalizeComment(savedComment) : { ...optimisticComment, optimistic: false };
      setComments((prev) => prev.map((comment) => ((comment._id || comment.id || comment.tempId) === tempId ? normalizedSaved : comment)));
      setActivityRefreshKey((prev) => prev + 1);
      setNewCommentCount(0);
      return true;
    } catch (submitError) {
      setComments((prev) => prev.filter((comment) => (comment._id || comment.id || comment.tempId) !== tempId));
      setCommentsError('Unable to add comment. Retry.');
      return false;
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentSubmitting, docketId, user]);

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

  useEffect(() => {
    if (!docketId) return undefined;

    setComments([]);
    setCommentsPage(1);
    setCommentsHasMore(false);
    setCommentsError('');
    setCommentsLoading(true);
    setNewCommentCount(0);
    setNewActivityCount(0);
    clearCommentHighlights();

    let cancelled = false;
    const shouldFocusNewItems = commentUserRefreshToken > handledCommentRefreshTokenRef.current;
    if (shouldFocusNewItems) {
      handledCommentRefreshTokenRef.current = commentUserRefreshToken;
    }
    const canIdleSchedule = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
    const trigger = canIdleSchedule
      ? window.requestIdleCallback(() => {
        if (!cancelled) {
          void loadComments({ page: 1, append: false, shouldFocusNewItems });
        }
      })
      : window.setTimeout(() => {
        if (!cancelled) {
          void loadComments({ page: 1, append: false, shouldFocusNewItems });
        }
      }, 0);

    return () => {
      cancelled = true;
      if (canIdleSchedule && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(trigger);
      } else {
        window.clearTimeout(trigger);
      }
    };
  }, [clearCommentHighlights, docketId, commentRefreshKey, commentUserRefreshToken, loadComments]);

  useEffect(() => () => {
    if (commentHighlightTimeoutRef.current) {
      window.clearTimeout(commentHighlightTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!docketId || typeof document === 'undefined') return undefined;

    let intervalId = null;
    let disposed = false;

    const stopPolling = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPolling = () => {
      if (disposed || document.visibilityState !== 'visible' || intervalId) return;
      intervalId = window.setInterval(() => {
        void pollLatestUpdates();
      }, POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pollLatestUpdates();
        startPolling();
      } else {
        stopPolling();
      }
    };

    void pollLatestUpdates();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [docketId, pollLatestUpdates]);

  useEffect(() => {
    const initialActivityHeadId = docket?.activity?.[0]?._id || docket?.activity?.[0]?.id || null;
    if (initialActivityHeadId) {
      latestActivityHeadRef.current = initialActivityHeadId;
    }
  }, [docket?.activity]);

  const handleRefreshActivity = useCallback(() => {
    setActivityRefreshKey((prev) => prev + 1);
    setActivityUserRefreshToken((prev) => prev + 1);
    setNewActivityCount(0);
  }, []);

  const handleRefreshComments = useCallback(() => {
    setCommentRefreshKey((prev) => prev + 1);
    setCommentUserRefreshToken((prev) => prev + 1);
    setNewCommentCount(0);
  }, []);

  const loadUploadLinkStatus = useCallback(async () => {
    if (!docketId) return;
    try {
      const response = await caseApi.getUploadLinkStatus(docketId);
      setUploadLinkStatus(response?.data || null);
    } catch (statusError) {
      setUploadLinkStatus(null);
    }
  }, [docketId]);

  useEffect(() => {
    void loadUploadLinkStatus();
  }, [loadUploadLinkStatus]);

  const handleGenerateUploadLink = useCallback(async (payload) => {
    if (!docketId) return;
    setUploadLinkGenerating(true);
    try {
      const response = await caseApi.generateUploadLink(docketId, payload);
      setUploadLinkResult(response?.data || null);
      await loadUploadLinkStatus();
    } finally {
      setUploadLinkGenerating(false);
    }
  }, [docketId, loadUploadLinkStatus]);

  const handleRevokeUploadLink = useCallback(async () => {
    if (!docketId) return;
    await caseApi.revokeUploadLink(docketId);
    setUploadLinkResult(null);
    await loadUploadLinkStatus();
  }, [docketId, loadUploadLinkStatus]);

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

  const isWorklistLifecycle = String(docket.lifecycle || '').trim().toUpperCase() === 'WL'
    || String(docket.lifecycle || '').trim().toLowerCase() === 'in_worklist';
  const assigned = openedFromWorklist
    ? (user?.name || user?.xID || 'You')
    : (assignmentLabel(docket) || (isWorklistLifecycle ? '—' : 'Unassigned'));
  const title = docket.title || formatCaseName(docket.caseName);
  const lastUpdatedLabel = asDisplayValue(formatDateTime(docket.updatedAt));

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
            <p className="case-detail-header__subtitle">{asDisplayValue(title) === '—' ? 'Untitled docket' : title}</p>
            <div className="case-detail-header__meta">Assigned to: {assigned}</div>
          </div>
          <div className="case-detail-header__meta">Last updated: {lastUpdatedLabel}</div>
        </div>

        {children ? (
          <div className="case-detail-header__actions">
            {children}
          </div>
        ) : null}
      </header>
      <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <strong>Upload Link</strong>
          <button type="button" className="btn btn-primary" onClick={() => setRequestDocumentsOpen(true)}>
            Request Documents
          </button>
        </div>
        <p style={{ margin: '8px 0 0', color: '#4b5563' }}>
          Status: {uploadLinkStatus?.status || '—'}
        </p>
        <p style={{ margin: '4px 0 0', color: '#4b5563' }}>
          Expires At: {uploadLinkStatus?.expiresAt ? formatDateTime(uploadLinkStatus.expiresAt) : '—'}
        </p>
        {uploadLinkStatus?.expiresAt ? (
          <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
            Expires in {Math.max(0, Math.ceil((new Date(uploadLinkStatus.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))}h
          </p>
        ) : null}
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-danger" onClick={handleRevokeUploadLink}>
            Revoke Link
          </button>
        </div>
      </section>

      <ActivityTimeline
        docketId={docketId}
        initialActivity={docket.activity}
        refreshKey={activityRefreshKey}
        userRefreshToken={activityUserRefreshToken}
      />
      {newActivityCount > 0 ? (
        <button type="button" className="docket-updates-indicator" onClick={handleRefreshActivity}>
          🔔 {newActivityCount} new update{newActivityCount > 1 ? 's' : ''} — Click to refresh
        </button>
      ) : null}

      <section className="docket-comments-section" aria-labelledby="docket-comments-heading">
        <h2 id="docket-comments-heading" className="docket-comments-section__heading">Comments</h2>
        {newCommentCount > 0 ? (
          <button type="button" className="docket-updates-indicator" onClick={handleRefreshComments}>
            🔔 {newCommentCount} new comment{newCommentCount > 1 ? 's' : ''} — Click to refresh
          </button>
        ) : null}
        <CommentList
          comments={comments}
          loading={commentsLoading}
          loadingMore={commentsLoadingMore}
          error={commentsError}
          hasMore={commentsHasMore}
          onRetry={() => loadComments({ page: commentsPage, append: commentsPage > 1 })}
          onLoadMore={handleLoadMoreComments}
          highlightedCommentIds={highlightedCommentIds}
          scrollToCommentId={firstNewCommentId}
          scrollRequestToken={commentUserRefreshToken}
        />
        <CommentInput onSubmit={handleAddComment} disabled={commentSubmitting} />
      </section>
      <RequestDocumentsModal
        isOpen={requestDocumentsOpen}
        onClose={() => setRequestDocumentsOpen(false)}
        clientEmail={docket?.clientEmail || docket?.client?.email || docket?.clientData?.email || ''}
        generating={uploadLinkGenerating}
        generatedLink={uploadLinkResult}
        onGenerate={handleGenerateUploadLink}
      />
    </>
  );
}
