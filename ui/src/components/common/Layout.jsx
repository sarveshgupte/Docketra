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
import { USER_ROLES } from '../../utils/constants';
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

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
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

  const profileDropdownRef = useRef(null);

  const currentFirmSlug = firmSlug || user?.firmSlug;
  const hasAdminAccess = user?.role === USER_ROLES.ADMIN;
  const firmLabel = user?.firm?.name || currentFirmSlug || 'Firm';
  const firmInitials = firmLabel.substring(0, 2).toUpperCase();

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout({ preserveFirmSlug: !!currentFirmSlug });
    showSuccess('You have been signed out safely.');
    if (currentFirmSlug) {
      navigate(ROUTES.FIRM_LOGIN(currentFirmSlug));
    } else {
      navigate(ROUTES.SUPERADMIN_LOGIN);
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

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setProfileDropdownOpen(false);
    setMobileSidebarOpen(false);
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


  useEffect(() => {
    let cancelled = false;

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

      try {
        const [globalData, myData] = await Promise.all([
          worklistApi.getGlobalWorklist({ limit: 1 }),
          worklistApi.getEmployeeWorklist({ limit: 1 }),
        ]);

        if (!cancelled) {
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
  }, [user]);
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

  const navSections = [
    {
      id: 'core-work',
      title: 'CORE WORK',
      sticky: true,
      defaultOpen: true,
      collapsible: false,
      items: [
        {
          to: ROUTES.GLOBAL_WORKLIST(currentFirmSlug),
          label: 'Workbasket',
          icon: <IconWorkbasket />,
          active: isActive(ROUTES.GLOBAL_WORKLIST(currentFirmSlug)),
          badge: countsFetched ? workbasketCount : 'loading',
        },
        {
          to: ROUTES.WORKLIST(currentFirmSlug),
          label: 'My Worklist',
          icon: <IconWorklist />,
          active: isActive(ROUTES.WORKLIST(currentFirmSlug)) || isActive(ROUTES.MY_WORKLIST(currentFirmSlug)),
          badge: countsFetched ? worklistCount : 'loading',
        },
        {
          to: ROUTES.DASHBOARD(currentFirmSlug),
          label: 'Dashboard',
          icon: <IconDashboard />,
          active: isActive(ROUTES.DASHBOARD(currentFirmSlug)),
        },
      ],
    },
    {
      id: 'cases-clients',
      title: 'CLIENTS',
      defaultOpen: true,
      hidden: !hasAdminAccess,
      items: [
        { to: ROUTES.FIRM_BASE(currentFirmSlug) + '/clients', label: 'All Clients', icon: <IconCases />, active: isActivePrefix(ROUTES.FIRM_BASE(currentFirmSlug) + '/clients') },
        { to: ROUTES.WORKLIST(currentFirmSlug), label: 'Compliance Calendar', icon: <IconWorklist />, active: false },
      ],
    },
    {
      id: 'insights',
      title: 'INSIGHTS',
      defaultOpen: false,
      items: [
        { to: ROUTES.CASES(currentFirmSlug), label: 'Firm Analytics', icon: <IconCases />, active: isActivePrefix(ROUTES.CASES(currentFirmSlug)) && !location.search.includes('view=audit') },
        { to: ROUTES.FIRM_BASE(currentFirmSlug) + '/admin/reports', label: 'Reports', icon: <IconReport />, active: isActivePrefix(ROUTES.FIRM_BASE(currentFirmSlug) + '/admin/reports') },
      ],
    },
    {
      id: 'admin',
      title: 'ADMIN',
      defaultOpen: false,
      hidden: !hasAdminAccess,
      items: [
        { to: ROUTES.ADMIN(currentFirmSlug), label: 'Team Management', icon: <IconTeam />, active: isActivePrefix(ROUTES.ADMIN(currentFirmSlug)) && !isActivePrefix(ROUTES.FIRM_BASE(currentFirmSlug) + '/admin/reports') },
        { to: `${ROUTES.CASES(currentFirmSlug)}?view=audit`, label: 'Audit Logs', icon: <IconReport />, active: isActive(ROUTES.CASES(currentFirmSlug)) && location.search.includes('view=audit') },
        { to: ROUTES.FIRM_SETTINGS(currentFirmSlug), label: 'Firm Settings', icon: <IconAdmin />, active: isActivePrefix(ROUTES.FIRM_SETTINGS(currentFirmSlug)) },
      ],
    },
  ].filter((section) => !section.hidden);

  const toggleCommandPalette = useCallback(() => {
    setCommandPaletteOpen((isOpen) => !isOpen);
  }, []);

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
          <div className="enterprise-sidebar__firm-icon" aria-hidden="true">{firmInitials}</div>
          <div className="enterprise-sidebar__firm-info">
            <div className="enterprise-sidebar__firm-name" title={firmLabel}>
              {firmLabel}
            </div>
            <div className="enterprise-sidebar__firm-label">Professional Firm</div>
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
          <div className="enterprise-sidebar__version">Docketra v1.0</div>
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
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            aria-label="Toggle sidebar"
            aria-expanded={mobileSidebarOpen}
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
                    onClick={() => navigate(safeRoute(ROUTES.CASE_DETAIL(currentFirmSlug, item.caseId), ROUTES.CASES(currentFirmSlug)))}
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
            <button className="enterprise-header__icon-btn" aria-label="Notifications" disabled title="Notifications are coming soon">
              <IconBell />
            </button>

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
