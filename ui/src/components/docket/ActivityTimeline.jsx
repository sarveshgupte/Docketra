import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { caseApi } from '../../api/case.api';
import {
  groupActivityEvents,
  normalizeActivityEvent,
  sortActivityLatestFirst,
} from '../../utils/activityMap';
import { ActivityItem } from './ActivityItem';

const ACTIVITY_ONLY_PARAMS = {
  activityPage: 1,
  activityLimit: 50,
  commentsPage: 1,
  commentsLimit: 1,
};

const normalizeFeed = (input) => {
  if (!Array.isArray(input)) return [];
  return input.map((event, index) => normalizeActivityEvent(event, index));
};

const extractActivity = (response) => {
  const payload = response?.data?.case || response?.data || {};
  return payload?.activity || payload?.events || [];
};

export function ActivityTimeline({
  docketId,
  initialActivity = [],
  refreshKey = 0,
  userRefreshToken = 0,
}) {
  const [activity, setActivity] = useState(() => normalizeFeed(initialActivity));
  const [loading, setLoading] = useState(() => !Array.isArray(initialActivity) || initialActivity.length === 0);
  const [error, setError] = useState('');
  const [highlightedActivityIds, setHighlightedActivityIds] = useState([]);
  const previousHeadIdRef = useRef(null);
  const handledUserRefreshTokenRef = useRef(0);
  const clearHighlightsTimeoutRef = useRef(null);
  const sectionTopRef = useRef(null);
  const activityItemRefs = useRef(new Map());

  const clearHighlights = useCallback(() => {
    if (clearHighlightsTimeoutRef.current) {
      window.clearTimeout(clearHighlightsTimeoutRef.current);
      clearHighlightsTimeoutRef.current = null;
    }
    setHighlightedActivityIds([]);
  }, []);

  const scheduleHighlightClear = useCallback(() => {
    if (clearHighlightsTimeoutRef.current) {
      window.clearTimeout(clearHighlightsTimeoutRef.current);
    }
    clearHighlightsTimeoutRef.current = window.setTimeout(() => {
      setHighlightedActivityIds([]);
      clearHighlightsTimeoutRef.current = null;
    }, 2500);
  }, []);

  const loadActivity = useCallback(async ({ silent = false, shouldFocusNewItems = false } = {}) => {
    if (!docketId) return;

    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const response = await caseApi.getCaseById(docketId, ACTIVITY_ONLY_PARAMS);
      const events = normalizeFeed(extractActivity(response));
      const latestHeadId = events[0]?.id || events[0]?._id || null;
      const previousHeadId = previousHeadIdRef.current;
      let newActivityIds = [];

      if (shouldFocusNewItems && latestHeadId && previousHeadId && latestHeadId !== previousHeadId) {
        for (const event of events) {
          const eventId = event?.id || event?._id;
          if (!eventId || eventId === previousHeadId) break;
          newActivityIds.push(eventId);
        }
      }

      setActivity(events);
      previousHeadIdRef.current = latestHeadId || previousHeadIdRef.current;

      if (shouldFocusNewItems) {
        if (newActivityIds.length > 0) {
          setHighlightedActivityIds(newActivityIds);
          scheduleHighlightClear();
          const firstNewItem = activityItemRefs.current.get(newActivityIds[0]);
          if (firstNewItem?.scrollIntoView) {
            firstNewItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (sectionTopRef.current?.scrollIntoView) {
            sectionTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          clearHighlights();
          sectionTopRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        }
      }
    } catch (e) {
      if (!silent) {
        setError('Unable to load activity. Retry.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [clearHighlights, docketId, scheduleHighlightClear]);

  useEffect(() => {
    const fromSnapshot = normalizeFeed(initialActivity);
    setActivity(fromSnapshot);
    previousHeadIdRef.current = fromSnapshot[0]?.id || fromSnapshot[0]?._id || null;
    clearHighlights();
  }, [clearHighlights, initialActivity]);

  useEffect(() => {
    if (!docketId) return undefined;

    let cancelled = false;
    const shouldFocusNewItems = userRefreshToken > handledUserRefreshTokenRef.current;
    if (shouldFocusNewItems) {
      handledUserRefreshTokenRef.current = userRefreshToken;
    }
    const canIdleSchedule = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
    const trigger = canIdleSchedule
      ? window.requestIdleCallback(() => {
        if (!cancelled) {
          void loadActivity({ shouldFocusNewItems });
        }
      })
      : window.setTimeout(() => {
        if (!cancelled) {
          void loadActivity({ shouldFocusNewItems });
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
  }, [docketId, refreshKey, loadActivity, userRefreshToken]);

  useEffect(() => () => {
    if (clearHighlightsTimeoutRef.current) {
      window.clearTimeout(clearHighlightsTimeoutRef.current);
    }
  }, []);

  const groupedActivity = useMemo(() => {
    const sorted = sortActivityLatestFirst(activity);
    return groupActivityEvents(sorted);
  }, [activity]);

  return (
    <section className="docket-activity" aria-labelledby="docket-activity-heading" ref={sectionTopRef}>
      <h2 id="docket-activity-heading" className="docket-activity__heading">Activity</h2>

      {loading ? (
        <ul className="docket-activity__skeleton" aria-label="Loading activity">
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index} className="docket-activity__skeleton-item">
              <span className="docket-activity__skeleton-dot" />
              <div className="docket-activity__skeleton-content">
                <span className="docket-activity__skeleton-line docket-activity__skeleton-line--primary" />
                <span className="docket-activity__skeleton-line docket-activity__skeleton-line--secondary" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && error ? (
        <div className="docket-activity__error" role="status">
          <span>{error}</span>
          <button type="button" className="docket-activity__retry" onClick={loadActivity}>Retry</button>
        </div>
      ) : null}

      {!loading && !error && groupedActivity.length === 0 ? (
        <div className="docket-activity__empty">
          <h3>No activity yet</h3>
          <p>Actions, updates, and comments on this docket will appear here.</p>
        </div>
      ) : null}

      {!loading && !error && groupedActivity.length > 0 ? (
        <ul className="docket-activity__list">
          {groupedActivity.map((event) => (
            <ActivityItem
              key={event.id}
              event={event}
              className={highlightedActivityIds.includes(event.id) ? 'docket-activity-item--new' : ''}
              itemRef={(node) => {
                if (node) {
                  activityItemRefs.current.set(event.id, node);
                } else {
                  activityItemRefs.current.delete(event.id);
                }
              }}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
