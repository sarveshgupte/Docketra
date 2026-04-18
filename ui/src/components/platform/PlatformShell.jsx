import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { notificationsApi } from '../../api/notifications.api';
import { ROUTES } from '../../constants/routes';
import { API_BASE_URL, STORAGE_KEYS } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatDateTime';
import './platform.css';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const navForRole = (firmSlug, role) => {
  const all = [
    { section: 'Dashboard', items: [{ to: ROUTES.DASHBOARD(firmSlug), label: 'Dashboard', icon: '◫' }] },
    {
      section: 'Core Work',
      items: [
        { to: ROUTES.GLOBAL_WORKLIST(firmSlug), label: 'Workbaskets', icon: '▤', minRole: 'ADMIN' },
        { to: ROUTES.WORKLIST(firmSlug), label: 'My Worklist', icon: '☰', minRole: 'USER' },
        { to: ROUTES.QC_QUEUE(firmSlug), label: 'QC Queue', icon: '✓', minRole: 'MANAGER' },
      ],
    },
    { section: 'Reports', items: [{ to: ROUTES.ADMIN_REPORTS(firmSlug), label: 'Reports', icon: '◔', minRole: 'ADMIN' }] },
    { section: 'CRM', items: [{ to: ROUTES.CRM_CLIENTS(firmSlug), label: 'CRM', icon: '◉', minRole: 'ADMIN' }] },
    { section: 'CMS', items: [{ to: ROUTES.CMS(firmSlug), label: 'CMS Intake', icon: '⌁', minRole: 'ADMIN' }] },
    { section: 'Settings', items: [{ to: ROUTES.SETTINGS(firmSlug), label: 'Settings', icon: '⚙', minRole: 'ADMIN' }] },
  ];

  return all.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.minRole || hasAtLeastRole(role, item.minRole)),
  })).filter((section) => section.items.length > 0);
};

export const PlatformShell = ({ title, subtitle, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const { showError } = useToast();
  const role = String(user?.role || 'USER').toUpperCase();
  const navSections = useMemo(() => navForRole(firmSlug, role), [firmSlug, role]);
  const notificationRef = useRef(null);

  const unreadCount = notificationItems.filter((item) => !item.read).length;

  const normalizeNotification = useCallback((item) => ({
    id: item.id || item._id,
    title: item.title || 'Notification',
    message: item.message || 'You have a new update.',
    docketId: item.docketId || item.docket_id || null,
    type: String(item.type || 'UPDATE').replaceAll('_', ' '),
    read: Boolean(item.isRead ?? item.read),
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
  }), []);

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const loadNotifications = async () => {
      try {
        const response = await notificationsApi.getNotifications({ limit: 10 });
        if (!cancelled) {
          setNotificationItems(Array.isArray(response?.data) ? response.data.map(normalizeNotification) : []);
        }
      } catch (error) {
        if (!cancelled) showError(error?.message || 'Failed to load notifications');
      }
    };

    const resolveSocketUrl = () => {
      if (!API_BASE_URL || API_BASE_URL.startsWith('/')) return undefined;
      return API_BASE_URL.replace(/\/api$/, '');
    };

    void loadNotifications();
    const pollId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (accessToken) {
      socket = io(resolveSocketUrl(), {
        path: '/socket.io',
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
      });

      socket.on('notification:new', (payload) => {
        if (cancelled || !payload) return;
        const normalized = normalizeNotification(payload);
        setNotificationItems((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)].slice(0, 10));
      });
    }

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      socket?.disconnect();
    };
  }, [normalizeNotification, showError]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setNotificationOpen(false);
  }, [pathname]);

  const markNotificationRead = async (notificationId) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setNotificationItems((current) => current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
    } catch (error) {
      showError(error?.message || 'Failed to mark notification as read');
    }
  };

  const markAllRead = async () => {
    const unreadItems = notificationItems.filter((item) => !item.read);
    try {
      await Promise.all(unreadItems.map((item) => notificationsApi.markAsRead(item.id)));
      setNotificationItems((current) => current.map((item) => ({ ...item, read: true })));
    } catch (error) {
      showError(error?.message || 'Failed to mark notifications as read');
    }
  };

  return (
    <div className={`platform ${dark ? 'platform--dark' : ''}`}>
      <aside className={`platform__sidebar ${collapsed ? 'platform__sidebar--collapsed' : ''}`}>
        <div className="platform__brand">
          <button type="button" className="platform__collapse" onClick={() => setCollapsed((value) => !value)}>{collapsed ? '→' : '←'}</button>
          {!collapsed && <div><strong>Docketra</strong><p>Workflow OS</p></div>}
        </div>
        <nav className="platform__nav" aria-label="Primary">
          {navSections.map((section) => (
            <div key={section.section} className="platform__nav-section">
              {!collapsed && <span className="platform__section-title">{section.section}</span>}
              {section.items.map((item) => (
                <Link key={item.to} to={item.to} className={`platform__nav-link ${pathname === item.to ? 'is-active' : ''}`} title={item.label}>
                  <span>{item.icon}</span>{!collapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="platform__main">
        <header className="platform__topbar">
          <div><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="platform__actions">
            <div className="platform__notifications" ref={notificationRef}>
              <button type="button" className="platform__icon-button" onClick={() => setNotificationOpen((value) => !value)} aria-label="Notifications" aria-expanded={notificationOpen}>
                🔔
                {unreadCount > 0 ? <span className="platform__notification-count">{unreadCount}</span> : null}
              </button>
              {notificationOpen ? (
                <div className="platform__notification-menu">
                  <div className="platform__notification-header">
                    <strong>Notifications</strong>
                    <button type="button" onClick={markAllRead} disabled={unreadCount === 0}>Mark all read</button>
                  </div>
                  {notificationItems.length === 0 ? (
                    <p className="muted">No notifications yet.</p>
                  ) : (
                    <div className="platform__notification-list">
                      {notificationItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`platform__notification-item ${item.read ? '' : 'is-unread'}`}
                          onClick={() => {
                            void markNotificationRead(item.id);
                            if (item.docketId) {
                              navigate(ROUTES.CASE_DETAIL(firmSlug, item.docketId));
                            }
                          }}
                        >
                          <div className="platform__notification-item-header">
                            <span>{item.title}</span>
                            {!item.read ? <span className="platform__notification-pill">New</span> : null}
                          </div>
                          <p>{item.message}</p>
                          <small>{item.type} • {formatDateTime(item.createdAt)}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => setDark((value) => !value)}>{dark ? 'Light' : 'Dark'}</button>
            <button type="button" onClick={() => navigate(ROUTES.CASES(firmSlug))}>All Dockets</button>
          </div>
        </header>
        <main className="platform__content">{children}</main>
      </div>
    </div>
  );
};
