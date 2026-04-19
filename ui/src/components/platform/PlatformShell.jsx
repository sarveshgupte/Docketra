import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import './platform.css';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const navForRole = (firmSlug, role) => {
  const all = [
    {
      section: 'Core',
      items: [
        { to: ROUTES.DASHBOARD(firmSlug), label: 'Dashboard' },
        { to: ROUTES.CMS(firmSlug), label: 'CMS', minRole: 'ADMIN' },
        { to: ROUTES.CRM(firmSlug), label: 'CRM', minRole: 'ADMIN' },
        { to: ROUTES.TASK_MANAGER(firmSlug), label: 'Tasks' },
      ],
    },
    {
      section: 'Operations',
      items: [
        { to: ROUTES.CLIENTS(firmSlug), label: 'Clients', minRole: 'ADMIN' },
        { to: ROUTES.ADMIN(firmSlug), label: 'Team', minRole: 'ADMIN' },
        { to: ROUTES.ADMIN_REPORTS(firmSlug), label: 'Reports', minRole: 'ADMIN' },
      ],
    },
    {
      section: 'Administration',
      items: [
        { to: ROUTES.SETTINGS(firmSlug), label: 'Settings', minRole: 'ADMIN' },
      ],
    },
  ];

  return all
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.minRole || hasAtLeastRole(role, item.minRole)) }))
    .filter((section) => section.items.length > 0);
};

export const PlatformShell = ({ moduleLabel, title, subtitle, actions, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user, logout } = useAuth();
  const menuRef = useRef(null);
  const role = String(user?.role || 'USER').toUpperCase();
  const navSections = useMemo(() => navForRole(firmSlug, role), [firmSlug, role]);
  const userName = user?.name || user?.xID || 'User';
  const currentNavItem = useMemo(
    () => navSections.flatMap((section) => section.items).find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)),
    [navSections, pathname]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolvedTitle = title || currentNavItem?.label || 'Workspace';
    document.title = `${resolvedTitle} • Docketra`;
  }, [title, currentNavItem]);

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
  }, [pathname]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout({ preserveFirmSlug: !!firmSlug });
    if (firmSlug) {
      navigate(ROUTES.FIRM_LOGIN(firmSlug), { replace: true, state: { message: 'You have been signed out safely.', messageType: 'success' } });
      return;
    }
    navigate('/superadmin/login', { replace: true });
  };

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
                  className={`platform__nav-link ${pathname === item.to || pathname.startsWith(`${item.to}/`) ? 'is-active' : ''}`}
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
          <div>
            {moduleLabel ? <span className="platform__module-label">{moduleLabel}</span> : null}
            <h1>{title}</h1>
            <p>{subtitle || 'Use the sidebar to move between modules and continue your workflow.'}</p>
            <div className="platform__breadcrumbs" aria-label="Breadcrumb">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <span>{currentNavItem?.label || title}</span>
            </div>
          </div>
          <div className="platform__actions">
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
    </div>
  );
};
