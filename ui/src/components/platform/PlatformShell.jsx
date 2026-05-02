import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { getPlatformDestinationCommands, getPlatformNavigation, PLATFORM_SHORTCUT_ROUTES } from '../../constants/platformNavigation';
import { CommandPalette } from '../common/CommandPalette';
import api from '../../services/api';
import { crmApi } from '../../api/crm.api';
import { isShortcutAllowedTarget } from '../../utils/keyboardShortcuts';
import { isNavItemActive } from '../../utils/navActive';
import { trackAsync } from '../../utils/performanceMonitor';
import './platform.css';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const normalizeClientRows = (payload) => {
  const rows = Array.isArray(payload?.data?.data)
    ? payload.data.data
    : Array.isArray(payload?.data?.items)
      ? payload.data.items
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return rows
    .map((client) => {
      const routeId = client?._id || client?.id || client?.crmClientId || client?.clientId;
      return {
        routeId,
        label: client?.businessName || client?.name || 'Client record',
        description: client?.businessEmail || client?.email || 'Open CRM client detail',
      };
    })
    .filter((client) => Boolean(client.routeId));
};

export const PlatformShell = ({ moduleLabel, title, subtitle, actions, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState({ dockets: [], clients: [] });
  const [clientDirectory, setClientDirectory] = useState([]);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user, logout } = useAuth();
  const menuRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const searchCacheRef = useRef(new Map());
  const role = String(user?.role || 'USER').toUpperCase();
  const hasAdminAccess = hasAtLeastRole(role, 'ADMIN');
  const hasQcQueueAccess = hasAdminAccess || (Array.isArray(user?.qcWorkbaskets) && user.qcWorkbaskets.length > 0);
  const navSections = useMemo(() => getPlatformNavigation(firmSlug, role), [firmSlug, role]);
  const userName = user?.name || user?.xID || 'User';
  const currentNavItem = useMemo(
    () => navSections.flatMap((section) => section.items).find((item) => isNavItemActive(pathname, item)),
    [navSections, pathname]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolvedTitle = title || currentNavItem?.label || 'Workspace';
    document.title = `${resolvedTitle} • Docketra`;
  }, [title, currentNavItem]);

  const resetCommandCenterState = useCallback(() => {
    searchRequestIdRef.current += 1;
    setCommandQuery('');
    setSearchError('');
    setSearching(false);
    setSearchResults({ dockets: [], clients: [] });
  }, []);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
    resetCommandCenterState();
  }, [resetCommandCenterState]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    closeCommandPalette();
  }, [pathname, closeCommandPalette]);

  const handleLogout = async () => {
    setMenuOpen(false);
    closeCommandPalette();
    const preserveFirmSlug = !(user?.isSuperAdmin || user?.role === 'SuperAdmin') && !!firmSlug;
    await logout({ preserveFirmSlug });
    if (firmSlug) {
      navigate(ROUTES.FIRM_LOGIN(firmSlug), { replace: true, state: { message: 'You have been signed out safely.', messageType: 'success' } });
      return;
    }
    navigate('/superadmin/login', { replace: true });
  };

  const openRoute = useCallback((route) => {
    closeCommandPalette();
    navigate(route);
  }, [closeCommandPalette, navigate]);

  useEffect(() => {
    if (!commandPaletteOpen) {
      setSearching(false);
      setSearchError('');
      setSearchResults({ dockets: [], clients: [] });
      return;
    }

    const term = commandQuery.trim();
    if (term.length < 2) {
      setSearching(false);
      setSearchError('');
      setSearchResults({ dockets: [], clients: [] });
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const cacheKey = term.toLowerCase();
    const cachedResults = searchCacheRef.current.get(cacheKey);
    if (cachedResults) {
      setSearching(false);
      setSearchError('');
      setSearchResults(cachedResults);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const [docketRes, clientsRes] = await Promise.allSettled([
          trackAsync('command-center.search.dockets', `command-center:dockets:${cacheKey}`, () => api.get('/search', { params: { q: term } })),
          hasAdminAccess && clientDirectory.length === 0
            ? trackAsync('command-center.search.clients.initial-load', 'command-center:clients', () => crmApi.listClients({ limit: 50 }))
            : Promise.resolve({ data: [] }),
        ]);

        const isStale = !commandPaletteOpen || requestId !== searchRequestIdRef.current || commandQuery.trim() !== term;
        if (isStale) return;

        const dockets = docketRes.status === 'fulfilled' ? docketRes.value?.data?.data || [] : [];
        const freshClientDirectory = clientsRes.status === 'fulfilled' ? normalizeClientRows(clientsRes.value) : clientDirectory;
        if (clientsRes.status === 'fulfilled' && freshClientDirectory.length > 0) {
          setClientDirectory(freshClientDirectory);
        }
        const clientRows = freshClientDirectory;
        const needle = term.toLowerCase();
        const clients = clientRows.filter((client) => (`${client.label} ${client.description}`).toLowerCase().includes(needle)).slice(0, 6);

        if (docketRes.status === 'rejected' || clientsRes.status === 'rejected') {
          setSearchError('Record search is temporarily unavailable. Commands and module jumps are still available.');
        }

        const nextResults = { dockets: dockets.slice(0, 6), clients };
        setSearchResults(nextResults);
        searchCacheRef.current.set(cacheKey, nextResults);
      } catch {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchError('Record search is temporarily unavailable. Commands and module jumps are still available.');
        setSearchResults({ dockets: [], clients: [] });
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearching(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [commandPaletteOpen, commandQuery, hasAdminAccess, clientDirectory]);

  const commandSections = useMemo(() => {
    const navigationItems = [
      ...getPlatformDestinationCommands(firmSlug, role).map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        shortcut: item.shortcut,
        action: () => openRoute(item.to),
      })),
      ...(hasAdminAccess ? [{ id: 'go-workbasket', label: 'Go to Workbench', shortcut: 'Alt+Shift+B', action: () => openRoute(ROUTES.GLOBAL_WORKLIST(firmSlug)), description: 'Open shared queue dockets available to pull.' }] : []),
      { id: 'go-worklist', label: 'Go to My Worklist', shortcut: 'Alt+Shift+W', action: () => openRoute(ROUTES.WORKLIST(firmSlug)), description: 'Open your active and pended docket workload.' },
      ...(hasQcQueueAccess ? [{ id: 'go-qc', label: 'Go to QC Workbench', shortcut: 'Alt+Shift+Q', action: () => openRoute(ROUTES.QC_QUEUE(firmSlug)), description: 'Open dockets waiting for quality review decisions.' }] : []),
    ];

    const actionsItems = [
      { id: 'new-docket', label: 'New Docket', shortcut: 'Alt+Shift+N', action: () => openRoute(ROUTES.CREATE_CASE(firmSlug)), description: 'Create a docket quickly.' },
      { id: 'open-profile', label: 'Open Profile', action: () => openRoute(ROUTES.PROFILE(firmSlug)), description: 'Open personal profile and preferences.' },
      { id: 'sign-out', label: 'Sign out', action: () => { void handleLogout(); }, description: 'Sign out from current firm workspace.' },
    ];

    const docketItems = searchResults.dockets.map((docket) => ({
      id: `docket-${docket.caseId}`,
      label: `Docket ${docket.caseId}`,
      description: docket.title || 'Open docket detail',
      action: () => openRoute(ROUTES.CASE_DETAIL(firmSlug, docket.caseId)),
    }));

    const clientItems = searchResults.clients.map((client) => ({
      id: `client-${client.routeId}`,
      label: client.label,
      description: client.description,
      action: () => openRoute(ROUTES.CRM_CLIENT_DETAIL(firmSlug, client.routeId)),
    }));

    const sections = [
      { id: 'actions', label: 'Quick actions', items: actionsItems },
      { id: 'destinations', label: 'Module destinations', items: navigationItems },
    ];

    if (docketItems.length) sections.push({ id: 'dockets', label: 'Docket results', items: docketItems });
    if (clientItems.length) sections.push({ id: 'clients', label: 'Client results', items: clientItems });

    return sections;
  }, [firmSlug, role, openRoute, searchResults, hasAdminAccess, hasQcQueueAccess]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const modifierPressed = event.metaKey || event.ctrlKey;

      if (modifierPressed && key === 'k') {
        if (!isShortcutAllowedTarget(event.target)) return;
        event.preventDefault();
        setCommandPaletteOpen((open) => {
          if (open) {
            resetCommandCenterState();
            return false;
          }
          return true;
        });
        return;
      }

      if (event.key === 'Escape' && commandPaletteOpen) {
        event.preventDefault();
        closeCommandPalette();
        return;
      }

      if (!isShortcutAllowedTarget(event.target)) return;

      if (key === '/' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (!(event.altKey && event.shiftKey)) return;

      const shortcutFactory = PLATFORM_SHORTCUT_ROUTES[key];
      const action = shortcutFactory ? () => openRoute(shortcutFactory(firmSlug)) : null;
      if (!action) return;

      event.preventDefault();
      action();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeCommandPalette, commandPaletteOpen, firmSlug, openRoute, resetCommandCenterState]);

  const shortcutHint = 'Shortcuts: Ctrl/⌘+K open, / quick open, Alt+Shift+N new docket, Alt+Shift+D dashboard';

  const firmLabel = user?.firm?.name || firmSlug || 'Workspace';
  const firmInitials = firmLabel.substring(0, 2).toUpperCase();
  const userInitials = userName.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2) || userName.substring(0, 2).toUpperCase();

  return (
    <div className="platform">
      <a href="#platform-main" className="platform__skip-link">Skip to content</a>
      <aside className={`platform__sidebar ${collapsed ? 'platform__sidebar--collapsed' : ''}`} aria-label="Primary navigation">
        {/* Firm brand */}
        <div className="platform__brand">
          <div className="platform__firm-badge" aria-hidden="true" title={firmLabel}>
            {firmInitials}
          </div>
          {!collapsed && (
            <div className="platform__firm-info">
              <strong className="platform__firm-name" title={firmLabel}>{firmLabel}</strong>
              <span className="platform__firm-sub">Operations workspace</span>
            </div>
          )}
          <button
            type="button"
            className="platform__collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {collapsed
                ? <polyline points="9 18 15 12 9 6" />
                : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>
        </div>

        <nav className="platform__nav">
          {navSections.map((section) => (
            <div key={section.section} className="platform__nav-section">
              {!collapsed && <span className="platform__section-title">{section.section}</span>}
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`platform__nav-link ${isActive ? 'is-active' : ''}`}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span
                      className="platform__nav-link-icon"
                      aria-hidden="true"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                    />
                    {!collapsed && <span className="platform__nav-link-label">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="platform__main">
        <header className="platform__topbar">
          <div className="platform__title-block">
            {moduleLabel ? <span className="platform__module-label">{moduleLabel}</span> : null}
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
            <div className="platform__breadcrumbs" aria-label="Breadcrumb">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <span>{currentNavItem?.label || title}</span>
            </div>
          </div>
          <div className="platform__actions" role="toolbar" aria-label="Page actions">
            <button
              type="button"
              className="platform__command-trigger"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command center"
            >
              <span className="platform__command-trigger-label">Search dockets, clients, modules…</span>
              <kbd>Ctrl/⌘ K</kbd>
            </button>
            {actions}
            <div className="platform__account-menu" ref={menuRef}>
              <button
                type="button"
                className="platform__user-pill platform__user-pill--button"
                title={userName}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setMenuOpen(false);
                }}
              >
                <span className="platform__user-avatar" aria-hidden="true">{userInitials}</span>
                <span className="platform__user-name">{userName}</span>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {menuOpen ? (
                <div className="platform__account-dropdown" role="menu" aria-label="Account menu">
                  <Link
                    to={ROUTES.PROFILE(firmSlug)}
                    className="platform__account-dropdown-item"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button type="button" role="menuitem" className="platform__account-dropdown-item" onClick={handleLogout}>Sign out</button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main id="platform-main" className="platform__content">{children}</main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={closeCommandPalette}
        sections={commandSections}
        query={commandQuery}
        onQueryChange={setCommandQuery}
        queryPlaceholder="Search dockets, clients, queues, modules, and commands"
        helperText={searching ? 'Searching workspace records…' : (searchError || shortcutHint)}
      />
    </div>
  );
};
