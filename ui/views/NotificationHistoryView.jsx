import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notificationsApi } from '../src/api/notifications.api';
import { Button } from '../src/components/common/Button';
import { Card } from '../src/components/common/Card';
import { Layout } from '../src/components/common/Layout';
import { PageHeader } from '../src/components/layout/PageHeader';
import { Stack } from '../src/components/layout/Stack';
import { formatDate } from '../src/utils/formatters';
import { ROUTES } from '../src/constants/routes';

const PAGE_SIZE = 25;

function normalizeList(response) {
  const raw = response?.data;
  return Array.isArray(raw) ? raw : [];
}

export function NotificationHistoryView() {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

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

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [items],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(sliceStart, sliceStart + PAGE_SIZE);

  const goToDocket = (docketId) => {
    if (!firmSlug || !docketId) return;
    navigate(ROUTES.CASE_DETAIL(firmSlug, docketId));
  };

  return (
    <Layout>
      <Stack space={16}>
        <PageHeader
          title="Notification history"
          subtitle="Full log of notifications for your account (newest first)."
          actions={(
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.DASHBOARD(firmSlug))}>
              Back to dashboard
            </Button>
          )}
        />
        <Card>
          {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
          {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && sorted.length === 0 ? (
            <p className="text-sm text-gray-500">No notifications yet.</p>
          ) : null}
          {!loading && !error && sorted.length > 0 ? (
            <>
              <ul className="space-y-3">
                {pageRows.map((item) => (
                  <li key={item._id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.type ? `${item.type} · ` : ''}
                      {item.created_at ? formatDate(item.created_at) : '—'}
                      {item.docket_id ? (
                        <>
                          {' · '}
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => goToDocket(item.docket_id)}
                          >
                            {item.docket_id}
                          </button>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-gray-600">
                  Page {safePage} of {totalPages} ({sorted.length} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </Card>
      </Stack>
    </Layout>
  );
}
