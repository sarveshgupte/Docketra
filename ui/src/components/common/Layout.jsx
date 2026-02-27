/**
 * Enterprise Sidebar Layout Component
 * Docketra B2B SaaS Platform - Indian Professional Firms
 * Sidebar + top header architecture
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../hooks/useToast';
import './Layout.css';

/* SVG icon helpers */
const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconWorkbasket = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconWorklist = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const IconAdmin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
  </svg>
);

const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isAdmin, isSuperadmin } = usePermissions();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { firmSlug } = useParams();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const profileDropdownRef = useRef(null);

  const currentFirmSlug = firmSlug || user?.firmSlug;
  const hasAdminAccess = isAdmin || isSuperadmin;
  const firmLabel = user?.firm?.name || currentFirmSlug || 'Firm';
  const firmInitials = firmLabel.substring(0, 2).toUpperCase();

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout({ preserveFirmSlug: !!currentFirmSlug });
    showSuccess('You have been signed out safely.');
    if (currentFirmSlug) {
      navigate(`/f/${currentFirmSlug}/login`);
    } else {
      navigate('/login');
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

  const navLinks = [
    {
      to: `/f/${currentFirmSlug}/dashboard`,
      label: 'Dashboard',
      icon: <IconDashboard />,
      active: isActive(`/f/${currentFirmSlug}/dashboard`),
    },
    {
      to: `/f/${currentFirmSlug}/global-worklist`,
      label: 'Workbasket',
      icon: <IconWorkbasket />,
      active: isActive(`/f/${currentFirmSlug}/global-worklist`),
    },
    {
      to: `/f/${currentFirmSlug}/worklist`,
      label: 'My Worklist',
      icon: <IconWorklist />,
      active: isActive(`/f/${currentFirmSlug}/worklist`),
    },
    ...(hasAdminAccess
      ? [
          {
            to: `/f/${currentFirmSlug}/admin`,
            label: 'Admin',
            icon: <IconAdmin />,
            active: isActivePrefix(`/f/${currentFirmSlug}/admin`),
          },
        ]
      : []),
  ];

  return (
    <div className="enterprise-layout">
      {/* Sidebar */}
      <aside
        className={[
          'enterprise-sidebar',
          sidebarCollapsed ? 'enterprise-sidebar--collapsed' : '',
          mobileSidebarOpen ? 'enterprise-sidebar--mobile-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Collapse toggle (desktop) */}
        <button
          className="enterprise-sidebar__toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>

        {/* Firm Badge */}
        <div className="enterprise-sidebar__firm">
          <div className="enterprise-sidebar__firm-icon">{firmInitials}</div>
          <div className="enterprise-sidebar__firm-info">
            <div className="enterprise-sidebar__firm-name" title={firmLabel}>
              {firmLabel}
            </div>
            <div className="enterprise-sidebar__firm-label">Professional Firm</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="enterprise-sidebar__nav">
          <div className="enterprise-sidebar__nav-section">
            <div className="enterprise-sidebar__nav-label">Workspace</div>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`enterprise-sidebar__nav-link ${link.active ? 'active' : ''}`}
              >
                <span className="enterprise-sidebar__nav-icon">{link.icon}</span>
                <span className="enterprise-sidebar__nav-text">{link.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="enterprise-sidebar__footer">
          <div className="enterprise-sidebar__version">Docketra v1.0</div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="enterprise-sidebar-overlay enterprise-sidebar-overlay--visible"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <div
        className={`enterprise-main ${sidebarCollapsed ? 'enterprise-main--sidebar-collapsed' : ''}`}
      >
        {/* Top Header */}
        <header className="enterprise-header">
          {/* Mobile sidebar toggle */}
          <button
            className="enterprise-header__sidebar-toggle"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <IconMenu />
          </button>

          {/* Page context / breadcrumb area */}
          <div className="enterprise-header__title">
            {firmLabel}
          </div>

          {/* Create Case CTA */}
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/f/${currentFirmSlug}/cases/create`)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <IconPlus />
            <span>New Case</span>
          </button>

          {/* Right actions */}
          <div className="enterprise-header__right">
            {/* Notification Bell */}
            <button className="enterprise-header__icon-btn" aria-label="Notifications">
              <IconBell />
            </button>

            {/* User Profile Dropdown */}
            <div className="dropdown" ref={profileDropdownRef}>
              <button
                className="enterprise-header__profile"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-expanded={profileDropdownOpen}
              >
                <div className="enterprise-header__user-avatar">{getUserInitials()}</div>
                <span className="enterprise-header__user-name">{user?.name || user?.xID}</span>
                <IconChevronDown />
              </button>
              {profileDropdownOpen && (
                <div className="dropdown-menu dropdown-menu-right">
                  <Link
                    to={`/f/${currentFirmSlug}/profile`}
                    className="dropdown-item"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button className="dropdown-item" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="enterprise-content">{children}</main>
      </div>
    </div>
  );
};
