import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notificationsApi } from '../src/api/notifications.api';
import { Button } from '../src/components/common/Button';
import { Card } from '../src/components/common/Card';
import { Layout } from '../src/components/common/Layout';
import { PageHeader } from '../src/components/layout/PageHeader';
import { Stack } from '../src/components/layout/Stack';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ErrorState } from '../src/components/feedback/ErrorState';
import { SkeletonLoader } from '../src/components/ui/SkeletonLoader';
import { formatDate } from '../src/utils/formatters';
import { ROUTES } from '../src/constants/routes';

const PAGE_SIZE = 25;

function normalizeList(response) {
  const raw = response?.data;
  return Array.isArray(raw) ? raw : [];
}

function toGroupKey(item) {
  return [item.type || 'GENERIC', item.docket_id || 'global', item.message || ''].join('::');
}

function groupNotifications(items) {
  const grouped = new Map();
  items.forEach((item) => {
    const key = toGroupKey(item);
    const existing = grouped.get(key);
    const createdAtMs = item.created_at ? new Date(item.created_at).getTime() : 0;
    if (!existing) {
      grouped.set(key, { ...item, count: 1, latestAtMs: createdAtMs });
      return;
    }
    grouped.set(key, {
      ...existing,
      count: existing.count + 1,
      latestAtMs: Math.max(existing.latestAtMs, createdAtMs),
    });
  });
  return [...grouped.values()].sort((a, b) => b.latestAtMs - a.latestAtMs);
}

export function NotificationHistoryView() {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.getNotifications();
      setItems(normalizeList(response));
    } catch (err) {
      setError(err?.message || 'Failed to load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => groupNotifications(items), [items]);

  const totalPages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * PAGE_SIZE;
  const pageRows = grouped.slice(sliceStart, sliceStart + PAGE_SIZE);

  const goToDocket = (docketId) => {
    if (!firmSlug || !docketId) return;
    navigate(ROUTES.CASE_DETAIL(firmSlug, docketId));
  };

  return (
    <Layout>
      <Stack space={16}>
        <PageHeader
          title="Notification history"
          subtitle="Meaningful updates, grouped to reduce noise."
          actions={(
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.DASHBOARD(firmSlug))}>
              Back to dashboard
            </Button>
          )}
        />
        <Card>
          {loading ? <SkeletonLoader variant="text" /> : null}
          {!loading && error ? (
            <ErrorState
              title="Unable to load history"
              description="Please retry to load notification history."
              onRetry={load}
            />
          ) : null}
          {!loading && !error && grouped.length === 0 ? (
            <EmptyState
              title="No notification history"
              description="Once activity occurs, grouped updates will show here."
              icon
            />
          ) : null}
          {!loading && !error && grouped.length > 0 ? (
            <>
              <ul className="space-y-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {pageRows.map((item) => (
                  <li key={item._id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900" style={{ margin: 0 }}>{item.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.type ? `${item.type} · ` : ''}
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
                  Page {safePage} of {totalPages} ({grouped.length} grouped)
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
