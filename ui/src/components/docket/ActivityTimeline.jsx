import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

export function ActivityTimeline({ docketId, initialActivity = [], refreshKey = 0 }) {
  const [activity, setActivity] = useState(() => normalizeFeed(initialActivity));
  const [loading, setLoading] = useState(() => !Array.isArray(initialActivity) || initialActivity.length === 0);
  const [error, setError] = useState('');

  const loadActivity = useCallback(async () => {
    if (!docketId) return;

    setLoading(true);
    setError('');
    try {
      const response = await caseApi.getCaseById(docketId, ACTIVITY_ONLY_PARAMS);
      const events = normalizeFeed(extractActivity(response));
      setActivity(events);
    } catch (e) {
      setError('Unable to load activity. Retry.');
    } finally {
      setLoading(false);
    }
  }, [docketId]);

  useEffect(() => {
    const fromSnapshot = normalizeFeed(initialActivity);
    setActivity(fromSnapshot);
  }, [initialActivity]);

  useEffect(() => {
    if (!docketId) return undefined;

    let cancelled = false;
    const canIdleSchedule = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
    const trigger = canIdleSchedule
      ? window.requestIdleCallback(() => {
        if (!cancelled) {
          void loadActivity();
        }
      })
      : window.setTimeout(() => {
        if (!cancelled) {
          void loadActivity();
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
  }, [docketId, refreshKey, loadActivity]);

  const groupedActivity = useMemo(() => {
    const sorted = sortActivityLatestFirst(activity);
    return groupActivityEvents(sorted);
  }, [activity]);

  return (
    <section className="docket-activity" aria-labelledby="docket-activity-heading">
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
            <ActivityItem key={event.id} event={event} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
