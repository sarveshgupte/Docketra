import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../src/api/notifications.api';
import { Button } from '../src/components/common/Button';
import { Card } from '../src/components/common/Card';
import { formatDate } from '../src/utils/formatters';
import { ROUTES } from '../src/constants/routes';

function normalizeList(response) {
  const raw = response?.data;
  return Array.isArray(raw) ? raw : [];
}

export function NotificationPanel({ firmSlug, limit = 8 }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await notificationsApi.getNotifications();
        if (!mounted) return;
        setItems(normalizeList(response));
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'Failed to load notifications');
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );
  const visible = typeof limit === 'number' ? sorted.slice(0, limit) : sorted;

  const goToDocket = (docketId) => {
    if (!firmSlug || !docketId) return;
    navigate(ROUTES.CASE_DETAIL(firmSlug, docketId));
  };

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-gray-500">Loading notifications…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500">No notifications yet.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <ul className="space-y-3">
        {visible.map((item) => (
          <li key={item._id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{item.message}</p>
            <p className="mt-1 text-xs text-gray-500">
              {item.created_at ? formatDate(item.created_at) : '—'}
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
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => navigate(ROUTES.NOTIFICATIONS_HISTORY(firmSlug))}
      >
        View All Notifications
      </Button>
    </Card>
  );
}
