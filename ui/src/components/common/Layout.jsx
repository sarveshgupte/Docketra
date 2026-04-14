/**
 * Enterprise Sidebar Layout Component
 * Docketra B2B SaaS Platform — 2026 Edition
 * Minimalist collapsible sidebar + glass Omnibar header
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { SidebarSection } from '../navigation/SidebarSection';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import api from '../../services/api';
import { worklistApi } from '../../api/worklist.api';
import { notificationsApi } from '../../api/notifications.api';
import { APP_NAME, APP_VERSION, USER_ROLES } from '../../utils/constants';
import { useActiveDocket } from '../../hooks/useActiveDocket';
import { formatDateTime } from '../../utils/formatDateTime';
import { getFirmConfig } from '../../utils/firmConfig';
import './Layout.css';
import { ROUTES, safeRoute } from '../../constants/routes';

/* SVG icon helpers */
const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconWorkbasket = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconWorklist = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const IconAdmin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
  </svg>
);

const IconCases = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
  </svg>
);

const IconReport = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);

const IconTeam = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L4.21 7.1a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9.92 3.15V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconBell = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconMenu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const sortNotificationsLatestFirst = (items) => [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { openDocket } = useActiveDocket();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { firmSlug } = useParams();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState({ cases: [], users: [], tasks: [] });
  const [storageHealthStatus, setStorageHealthStatus] = useState('HEALTHY');
  const [workbasketCount, setWorkbasketCount] = useState('loading');
  const [worklistCount, setWorklistCount] = useState('loading');
  const [countsFetched, setCountsFetched] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);

  const profileDropdownRef = useRef(null);
  const notificationDropdownRef = useRef(null);
  const hasMountedRef = useRef(false);
  const seenNotificationIdsRef = useRef(new Set());

  const currentFirmSlug = firmSlug || user?.firmSlug;
  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const hasAdminAccess = user?.role === USER_ROLES.ADMIN || normalizedRole === 'PRIMARY_ADMIN';
  const workbasketNavLabel = 'Workbasket';
  const firmLabel = user?.firm?.name || currentFirmSlug || 'Firm';
  const firmType = typeof user?.firm?.type === 'string' ? user.firm.type.trim() : '';
  const configuredFirmLogoUrl = getFirmConfig()?.brandLogoUrl || '';
  const firmLogoUrl = typeof configuredFirmLogoUrl === 'string' ? configuredFirmLogoUrl.trim() : '';
  const firmInitials = firmLabel.substring(0, 2).toUpperCase();
  const reportsRoute = `${ROUTES.FIRM_BASE(currentFirmSlug)}/admin/reports`;
  const isMobileViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches;

  const handleSidebarToggle = () => {
    if (isMobileViewport) {
      setMobileSidebarOpen((value) => !value);
      return;
    }
    setSidebarCollapsed((value) => !value);
  };

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout({ preserveFirmSlug: !!currentFirmSlug });
    if (currentFirmSlug) {
      navigate(ROUTES.FIRM_LOGIN(currentFirmSlug), { state: { message: 'You have been signed out safely.', messageType: 'success' } });
    } else {
      navigate(ROUTES.SUPERADMIN_LOGIN, { state: { message: 'You have been signed out safely.', messageType: 'success' } });
    }
  };

  const isActive = (path) => location.pathname === path;
  const isActivePrefix = (prefix) => location.pathname.startsWith(prefix);

  const getUserInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
    }
    return user?.xID?.substring(0, 2)?.toUpperCase() || 'U';
  };

  // Close profile and notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setProfileDropdownOpen(false);
    setMobileSidebarOpen(false);
    setNotificationOpen(false);
  }, [location.pathname]);

  const runGlobalSearch = useCallback(async (term) => {
    try {
      setSearching(true);
      const [casesRes, usersRes, tasksRes] = await Promise.allSettled([
        api.get('/search', { params: { q: term } }),
        hasAdminAccess ? api.get('/auth/admin/users') : Promise.resolve({ data: { data: [] } }),
        api.get('/tasks'),
      ]);

      const cases = casesRes.status === 'fulfilled' ? (casesRes.value.data?.data || []) : [];
      const usersRaw = usersRes.status === 'fulfilled' ? (usersRes.value.data?.data || []) : [];
      const tasksRaw = tasksRes.status === 'fulfilled' ? (tasksRes.value.data?.data || []) : [];

      const needle = term.toLowerCase();
      const users = usersRaw.filter((u) =>
        [u.name, u.email, u.xID].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
      );
      const tasks = tasksRaw.filter((t) =>
        [t.title, t.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
      );

      setSearchResults({ cases, users, tasks });
    } finally {
      setSearching(false);
    }
  }, [hasAdminAccess]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults({ cases: [], users: [], tasks: [] });
      return;
    }

    const timer = setTimeout(() => {
      runGlobalSearch(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, runGlobalSearch]);

  const playNotificationTone = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
    const audioContext = new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1240, audioContext.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.22);
  }, []);

  useEffect(() => {
    const unreadIds = new Set(notificationItems.filter((item) => item.unread).map((item) => item.id));
    if (!hasMountedRef.current) {
      seenNotificationIdsRef.current = unreadIds;
      hasMountedRef.current = true;
      return;
    }
    const hasNewUnread = [...unreadIds].some((id) => !seenNotificationIdsRef.current.has(id));
    if (hasNewUnread) playNotificationTone();
    seenNotificationIdsRef.current = unreadIds;
  }, [notificationItems, playNotificationTone]);

  useEffect(() => {
    let cancelled = false;

    const normalizeNotification = (item) => ({
      id: item.id || item._id,
      eventType: String(item.type || '').toLowerCase(),
      category: String(item.type || '').replaceAll('_', ' '),
      title: item.title || 'New update',
      description: item.message || 'You received a new notification.',
      timestamp: item.createdAt || item.created_at || new Date().toISOString(),
      docketNumber: item.docketId || item.docket_id || null,
      unread: !(item.isRead ?? item.read),
      groupCount: Number(item.groupCount || 1),
    });

    const fetchNotifications = async () => {
      try {
        const response = await notificationsApi.getNotifications({ limit: 20 });
        const rows = Array.isArray(response?.data) ? response.data.map(normalizeNotification) : [];
        if (!cancelled) {
          setNotificationItems(sortNotificationsLatestFirst(rows));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[Layout] Failed to load notifications', error?.message || error);
        }
      }
    };

    void fetchNotifications();
    const pollId = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);


  useEffect(() => {
    let cancelled = false;
    const COUNT_FETCH_TIMEOUT_MS = 8000;
    const shouldSkipWorklistCountFetch = location.pathname.includes('/admin');

    const withTimeout = (promise, fallbackValue) => Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => resolve(fallbackValue), COUNT_FETCH_TIMEOUT_MS);
      }),
    ]);

    const fetchCounts = async () => {
      if (!user) {
        if (!cancelled) {
          setWorkbasketCount(null);
          setWorklistCount(null);
          setCountsFetched(true);
        }
        return;
      }

      if (!cancelled) {
        setWorkbasketCount('loading');
        setWorklistCount('loading');
      }

      if (shouldSkipWorklistCountFetch) {
        if (!cancelled) {
          setWorkbasketCount(0);
          setWorklistCount(0);
          setCountsFetched(true);
        }
        return;
      }

      try {
        const [globalResult, myResult] = await Promise.allSettled([
          withTimeout(worklistApi.getGlobalWorklist({ limit: 1 }), null),
          withTimeout(worklistApi.getEmployeeWorklist({ limit: 1 }), null),
        ]);

        if (!cancelled) {
          const globalData = globalResult.status === 'fulfilled' ? globalResult.value : null;
          const myData = myResult.status === 'fulfilled' ? myResult.value : null;

          setWorkbasketCount(globalData?.meta?.total ?? globalData?.data?.length ?? 0);
          setWorklistCount(myData?.meta?.total ?? myData?.data?.length ?? 0);
          setCountsFetched(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[Layout] Failed to fetch worklist counts', error);
          setWorkbasketCount(0);
          setWorklistCount(0);
          setCountsFetched(true);
        }
      }
    };

    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);
  useEffect(() => {
    let cancelled = false;
    const fetchStorageHealth = async () => {
      if (!user) {
        return;
      }

      try {
        const response = await api.get('/storage/health');
        if (!cancelled) {
          setStorageHealthStatus(response?.data?.status || 'HEALTHY');
        }
      } catch (error) {
        console.warn('[StorageHealthBanner] Failed to fetch storage health', { message: error.message });
        if (!cancelled) {
          setStorageHealthStatus('HEALTHY');
        }
      }
    };
    fetchStorageHealth();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const preloadHighTrafficRoutes = () => {
      import('../../pages/CasesPage');
      import('../../pages/CaseDetailPage');
      import('../../pages/CreateCasePage');
      import('../../pages/reports/ReportsDashboard');
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadHighTrafficRoutes, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(preloadHighTrafficRoutes, 300);
    return () => clearTimeout(timeoutId);
  }, []);

  const navSections = [
    {
      id: 'core-work',
      title: 'CORE WORK',
      sticky: true,
      defaultOpen: true,
      collapsible: false,
      items: [
        {
          to: ROUTES.DASHBOARD(currentFirmSlug),
          label: 'Dashboard',
          icon: <IconDashboard />,
          active: isActive(ROUTES.DASHBOARD(currentFirmSlug)),
        },
        {
          to: ROUTES.GLOBAL_WORKLIST(currentFirmSlug),
          label: workbasketNavLabel,
          icon: <IconWorkbasket />,
          active: isActive(ROUTES.GLOBAL_WORKLIST(currentFirmSlug)),
          badge: countsFetched ? workbasketCount : 'loading',
        },
        {
          to: ROUTES.WORKLIST(currentFirmSlug),
          label: 'My WL',
          icon: <IconWorklist />,
          active: isActive(ROUTES.WORKLIST(currentFirmSlug)) || isActive(ROUTES.MY_WORKLIST(currentFirmSlug)),
          badge: countsFetched ? worklistCount : 'loading',
        },
        {
          to: `${ROUTES.CASES(currentFirmSlug)}?status=QC_PENDING`,
          label: 'QC Queue',
          icon: <IconAdmin />,
          active: location.pathname === ROUTES.CASES(currentFirmSlug) && new URLSearchParams(location.search).get('status') === 'QC_PENDING',
          hidden: !hasAdminAccess,
        },
        {
          to: `${ROUTES.CASES(currentFirmSlug)}?status=RESOLVED`,
          label: 'Resolved',
          icon: <IconWorklist />,
          active: location.pathname === ROUTES.CASES(currentFirmSlug) && new URLSearchParams(location.search).get('status') === 'RESOLVED',
        },
        {
          to: `${ROUTES.CASES(currentFirmSlug)}?status=FILED`,
          label: 'Filed',
          icon: <IconWorklist />,
          active: location.pathname === ROUTES.CASES(currentFirmSlug) && new URLSearchParams(location.search).get('status') === 'FILED',
        },
      ].filter((item) => !item.hidden),
    },
    {
      id: 'cases-clients',
      title: 'CLIENTS',
      defaultOpen: true,
      hidden: !hasAdminAccess,
      items: [
        { to: ROUTES.FIRM_BASE(currentFirmSlug) + '/clients', label: 'All Clients', icon: <IconCases />, active: isActivePrefix(ROUTES.FIRM_BASE(currentFirmSlug) + '/clients') },
        { to: ROUTES.COMPLIANCE_CALENDAR(currentFirmSlug), label: 'Compliance Calendar', icon: <IconWorklist />, active: isActive(ROUTES.COMPLIANCE_CALENDAR(currentFirmSlug)) },
      ],
    },
    {
      id: 'insights',
      title: 'INSIGHTS',
      defaultOpen: false,
      items: [
        { to: reportsRoute, label: 'Reports', icon: <IconReport />, active: isActivePrefix(reportsRoute) },
      ],
    },
    {
      id: 'admin',
      title: 'ADMIN',
      defaultOpen: false,
      hidden: !hasAdminAccess,
      items: [
        { to: ROUTES.ADMIN(currentFirmSlug), label: 'Team Management', icon: <IconTeam />, active: isActivePrefix(ROUTES.ADMIN(currentFirmSlug)) && !isActivePrefix(reportsRoute) },
        { to: ROUTES.HIERARCHY(currentFirmSlug), label: 'Hierarchy', icon: <IconTeam />, active: isActivePrefix(ROUTES.HIERARCHY(currentFirmSlug)) },
        { to: ROUTES.FIRM_SETTINGS(currentFirmSlug), label: 'Firm Settings', icon: <IconAdmin />, active: isActivePrefix(ROUTES.FIRM_SETTINGS(currentFirmSlug)) },
        { to: ROUTES.WORK_SETTINGS(currentFirmSlug), label: 'Work Settings', icon: <IconWorklist />, active: isActivePrefix(ROUTES.WORK_SETTINGS(currentFirmSlug)) },
        { to: ROUTES.STORAGE_SETTINGS(currentFirmSlug), label: 'Storage Settings', icon: <IconAdmin />, active: isActivePrefix(ROUTES.STORAGE_SETTINGS(currentFirmSlug)) },
        { to: ROUTES.AI_SETTINGS(currentFirmSlug), label: 'AI Settings', icon: <IconAdmin />, active: isActivePrefix(ROUTES.AI_SETTINGS(currentFirmSlug)) },
      ],
    },
    {
      id: 'account',
      title: 'ACCOUNT',
      defaultOpen: false,
      items: [
        { to: ROUTES.PROFILE(currentFirmSlug), label: hasAdminAccess ? 'Profile' : 'My Settings', icon: <IconSettings />, active: isActivePrefix(ROUTES.PROFILE(currentFirmSlug)) },
      ],
    },
  ].filter((section) => !section.hidden);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((isOpen) => !isOpen);
  }, []);


  const unreadCount = notificationItems.filter((item) => item.unread).length;
  const clearNotification = (id) => setNotificationItems((items) => items.filter((item) => item.id !== id));
  const markNotificationRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
    } catch (error) {
      console.warn('[Layout] Failed to mark notification as read', error?.message || error);
    }
    setNotificationItems((items) => items.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  };
  const markAllRead = () => setNotificationItems((items) => items.map((item) => ({ ...item, unread: false })));

  const commandPaletteCommands = [
    { id: 'new-docket', label: 'New Docket', shortcut: '⌘N', action: () => navigate(ROUTES.CREATE_CASE(currentFirmSlug)) },
    { id: 'workbasket', label: 'Go to Workbasket', shortcut: '⌘1', action: () => navigate(ROUTES.GLOBAL_WORKLIST(currentFirmSlug)) },
    { id: 'worklist', label: 'Go to My Worklist', shortcut: '⌘2', action: () => navigate(ROUTES.WORKLIST(currentFirmSlug)) },
    { id: 'dashboard', label: 'Go to Dashboard', shortcut: '⌘D', action: () => navigate(ROUTES.DASHBOARD(currentFirmSlug)) },
  ];

  return (
    <div className="enterprise-layout">
      <a className="enterprise-skip-link" href="#main-content">
        Skip to main content
      </a>
      {/* Sidebar */}
      <aside
        className={[
          'enterprise-sidebar',
          sidebarCollapsed ? 'enterprise-sidebar--collapsed' : '',
          mobileSidebarOpen ? 'enterprise-sidebar--mobile-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Main navigation"
      >
        {/* Firm Badge */}
        <div className="enterprise-sidebar__firm">
          <div className="enterprise-sidebar__firm-icon" aria-hidden="true">
            <span className="enterprise-sidebar__firm-icon-text">{firmInitials}</span>
            {firmLogoUrl ? (
              <img
                src={firmLogoUrl}
                alt=""
                className="enterprise-sidebar__firm-logo-image"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
          </div>
          <div className="enterprise-sidebar__firm-info">
            <div className="enterprise-sidebar__firm-name" title={firmLabel}>
              {firmLabel}
            </div>
            {firmType ? <div className="enterprise-sidebar__firm-label">{firmType}</div> : null}
          </div>
        </div>

        {/* Navigation */}
        <nav className="enterprise-sidebar__nav" aria-label="Firm operations navigation">
          {navSections.map((section) => (
            <SidebarSection
              key={section.id}
              title={section.title}
              items={section.items}
              sticky={section.sticky}
              defaultOpen={section.defaultOpen}
              collapsible={section.collapsible}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="enterprise-sidebar__footer">
          <button
            type="button"
            className="enterprise-sidebar__footer-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="enterprise-sidebar__footer-toggle-icon" aria-hidden="true">
              {sidebarCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
            </span>
            <span className="enterprise-sidebar__footer-toggle-label">
              {sidebarCollapsed ? 'Expand' : 'Collapse'}
            </span>
          </button>
          {currentFirmSlug ? (
            <Link
              to={safeRoute(ROUTES.UPDATES(currentFirmSlug), ROUTES.DASHBOARD(currentFirmSlug))}
              className="enterprise-sidebar__version"
            >
              {`${APP_NAME} v${APP_VERSION}`}
            </Link>
          ) : (
            <div className="enterprise-sidebar__version">{`${APP_NAME} v${APP_VERSION}`}</div>
          )}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="enterprise-sidebar-overlay enterprise-sidebar-overlay--visible"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div
        className={`enterprise-main ${sidebarCollapsed ? 'enterprise-main--sidebar-collapsed' : ''}`}
      >
        {storageHealthStatus !== 'HEALTHY' && (
          <div className="enterprise-storage-health-banner" role="alert" aria-live="polite">
            Storage issue detected. Some files may be inaccessible.
          </div>
        )}
        {/* Omnibar Header */}
        <header className="enterprise-header" role="banner">
          {/* Mobile sidebar toggle */}
          <button
            className="enterprise-header__sidebar-toggle"
            onClick={handleSidebarToggle}
            aria-label={isMobileViewport ? 'Toggle sidebar' : (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
            aria-expanded={isMobileViewport ? mobileSidebarOpen : !sidebarCollapsed}
          >
            <IconMenu />
          </button>

          {/* Omnibar search */}
          <div className="enterprise-header__omnibar" role="search">
            <span className="enterprise-header__omnibar-icon" aria-hidden="true">
              <IconSearch />
            </span>
            <input
              className="enterprise-header__omnibar-input"
              type="search"
              placeholder="Search clients, dockets, documents..."
              aria-label="Search clients, dockets, documents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setCommandPaletteOpen(true)}
            />
            <kbd className="enterprise-header__omnibar-shortcut" aria-hidden="true">⌘K</kbd>
            {(searchQuery.trim().length >= 2 || searching) && (
              <div className="dropdown-menu" style={{ display: 'block', top: 'calc(100% + 8px)', width: '100%' }}>
                <div className="dropdown-item" style={{ pointerEvents: 'none', opacity: 0.7 }}>
                  {searching ? 'Searching…' : `Dockets ${searchResults.cases.length} · Users ${searchResults.users.length} · Compliance Items ${searchResults.tasks.length}`}
                </div>
                {searchResults.cases.slice(0, 3).map((item) => (
                  <button
                    key={`case-${item.caseId}`}
                    className="dropdown-item"
                    onClick={() => openDocket({ caseId: item.caseId, navigate, to: safeRoute(ROUTES.CASE_DETAIL(currentFirmSlug, item.caseId), ROUTES.CASES(currentFirmSlug)) })}
                  >
                    Docket: {item.caseId} — {item.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create Docket CTA */}
          <button
            className="btn btn-primary enterprise-header__new-case"
            onClick={() => navigate(safeRoute(ROUTES.CREATE_CASE(currentFirmSlug), ROUTES.CASES(currentFirmSlug)))}
            aria-label="Create new docket"
          >
            <IconPlus />
            <span>New Docket</span>
          </button>

          {/* Right actions */}
          <div className="enterprise-header__right">
            {/* Notification Bell */}
            <div className="dropdown" ref={notificationDropdownRef}>
              <button
                className="enterprise-header__icon-btn"
                aria-label="Notifications"
                aria-expanded={notificationOpen}
                aria-haspopup="menu"
                onClick={() => setNotificationOpen((v) => !v)}
              >
                <IconBell />
                {unreadCount > 0 ? <span className="enterprise-header__notif-dot" aria-hidden="true">{unreadCount}</span> : null}
              </button>
              {notificationOpen ? (
                <div className="dropdown-menu dropdown-menu-right enterprise-header__notification-menu" role="menu">
                  <div className="enterprise-header__notification-header">
                    <span>Notifications</span>
                    <span className="enterprise-header__notification-count">{unreadCount} unread</span>
                  </div>
                  <div className="enterprise-header__notification-section-actions">
                    <button type="button" className="enterprise-header__notification-text-btn" onClick={markAllRead}>Mark all read</button>
                    {currentFirmSlug ? (
                      <button
                        type="button"
                        className="enterprise-header__notification-text-btn"
                        onClick={() => {
                          setNotificationOpen(false);
                          navigate(safeRoute(ROUTES.NOTIFICATIONS_HISTORY(currentFirmSlug), ROUTES.DASHBOARD(currentFirmSlug)));
                        }}
                      >
                        View all notifications
                      </button>
                    ) : null}
                  </div>
                  <div className="enterprise-header__notification-list" role="presentation">
                    {notificationItems.length === 0 ? (
                      <div className="enterprise-header__notification-empty">No notifications</div>
                    ) : (
                      notificationItems.map((item) => (
                        <div key={item.id} className={`dropdown-item enterprise-header__notification-item ${item.unread ? 'enterprise-header__notification-item--unread' : ''}`} role="menuitem">
                          <div className="enterprise-header__notification-title-row">
                            <span className="enterprise-header__notification-title">{item.title}</span>
                            <div className="enterprise-header__notification-actions">
                              <button
                                type="button"
                                className="enterprise-header__notification-action-btn"
                                aria-label="Mark notification as read"
                                title="Mark as read"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void markNotificationRead(item.id);
                                }}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                className="enterprise-header__notification-action-btn"
                                aria-label="Clear notification"
                                title="Clear"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  clearNotification(item.id);
                                }}
                              >
                                ✕
                              </button>
                              {item.unread ? <span className="enterprise-header__notification-unread-badge">New</span> : null}
                            </div>
                          </div>
                          <div className="enterprise-header__notification-description">
                            {item.description}
                            {item.groupCount > 1 ? ` (${item.groupCount} updates)` : ''}
                          </div>
                          <div className="enterprise-header__notification-meta">
                            <span>{item.category}</span>
                            <span>{formatDateTime(item.timestamp)}</span>
                          </div>
                          {item.docketNumber && currentFirmSlug ? (
                            <Link
                              to={safeRoute(ROUTES.CASE_DETAIL(currentFirmSlug, item.docketNumber), ROUTES.CASES(currentFirmSlug))}
                              className="enterprise-header__notification-link"
                              onClick={() => { void markNotificationRead(item.id); setNotificationOpen(false); }}
                            >
                              Open docket #{item.docketNumber}
                            </Link>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* User Profile Dropdown */}
            <div className="dropdown" ref={profileDropdownRef}>
              <button
                className="enterprise-header__profile"
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
              >
                <div className="enterprise-header__user-avatar" aria-hidden="true">{getUserInitials()}</div>
                <span className="enterprise-header__user-name">{user?.name || user?.xID}</span>
                <IconChevronDown />
              </button>
              {profileDropdownOpen && (
                <div className="dropdown-menu dropdown-menu-right" role="menu">
                  <Link
                    to={ROUTES.PROFILE(currentFirmSlug)}
                    className="dropdown-item"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button className="dropdown-item" role="menuitem" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="enterprise-content" id="main-content">{children}</main>
      </div>
      <ErrorBoundary name="CommandPalette" fallback={null}>
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onToggle={toggleCommandPalette}
          commands={commandPaletteCommands}
        />
      </ErrorBoundary>
    </div>
  );
};
