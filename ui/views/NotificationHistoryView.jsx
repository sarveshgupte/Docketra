import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notificationsApi } from '../src/api/notifications.api';
import { Button } from '../src/components/common/Button';
import { PlatformShell } from '../src/components/platform/PlatformShell';
import { EmptyState, ErrorState, LoadingState, PageSection } from '../src/pages/platform/PlatformShared';
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.getAllNotifications();
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
    void load();
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const pageRows = useMemo(() => {
    const sliceStart = (safePage - 1) * PAGE_SIZE;
    return items.slice(sliceStart, sliceStart + PAGE_SIZE);
  }, [items, safePage]);

  const unreadCount = useMemo(
    () => items.reduce((count, item) => ((item?.read === false || item?.isRead === false) ? count + 1 : count), 0),
    [items],
  );

  const goToDocket = (docketId) => {
    if (!firmSlug || !docketId) return;
    navigate(ROUTES.CASE_DETAIL(firmSlug, docketId));
  };

  const markNotificationRead = async (id) => {
    if (!id) return;
    try {
      await notificationsApi.markAsRead(id);
      setItems((prev) => prev.map((item) => (item._id === id ? { ...item, read: true, isRead: true } : item)));
    } catch {
      // no-op; optimistic UI isn't needed here
    }
  };

  const markAllNotificationsRead = async () => {
    if (unreadCount <= 0) return;
    try {
      await notificationsApi.markAllAsRead();
      setItems((prev) => prev.map((item) => ({ ...item, read: true, isRead: true })));
    } catch {
      // no-op
    }
  };

  return (
    <PlatformShell
      title="Notification history"
      subtitle="Review workspace updates, unread items, and docket-linked notifications."
      actions={(
        <Button type="button" variant="outline" onClick={() => navigate(ROUTES.DASHBOARD(firmSlug))}>
          Back to dashboard
        </Button>
      )}
    >
      <div className="platform-page notification-history">
        <PageSection>
          {!loading && !error && unreadCount > 0 ? (
            <div className="notification-history__bulk-actions">
              <Button type="button" variant="outline" onClick={markAllNotificationsRead}>
                Mark all as read
              </Button>
            </div>
          ) : null}

          {loading ? <LoadingState label="Loading notification history…" /> : null}

          {!loading && error ? (
            <ErrorState
              title="Unable to load history"
              body="Please retry to load notification history."
              actionLabel="Retry"
              onAction={load}
              boxed
            />
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <EmptyState
              title="No notification history"
              body="Once activity occurs, updates will show here."
              boxed
            />
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <>
              <ul className="notification-history__list" aria-label="Notification history list">
                {pageRows.map((item) => {
                  const isRead = item.read || item.isRead;
                  const docketId = item.docket_id || item.docketId;
                  const createdAt = item.created_at || item.createdAt;

                  return (
                    <li
                      key={item._id}
                      className={`notification-history__item ${isRead ? '' : 'notification-history__item--unread'}`.trim()}
                    >
                      <div className="notification-history__actions">
                        <p className="notification-history__message">{item.message}</p>
                        {!isRead ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => markNotificationRead(item._id)}
                            aria-label={`Mark notification as read: ${item.message}`}
                          >
                            Mark as read
                          </Button>
                        ) : null}
                      </div>

                      <p className="notification-history__meta">
                        <span>{item.type || 'Notification'}</span>
                        <span>{createdAt ? formatDate(createdAt) : '—'}</span>
                        <span>{isRead ? 'Read' : 'Unread'}</span>
                        {docketId ? (
                          <button
                            type="button"
                            className="notification-history__docket-link"
                            onClick={() => goToDocket(docketId)}
                            aria-label={`Open docket ${docketId}`}
                          >
                            Docket {docketId}
                          </button>
                        ) : null}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="notification-history__pagination" aria-label="Notification history pagination">
                <span>
                  Page {safePage} of {totalPages} ({items.length} notifications)
                </span>
                <div className="notification-history__pagination-actions">
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
        </PageSection>
      </div>
    </PlatformShell>
  );
}
