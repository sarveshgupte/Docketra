import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notificationsApi } from '../../api/notifications.api';
import { ROUTES } from '../../constants/routes';

const normalizeNotificationItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const countUnreadNotifications = (items) => items.reduce((total, item) => (
  item?.read === false || item?.isRead === false ? total + 1 : total
), 0);

export const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const { firmSlug } = useParams();

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await notificationsApi.getAllNotifications();
      const items = normalizeNotificationItems(response);
      setUnreadCount(countUnreadNotifications(items));
    } catch {
      // Intentionally silent so shell stays non-blocking.
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const ariaLabel = useMemo(() => (
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
  ), [unreadCount]);

  return (
    <button
      type="button"
      className="platform__notification-bell"
      aria-label={ariaLabel}
      onFocus={refreshNotifications}
      onClick={() => {
        refreshNotifications();
        navigate(ROUTES.NOTIFICATIONS(firmSlug));
      }}
    >
      <span className="platform__notification-bell-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      </span>
      {unreadCount > 0 ? <span className="platform__notification-badge" aria-hidden="true">{badgeLabel}</span> : null}
    </button>
  );
};

export { countUnreadNotifications, normalizeNotificationItems };
