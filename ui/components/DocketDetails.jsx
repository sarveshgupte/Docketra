import React, { useCallback, useEffect, useState } from 'react';
import { caseApi } from '../src/api/case.api';
import { invalidateCaseCache } from '../src/utils/caseCache';
import { formatDateTime } from '../src/utils/formatDateTime';
import { LifecycleBadge } from './LifecycleBadge';
import { ActivityTimeline } from '../src/components/docket/ActivityTimeline';
import { CommentList } from '../src/components/docket/CommentList';
import { CommentInput } from '../src/components/docket/CommentInput';
import { useAuth } from '../src/hooks/useAuth';

const normalizeDoc = (data) => data?.case || data;

const formatDocketId = (value = '') => String(value || '').replace(/^CASE-/, 'DOCKET-');

const CASE_FETCH_PARAMS = {
  commentsPage: 1,
  commentsLimit: 1,
  activityPage: 1,
  activityLimit: 25,
};

const COMMENT_PAGE_SIZE = 10;

const getCommentParams = (page = 1) => ({
  commentsPage: page,
  commentsLimit: COMMENT_PAGE_SIZE,
  activityPage: 1,
  activityLimit: 1,
});

const normalizeComment = (comment, index = 0) => ({
  ...comment,
  id: comment?.id || comment?._id || `comment-${comment?.createdAt || 'unknown'}-${index}`,
  text: comment?.text || '',
  createdAt: comment?.createdAt || new Date().toISOString(),
});

const extractCommentsPayload = (response) => {
  const payload = response?.data?.case || response?.data || {};
  return {
    comments: Array.isArray(payload?.comments) ? payload.comments : [],
    pagination: payload?.pagination?.comments || {},
  };
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

  const loadComments = useCallback(async ({ page = 1, append = false } = {}) => {
    if (!docketId) return;

    setCommentsError('');
    if (append) {
      setCommentsLoadingMore(true);
    } else {
      setCommentsLoading(true);
    }

    try {
      const response = await caseApi.getCaseById(docketId, getCommentParams(page));
      const payload = extractCommentsPayload(response);
      const normalized = payload.comments.map((comment, index) => normalizeComment(comment, index));
      setComments((prev) => {
        if (!append) return normalized;
        return [...prev, ...normalized.filter((next) => !prev.some((existing) => (existing._id || existing.id) === (next._id || next.id)))];
      });
      setCommentsPage(page);
      setCommentsHasMore(Boolean(payload.pagination?.hasMore));
    } catch (loadError) {
      setCommentsError('Unable to load comments. Retry.');
    } finally {
      setCommentsLoading(false);
      setCommentsLoadingMore(false);
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

    let cancelled = false;
    const canIdleSchedule = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
    const trigger = canIdleSchedule
      ? window.requestIdleCallback(() => {
        if (!cancelled) {
          void loadComments({ page: 1, append: false });
        }
      })
      : window.setTimeout(() => {
        if (!cancelled) {
          void loadComments({ page: 1, append: false });
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
  }, [docketId, loadComments]);

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

      <ActivityTimeline docketId={docketId} initialActivity={docket.activity} refreshKey={activityRefreshKey} />

      <section className="docket-comments-section" aria-labelledby="docket-comments-heading">
        <h2 id="docket-comments-heading" className="docket-comments-section__heading">Comments</h2>
        <CommentList
          comments={comments}
          loading={commentsLoading}
          loadingMore={commentsLoadingMore}
          error={commentsError}
          hasMore={commentsHasMore}
          onRetry={() => loadComments({ page: commentsPage, append: commentsPage > 1 })}
          onLoadMore={handleLoadMoreComments}
        />
        <CommentInput onSubmit={handleAddComment} disabled={commentSubmitting} />
      </section>
    </>
  );
}
