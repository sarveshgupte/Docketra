import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const role = String(user?.role || 'USER').toUpperCase();
  const navSections = useMemo(() => navForRole(firmSlug, role), [firmSlug, role]);

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
            <button type="button" onClick={() => setDark((value) => !value)}>{dark ? 'Light' : 'Dark'}</button>
            <button type="button" onClick={() => navigate(ROUTES.CASES(firmSlug))}>All Dockets</button>
          </div>
        </header>
        <main className="platform__content">{children}</main>
      </div>
    </div>
  );
};
