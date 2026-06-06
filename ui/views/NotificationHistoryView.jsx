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

  // Tabs & Filters State
  const [activeTab, setActiveTab] = useState('feed');
  const [filterType, setFilterType] = useState('ALL');

  // Notifications State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  // Preferences Toggles State
  const [preferences, setPreferences] = useState(null);
  const [prefLoading, setPrefLoading] = useState(false);
  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const bannerTimeoutRef = useRef(null);

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

  // Hydrate Preferences
  const loadPreferences = useCallback(async () => {
    setPrefLoading(true);
    try {
      const response = await notificationsApi.getPreferences();
      if (response?.data) {
        setPreferences(response.data);
      }
    } catch {
      // Keep state neutral
    } finally {
      setPrefLoading(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    void loadNotifications();
    void loadPreferences();
  }, [loadNotifications, loadPreferences]);

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

  // Filter & Paginate Feed items
  const filteredRows = useMemo(() => {
    return items.filter((item) => {
      if (filterType === 'ALL') return true;
      const type = String(item.type || '').toUpperCase();
      if (filterType === 'ASSIGNMENTS') {
        return type === 'DOCKET_ASSIGNED' || type === 'DOCKET_REASSIGNED';
      }
      if (filterType === 'COMMENTS') {
        return type === 'COMMENT_ADDED' || type === 'MENTION';
      }
      if (filterType === 'SLA') {
        return type === 'SLA_BREACHED' || type === 'DOCKET_OVERDUE' || type === 'DOCKET_DUE_SOON';
      }
      if (filterType === 'SYSTEM') {
        return type !== 'DOCKET_ASSIGNED' && type !== 'DOCKET_REASSIGNED' && type !== 'COMMENT_ADDED' && type !== 'MENTION' && type !== 'SLA_BREACHED' && type !== 'DOCKET_OVERDUE' && type !== 'DOCKET_DUE_SOON';
      }
      return true;
    });
  }, [items, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const paginatedRows = useMemo(() => {
    const sliceStart = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(sliceStart, sliceStart + PAGE_SIZE);
  }, [filteredRows, safePage]);

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

  // Preference Toggle Handler
  const handlePreferenceToggle = async (type, channel) => {
    if (!preferences) return;

    // Mutate state optimistically
    const updatedPrefs = { ...preferences };
    if (!updatedPrefs.typeChannels) {
      updatedPrefs.typeChannels = {};
    }
    if (!updatedPrefs.typeChannels[type]) {
      // Populate defaults if not configured
      updatedPrefs.typeChannels[type] = {
        inApp: preferences.defaultChannels?.inApp ?? true,
        email: preferences.defaultChannels?.email ?? false,
      };
    }

    updatedPrefs.typeChannels[type][channel] = !updatedPrefs.typeChannels[type][channel];
    setPreferences(updatedPrefs);

    try {
      await notificationsApi.updatePreferences(updatedPrefs);

      // Visual feedback success banner
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
      setShowSavedBanner(true);
      bannerTimeoutRef.current = setTimeout(() => {
        setShowSavedBanner(false);
      }, 2500);
    } catch {
      // Revert if API failed
      loadPreferences();
    }
  };

  const corePreferencesList = [
    {
      type: 'DOCKET_ASSIGNED',
      name: 'Docket Assignments',
      description: 'Get notified immediately when dockets are assigned or reassigned to your queue.',
    },
    {
      type: 'COMMENT_ADDED',
      name: 'Team Comments & Mentions',
      description: 'Get notified when someone comments on your docket or tags you (@User) in comment activity.',
    },
    {
      type: 'SLA_BREACHED',
      name: 'SLA Warnings & Overdue Alerts',
      description: 'Critical alerts regarding approaching case deadlines, SLA breaches, and calendar limits.',
    },
    {
      type: 'DOCKET_ROUTED_TO_WORKBASKET',
      name: 'Workbasket & QC Routing',
      description: 'Receive alerts when dockets are routed to workbaskets or returned from Quality Control check.',
    },
    {
      type: 'CLIENT_UPLOAD',
      name: 'Client Activity & Uploads',
      description: 'Get notified when a client uploads documents to their shared workspaces.',
    },
  ];

  return (
    <PlatformShell
      title="Notification Hub"
      subtitle="Manage your inbox settings, toggle push notifications, and monitor live workspace alerts."
      actions={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showSavedBanner ? (
            <span className="status-saved-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Preferences saved
            </span>
          ) : null}
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.DASHBOARD(firmSlug))}>
            Back to Dashboard
          </Button>
        </div>
      )}
    >
      <div className="platform-page notification-history">

        {/* Navigation Tabs */}
        <div className="notifications-tabs" aria-label="Notification Hub tabs">
          <button
            type="button"
            className={`notifications-tab ${activeTab === 'feed' ? 'notifications-tab--active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            🔔 Activity Feed
            {unreadCount > 0 ? (
              <span style={{ fontSize: 11, background: '#ef4444', color: 'white', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                {unreadCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`notifications-tab ${activeTab === 'settings' ? 'notifications-tab--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Preferences & Settings
          </button>
        </div>

        {activeTab === 'feed' ? (
          <PageSection>
            {/* Toolbar: Category Filters & Bulk Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <div className="notification-filters">
                {['ALL', 'ASSIGNMENTS', 'COMMENTS', 'SLA', 'SYSTEM'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`notification-filter-btn ${filterType === cat ? 'notification-filter-btn--active' : ''}`}
                    onClick={() => {
                      setFilterType(cat);
                      setPage(1);
                    }}
                  >
                    {cat.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>

              {!loading && !error && unreadCount > 0 ? (
                <Button type="button" variant="outline" onClick={markAllNotificationsRead}>
                  Mark all as read
                </Button>
              ) : null}
            </div>

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

            {!loading && !error && filteredRows.length === 0 ? (
              <EmptyState
                title={`No ${filterType === 'ALL' ? '' : filterType.toLowerCase() + ' '}notifications`}
                body="Updates and activity reports will be compiled and displayed here."
                boxed
              />
            ) : null}

            {!loading && !error && filteredRows.length > 0 ? (
              <>
                {/* List Grouped by Date */}
                {Object.entries(groupedFeed).map(([groupName, groupItems]) => {
                  if (groupItems.length === 0) return null;

                  return (
                    <div key={groupName} className="notification-group">
                      <h3 className="notification-group-title">{groupName}</h3>
                      <div className="notification-history__list" style={{ display: 'grid', gap: 12 }}>
                        {groupItems.map((item) => {
                          const isRead = item.read || item.isRead;
                          const docketId = item.docket_id || item.docketId;
                          const createdAt = item.created_at || item.createdAt;
                          const visuals = getNotificationVisuals(item.type);

                          return (
                            <div
                              key={item._id}
                              className={`notification-card ${isRead ? '' : 'notification-card--unread'}`}
                            >
                              {/* Themed icon wrap */}
                              <div className={`notification-card__icon-wrap notification-card__icon-wrap--${visuals.colorClass}`}>
                                {visuals.icon}
                              </div>

                              <div className="notification-card__content">
                                <div className="notification-card__title-row">
                                  <p className="notification-card__message" style={{ fontWeight: isRead ? 500 : 700 }}>
                                    {item.message}
                                  </p>
                                  <div className="notification-card__actions">
                                    {!isRead ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        style={{ padding: '4px 8px', fontSize: 11 }}
                                        onClick={() => markNotificationRead(item._id)}
                                        aria-label={`Mark as read: ${item.message}`}
                                      >
                                        Mark read
                                      </Button>
                                    ) : null}
                                    {!isRead ? <span className="notification-card__read-dot" /> : null}
                                  </div>
                                </div>

                                <div className="notification-card__meta-row">
                                  <span className="notification-card__tag" style={{ color: `var(--dt-${visuals.colorClass})` }}>
                                    {visuals.tag}
                                  </span>
                                  <span className="notification-card__meta-dot" />
                                  <span>{createdAt ? formatDate(createdAt) : '—'}</span>
                                  {docketId ? (
                                    <>
                                      <span className="notification-card__meta-dot" />
                                      <button
                                        type="button"
                                        className="notification-history__docket-link"
                                        onClick={() => goToDocket(docketId)}
                                        style={{ fontWeight: 600 }}
                                        aria-label={`Open docket ${docketId}`}
                                      >
                                        Docket #{docketId}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
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
                  <span style={{ fontSize: 13, color: 'var(--color-ink-secondary, #7a7870)' }}>
                    Displaying <strong>{(safePage - 1) * PAGE_SIZE + 1} - {Math.min(safePage * PAGE_SIZE, filteredRows.length)}</strong> of <strong>{filteredRows.length}</strong> alerts
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
        ) : (
          <PageSection>
            {/* Preferences tab */}
            {prefLoading ? (
              <LoadingState label="Hydrating preferences context..." />
            ) : (
              <div className="preferences-card animate-slideDown">
                <div className="preferences-header">
                  <h3 className="preferences-title">Delivery Preferences</h3>
                  <p className="preferences-subtitle">Customize how and where you receive notifications across active categories.</p>
                </div>

                <div className="preferences-grid">
                  {corePreferencesList.map((pref) => {
                    const settings = preferences?.typeChannels?.[pref.type] || {
                      inApp: preferences?.defaultChannels?.inApp ?? true,
                      email: preferences?.defaultChannels?.email ?? false,
                    };

                    return (
                      <div key={pref.type} className="preference-item-row">
                        <div className="preference-item-info">
                          <h4 className="preference-item-name">{pref.name}</h4>
                          <p className="preference-item-description">{pref.description}</p>
                        </div>

                        <div className="preference-item-channels">
                          <label className="preference-channel-toggle" htmlFor={`inApp-${pref.type}`}>
                            <span>In-App</span>
                            <span className="custom-toggle">
                              <input
                                type="checkbox"
                                id={`inApp-${pref.type}`}
                                checked={Boolean(settings.inApp)}
                                onChange={() => handlePreferenceToggle(pref.type, 'inApp')}
                              />
                              <span className="custom-toggle-slider" />
                            </span>
                          </label>

                          <label className="preference-channel-toggle" htmlFor={`email-${pref.type}`}>
                            <span>Email</span>
                            <span className="custom-toggle">
                              <input
                                type="checkbox"
                                id={`email-${pref.type}`}
                                checked={Boolean(settings.email)}
                                onChange={() => handlePreferenceToggle(pref.type, 'email')}
                              />
                              <span className="custom-toggle-slider" />
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </PageSection>
        )}
      </div>
    </PlatformShell>
  );
}
