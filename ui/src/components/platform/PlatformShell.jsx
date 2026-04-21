import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { CommandPalette } from '../common/CommandPalette';
import api from '../../services/api';
import { crmApi } from '../../api/crm.api';
import { isShortcutAllowedTarget } from '../../utils/keyboardShortcuts';
import { isNavItemActive } from '../../utils/navActive';
import './platform.css';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const navForRole = (firmSlug, role) => {
  const all = [
    {
      section: 'Daily Operations',
      items: [
        { to: ROUTES.TASK_MANAGER(firmSlug), label: 'Docket Workbench' },
        { to: ROUTES.DASHBOARD(firmSlug), label: 'Dashboard' },
      ],
    },
    {
      section: 'Business Modules',
      items: [
        { to: ROUTES.CMS(firmSlug), label: 'Intake (CMS)', minRole: 'ADMIN' },
        { to: ROUTES.CRM(firmSlug), label: 'Pipeline (CRM)', minRole: 'ADMIN' },
        { to: ROUTES.CLIENTS(firmSlug), label: 'Clients', minRole: 'ADMIN' },
      ],
    },
    {
      section: 'Oversight',
      items: [
        { to: ROUTES.ADMIN_REPORTS(firmSlug), label: 'Reports', minRole: 'ADMIN', activeMatch: 'exactOrDescendant' },
      ],
    },
    {
      section: 'Administration',
      items: [
        {
          to: ROUTES.ADMIN(firmSlug),
          label: 'Team & Access',
          minRole: 'ADMIN',
          activeMatch: 'exactOrDescendant',
          excludeActiveFor: [ROUTES.ADMIN_REPORTS(firmSlug)],
        },
        { to: ROUTES.SETTINGS(firmSlug), label: 'Settings', minRole: 'ADMIN', activeMatch: 'exactOrDescendant' },
      ],
    },
  ];

  return all
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.minRole || hasAtLeastRole(role, item.minRole)) }))
    .filter((section) => section.items.length > 0);
};

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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user, logout } = useAuth();
  const menuRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const role = String(user?.role || 'USER').toUpperCase();
  const navSections = useMemo(() => navForRole(firmSlug, role), [firmSlug, role]);
  const userName = user?.name || user?.xID || 'User';
  const hasAdminAccess = hasAtLeastRole(role, 'ADMIN');
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
    await logout({ preserveFirmSlug: !!firmSlug });
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

    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const [docketRes, clientsRes] = await Promise.allSettled([
          api.get('/search', { params: { q: term } }),
          hasAdminAccess ? crmApi.listClients({ limit: 50 }) : Promise.resolve({ data: [] }),
        ]);

        const isStale = !commandPaletteOpen || requestId !== searchRequestIdRef.current || commandQuery.trim() !== term;
        if (isStale) return;

        const dockets = docketRes.status === 'fulfilled' ? docketRes.value?.data?.data || [] : [];
        const clientRows = clientsRes.status === 'fulfilled' ? normalizeClientRows(clientsRes.value) : [];
        const needle = term.toLowerCase();
        const clients = clientRows.filter((client) => (`${client.label} ${client.description}`).toLowerCase().includes(needle)).slice(0, 6);

        if (docketRes.status === 'rejected' || clientsRes.status === 'rejected') {
          setSearchError('Record search is temporarily unavailable. Commands and module jumps are still available.');
        }

        setSearchResults({ dockets: dockets.slice(0, 6), clients });
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
  }, [commandPaletteOpen, commandQuery, hasAdminAccess]);

  const commandSections = useMemo(() => {
    const navigationItems = [
      { id: 'go-dashboard', label: 'Go to Dashboard', shortcut: 'Alt+Shift+D', action: () => openRoute(ROUTES.DASHBOARD(firmSlug)), description: 'Open firm dashboard overview.' },
      { id: 'go-task-manager', label: 'Go to Docket Workbench', shortcut: 'Alt+Shift+T', action: () => openRoute(ROUTES.TASK_MANAGER(firmSlug)), description: 'Jump to the main docket execution workspace.' },
      { id: 'go-workbasket', label: 'Go to Workbench', shortcut: 'Alt+Shift+B', action: () => openRoute(ROUTES.GLOBAL_WORKLIST(firmSlug)), description: 'Open shared queue dockets available to pull.' },
      { id: 'go-worklist', label: 'Go to My Worklist', shortcut: 'Alt+Shift+W', action: () => openRoute(ROUTES.WORKLIST(firmSlug)), description: 'Open your active and pended docket workload.' },
      { id: 'go-qc', label: 'Go to QC Workbench', shortcut: 'Alt+Shift+Q', action: () => openRoute(ROUTES.QC_QUEUE(firmSlug)), description: 'Open dockets waiting for quality review decisions.' },
      { id: 'go-clients', label: 'Go to Clients', action: () => openRoute(ROUTES.CLIENTS(firmSlug)), description: 'Open client management workspace.', adminOnly: true },
      { id: 'go-crm', label: 'Go to CRM', action: () => openRoute(ROUTES.CRM(firmSlug)), description: 'Open relationship management module.', adminOnly: true },
      { id: 'go-cms', label: 'Go to CMS', action: () => openRoute(ROUTES.CMS(firmSlug)), description: 'Open intake and submissions module.', adminOnly: true },
      { id: 'go-reports', label: 'Go to Reports', action: () => openRoute(ROUTES.ADMIN_REPORTS(firmSlug)), description: 'Open operational reports.', adminOnly: true },
      { id: 'go-team', label: 'Go to Team', action: () => openRoute(ROUTES.ADMIN(firmSlug)), description: 'Open team management.', adminOnly: true },
      { id: 'go-settings', label: 'Go to Settings', action: () => openRoute(ROUTES.SETTINGS(firmSlug)), description: 'Open workspace settings.', adminOnly: true },
    ].filter((item) => !item.adminOnly || hasAdminAccess);

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
  }, [firmSlug, hasAdminAccess, openRoute, searchResults]);

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

      const shortcuts = {
        n: () => openRoute(ROUTES.CREATE_CASE(firmSlug)),
        d: () => openRoute(ROUTES.DASHBOARD(firmSlug)),
        t: () => openRoute(ROUTES.TASK_MANAGER(firmSlug)),
        w: () => openRoute(ROUTES.WORKLIST(firmSlug)),
        b: () => openRoute(ROUTES.GLOBAL_WORKLIST(firmSlug)),
        q: () => openRoute(ROUTES.QC_QUEUE(firmSlug)),
      };

      const action = shortcuts[key];
      if (!action) return;

      event.preventDefault();
      action();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeCommandPalette, commandPaletteOpen, firmSlug, openRoute, resetCommandCenterState]);

  const shortcutHint = 'Shortcuts: Ctrl/⌘+K open, / quick open, Alt+Shift+N new docket, Alt+Shift+D dashboard';

  return (
    <div className="platform">
      <a href="#platform-main" className="platform__skip-link">Skip to content</a>
      <aside className={`platform__sidebar ${collapsed ? 'platform__sidebar--collapsed' : ''}`} aria-label="Primary navigation">
        <div className="platform__brand">
          <button
            type="button"
            className="platform__collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
          {!collapsed && (
            <div>
              <strong>Docketra</strong>
              <p>Operations workspace</p>
            </div>
          )}
        </div>

        <nav className="platform__nav">
          {navSections.map((section) => (
            <div key={section.section} className="platform__nav-section">
              {!collapsed && <span className="platform__section-title">{section.section}</span>}
              {section.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`platform__nav-link ${isNavItemActive(pathname, item) ? 'is-active' : ''}`}
                  title={item.label}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="platform__main">
        <header className="platform__topbar">
          <div className="platform__title-block">
            {moduleLabel ? <span className="platform__module-label">{moduleLabel}</span> : null}
            <h1>{title}</h1>
            <p>{subtitle || 'Use the sidebar to move between modules and continue your workflow.'}</p>
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
                <span>{userName}</span>
                <span className="platform__user-pill-chevron" aria-hidden="true">▾</span>
              </button>
              {menuOpen ? (
                <div className="platform__account-dropdown" role="menu" aria-label="Account menu">
                  <button type="button" role="menuitem" onClick={handleLogout}>Sign out</button>
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
