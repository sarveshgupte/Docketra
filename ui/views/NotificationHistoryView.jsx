import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { notificationsApi } from '../src/api/notifications.api';
import { Button } from '../src/components/common/Button';
import { PlatformShell } from '../src/components/platform/PlatformShell';
import { EmptyState, ErrorState, LoadingState, PageSection } from '../src/pages/platform/PlatformShared';
import { formatDate } from '../src/utils/formatters';
import { ROUTES } from '../src/constants/routes';
import { API_BASE_URL } from '../src/utils/constants';

const PAGE_SIZE = 25;

// Helper to determine badge color and SVG icon per type
const getNotificationVisuals = (type) => {
  const normType = String(type || '').toUpperCase();
  switch (normType) {
    case 'DOCKET_ASSIGNED':
    case 'DOCKET_REASSIGNED':
      return {
        colorClass: 'info',
        tag: 'Assignment',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        ),
      };
    case 'COMMENT_ADDED':
    case 'MENTION':
      return {
        colorClass: 'primary',
        tag: 'Mention',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      };
    case 'STATUS_CHANGED':
    case 'PENDED_DOCKET_REOPENED':
      return {
        colorClass: 'success',
        tag: 'Status Update',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
      };
    case 'SLA_BREACHED':
    case 'DOCKET_OVERDUE':
    case 'DOCKET_DUE_SOON':
      return {
        colorClass: 'danger',
        tag: 'Urgent Alert',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    case 'QC_RETURNED':
      return {
        colorClass: 'warning',
        tag: 'QC Return',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 1v22M23 7l-6-6-6 6" />
          </svg>
        ),
      };
    case 'CLIENT_UPLOAD':
      return {
        colorClass: 'primary',
        tag: 'Client Upload',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        ),
      };
    default:
      return {
        colorClass: 'neutral',
        tag: 'System',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        ),
      };
  }
};

// Group notifications helper
const groupNotificationsByDate = (items) => {
  const grouped = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  items.forEach((item) => {
    const itemDate = new Date(item.created_at || item.createdAt || new Date());
    itemDate.setHours(0, 0, 0, 0);

    if (itemDate.getTime() === today.getTime()) {
      grouped.Today.push(item);
    } else if (itemDate.getTime() === yesterday.getTime()) {
      grouped.Yesterday.push(item);
    } else {
      grouped.Earlier.push(item);
    }
  });

  return grouped;
};

export function NotificationHistoryView() {
  const { firmSlug } = useParams();
  const navigate = useNavigate();

  // Notifications State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  // Hydrate Notifications
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await notificationsApi.getAllNotifications();
      const raw = response?.data;
      setItems(Array.isArray(raw) ? raw : []);
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
  }, []);

  // Initial Fetch
  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Real-time socket updates for dynamic history view
  useEffect(() => {
    const resolveSocketUrl = () => {
      if (!API_BASE_URL || API_BASE_URL.startsWith('/')) {
        return undefined;
      }
      return API_BASE_URL.replace(/\/api$/, '');
    };

    const socket = io(resolveSocketUrl(), {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:new', (payload) => {
      if (!payload) return;
      
      setItems((prev) => {
        // De-duplicate in case it is already retrieved
        const deduped = prev.filter((item) => item._id !== payload._id && item.id !== payload._id);
        return [payload, ...deduped];
      });
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Sort Feed items in descending order of creation date
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const paginatedRows = useMemo(() => {
    const sliceStart = (safePage - 1) * PAGE_SIZE;
    return sortedItems.slice(sliceStart, sliceStart + PAGE_SIZE);
  }, [sortedItems, safePage]);

  const groupedFeed = useMemo(() => {
    return groupNotificationsByDate(paginatedRows);
  }, [paginatedRows]);

  const unreadCount = useMemo(
    () => items.reduce((count, item) => ((item?.read === false || item?.isRead === false) ? count + 1 : count), 0),
    [items],
  );

  // Operations
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
      // optimistic fallback
    }
  };

  const markAllNotificationsRead = async () => {
    if (unreadCount <= 0) return;
    try {
      await notificationsApi.markAllAsRead();
      setItems((prev) => prev.map((item) => ({ ...item, read: true, isRead: true })));
    } catch {
      // fallback
    }
  };

  return (
    <PlatformShell
      title="Notification Hub"
      subtitle="Monitor live workspace alerts and track active docket updates."
      actions={
        <Button type="button" variant="outline" onClick={() => navigate(ROUTES.DASHBOARD(firmSlug))}>
          Back to Dashboard
        </Button>
      }
    >
      <div className="platform-page notification-history">
        <PageSection>
          {/* Toolbar: Bulk Actions */}
          {!loading && !error && unreadCount > 0 ? (
            <div className="notification-history__bulk-actions">
              <Button type="button" variant="outline" onClick={markAllNotificationsRead}>
                Mark all as read
              </Button>
            </div>
          ) : null}

          {loading ? <LoadingState label="Hydrating notification feed..." /> : null}

          {!loading && error ? (
            <ErrorState
              title="Failed to load notifications"
              body="Please try reloading your notifications feed."
              actionLabel="Retry feed reload"
              onAction={loadNotifications}
              boxed
            />
          ) : null}

          {!loading && !error && sortedItems.length === 0 ? (
            <EmptyState
              title="No notifications"
              body="Updates and activity reports will be compiled and displayed here."
              boxed
            />
          ) : null}

          {!loading && !error && sortedItems.length > 0 ? (
            <>
              {/* List Grouped by Date */}
              {Object.entries(groupedFeed).map(([groupName, groupItems]) => {
                if (groupItems.length === 0) return null;

                return (
                  <div key={groupName} className="notification-group">
                    <h3 className="notification-group-title">{groupName}</h3>
                    <div className="notification-history__list">
                      {groupItems.map((item) => {
                        const isRead = item.read || item.isRead;
                        const docketId = item.docket_id || item.docketId;
                        const createdAt = item.created_at || item.createdAt;
                        const visuals = getNotificationVisuals(item.type);

                        return (
                          <div
                            key={item._id}
                            className={`notification-history__item ${isRead ? '' : 'notification-history__item--unread'}`}
                          >
                            <div className="notification-history__actions">
                              <p className="notification-history__message">
                                {item.message}
                              </p>
                              {!isRead ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => markNotificationRead(item._id)}
                                  aria-label={`Mark as read: ${item.message}`}
                                >
                                  Mark read
                                </Button>
                              ) : null}
                            </div>

                            <div className="notification-history__meta">
                              <span>{visuals.tag}</span>
                              <span>{createdAt ? formatDate(createdAt) : '—'}</span>
                              {docketId ? (
                                <span>
                                  <button
                                    type="button"
                                    className="notification-history__docket-link"
                                    onClick={() => goToDocket(docketId)}
                                    aria-label={`Open docket ${docketId}`}
                                  >
                                    Docket #{docketId}
                                  </button>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Feed Pagination */}
              <div className="notification-history__pagination" aria-label="Notification history pagination">
                <span className="muted">
                  Displaying <strong>{(safePage - 1) * PAGE_SIZE + 1} - {Math.min(safePage * PAGE_SIZE, sortedItems.length)}</strong> of <strong>{sortedItems.length}</strong> alerts
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
