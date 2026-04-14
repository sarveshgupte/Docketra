import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../src/api/notifications.api';
import { Button } from '../src/components/common/Button';
import { Card } from '../src/components/common/Card';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ErrorState } from '../src/components/feedback/ErrorState';
import { SkeletonLoader } from '../src/components/ui/SkeletonLoader';
import { formatDate } from '../src/utils/formatters';
import { ROUTES } from '../src/constants/routes';

const MEANINGFUL_TYPES = new Set([
  'ASSIGNED',
  'LIFECYCLE_CHANGED',
  'COMMENT_ADDED',
  'MENTION',
  'BLOCKED',
  'COMPLETED',
  'DUE_SOON',
]);

function normalizeList(response) {
  const raw = response?.data;
  return Array.isArray(raw) ? raw : [];
}

function toGroupKey(item) {
  return [item.type || 'GENERIC', item.docket_id || 'global', item.message || ''].join('::');
}

function groupNotifications(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = toGroupKey(item);
    const existing = map.get(key);
    const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
    if (!existing) {
      map.set(key, { ...item, count: 1, latestAt: createdAt, ids: [item._id] });
      return;
    }
    map.set(key, {
      ...existing,
      count: existing.count + 1,
      latestAt: Math.max(existing.latestAt, createdAt),
      ids: existing.ids.concat(item._id),
    });
  });

  return [...map.values()].sort((a, b) => b.latestAt - a.latestAt);
}

function isMeaningful(item) {
  if (!item || !item.message) return false;
  if (!item.type) return true;
  return MEANINGFUL_TYPES.has(String(item.type).toUpperCase());
}

export function NotificationPanel({ firmSlug, limit = 8 }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.getNotifications({ limit });
      setItems(normalizeList(response));
    } catch (err) {
      if (err?.status === 404) {
        setItems([]);
        return;
      }
      setError(err?.message || 'Failed to load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [limit]);

  const grouped = useMemo(() => {
    const meaningful = items.filter((item) => isMeaningful(item) && !dismissed.includes(item._id));
    return groupNotifications(meaningful);
  }, [items, dismissed]);

  const visible = typeof limit === 'number' ? grouped.slice(0, limit) : grouped;

  const goToDocket = (docketId) => {
    if (!firmSlug || !docketId) return;
    navigate(ROUTES.CASE_DETAIL(firmSlug, docketId));
  };

  const dismissGroup = (ids = []) => {
    if (!ids.length) return;
    setDismissed((prev) => [...new Set([...prev, ...ids])]);
  };

  if (loading) {
    return (
      <Card>
        <SkeletonLoader variant="text" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState
          title="Unable to load notifications"
          description="Try again to load your latest docket activity."
          onRetry={loadNotifications}
        />
      </Card>
    );
  }

  if (grouped.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No meaningful notifications"
          description="Important updates (assignment, lifecycle, comments) will appear here."
          icon
        />
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{grouped.length} grouped update{grouped.length > 1 ? 's' : ''}</p>
        <Button type="button" variant="outline" onClick={() => setDismissed(items.map((item) => item._id))}>Clear all</Button>
      </div>
      <ul className="space-y-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visible.map((item) => (
          <li key={`${item._id}-${item.latestAt}`} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <p className="text-sm text-gray-900" style={{ margin: 0, fontWeight: item.read ? 500 : 700 }}>{item.message}{!item.read ? " · Unread" : ""}</p>
              <Button type="button" variant="ghost" onClick={() => dismissGroup(item.ids)} aria-label="Dismiss notification group">Dismiss</Button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {item.created_at ? formatDate(item.created_at) : '—'}
              {item.count > 1 ? ` · ${item.count} similar` : ''}
              {item.docket_id ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => goToDocket(item.docket_id)}
                  >
                    Open docket {item.docket_id}
                  </button>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 12 }}>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(ROUTES.NOTIFICATIONS_HISTORY(firmSlug))}
        >
          View All
        </Button>
      </div>
    </Card>
  );
}
