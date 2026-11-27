/**
 * SuperAdmin Layout Component
 * Dashboard shell for platform-level management
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from './Loading';
import { superadminService } from '../../services/superadminService';
import { SUPERADMIN_PILOT_SURFACE } from '../../constants/pilotSurface';

const navItemClass = (isActive) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
  }`;

const SidebarLink = ({ to, label, isActive, visible = true, onNavigate }) => {
  if (!visible) return null;
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={navItemClass(isActive(to))}
      aria-current={isActive(to) ? 'page' : undefined}
    >
      {label}
    </Link>
  );
};

export const SuperAdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchContainerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState({ firms: [], admins: [], audit: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalResults = useMemo(
    () => (searchResults.firms.length + searchResults.admins.length + searchResults.audit.length),
    [searchResults],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/superadmin/login', { state: { message: 'You have been signed out safely.', messageType: 'success' } });
  };

  const isActive = (path) => {
    if (path === '/app/superadmin') {
      return location.pathname === '/app/superadmin' || location.pathname === '/app/superadmin/';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };
  const showSuperadminNavItem = (path) => Boolean(SUPERADMIN_PILOT_SURFACE.visibleNavPaths?.has(path));
  const runSearch = async (rawQuery = searchQuery) => {
    const q = String(rawQuery || '').trim();
    setSearchOpen(true);
    setSearchError('');
    if (!q) {
      setSearchResults({ firms: [], admins: [], audit: [] });
      return;
    }
    if (q.length < 2) {
      setSearchResults({ firms: [], admins: [], audit: [] });
      return;
    }
    try {
      setSearching(true);
      const response = await superadminService.searchGlobal({ q, limit: 8 });
      setSearchResults(response?.data || { firms: [], admins: [], audit: [] });
    } catch (error) {
      setSearchError(error?.response?.data?.message || 'Search is temporarily unavailable.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const q = String(searchQuery || '').trim();
    if (!q || q.length < 2) {
      setSearchError('');
      setSearching(false);
      setSearchResults({ firms: [], admins: [], audit: [] });
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Guard: Only render children if user is loaded and is SuperAdmin
  const isSuperAdminUser = user?.isSuperAdmin === true || ['SUPER_ADMIN', 'SUPERADMIN', 'SuperAdmin'].includes(String(user?.role || '').trim());
  if (user === null || !isSuperAdminUser) {
    return <Loading message="Preparing platform dashboard..." />;
  }

  const closeMobileNav = () => setMobileMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50">
      <aside aria-label="SuperAdmin Sidebar" className="w-full md:w-64 lg:w-72 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white px-4 py-4 md:px-6 md:py-8">
        <div className="flex items-center justify-between gap-3 md:block">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">DocketsHQ Platform</h1>
            <span className="mt-1 md:mt-2 inline-flex rounded-xs bg-gray-900 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
              SuperAdmin
            </span>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {mobileMenuOpen ? 'Close' : 'Menu'}
            </button>
            <button aria-label="Logout" onClick={handleLogout} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 md:hidden">
              Logout
            </button>
          </div>
        </div>

        <nav aria-label="SuperAdmin Navigation" className={`mt-4 md:mt-6 flex-col gap-1.5 ${mobileMenuOpen ? 'flex' : 'hidden md:flex'}`}>
          <SidebarLink to="/app/superadmin" label="Platform Dashboard" isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/firms" label="Firms" isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/onboarding-insights" label="Onboarding Insights" visible={showSuperadminNavItem('/app/superadmin/onboarding-insights')} isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/firm-health" label="Firm Health" visible={showSuperadminNavItem('/app/superadmin/firm-health')} isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/feature-flags" label="Feature Flags" visible={showSuperadminNavItem('/app/superadmin/feature-flags')} isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/pilot-readiness" label="Pilot Readiness" isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/plans" label="Plans & Capacity" visible={showSuperadminNavItem('/app/superadmin/plans')} isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/diagnostics" label="Support Diagnostics" isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/audit" label="Audit Logs" visible={showSuperadminNavItem('/app/superadmin/audit')} isActive={isActive} onNavigate={closeMobileNav} />
          <SidebarLink to="/app/superadmin/ai-assistant" label="AI Assistant" visible={showSuperadminNavItem('/app/superadmin/ai-assistant')} isActive={isActive} onNavigate={closeMobileNav} />
        </nav>

        <div ref={searchContainerRef} className={`mt-4 md:mt-6 rounded-xl border border-gray-200 bg-white p-3 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Global search</p>
          <div className="mt-2 flex gap-2">
            <input
              aria-label="Global search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch();
                } else if (e.key === 'Escape') {
                  setSearchOpen(false);
                }
              }}
              placeholder="Search firms, admins, audit refs"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={() => void runSearch()} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white">Search</button>
          </div>
          <p className="mt-2 text-xs text-gray-500">Search returns platform lifecycle/support metadata only. It does not search client records, dockets, tasks, attachments, or private client content.</p>
          {searchOpen ? (
            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm">
              {searching ? <p className="text-gray-600">Searching...</p> : null}
              {!searching && searchError ? <p className="text-red-700">{searchError}</p> : null}
              {!searching && !searchError && searchQuery.trim().length < 2 ? <p className="text-gray-600">Enter at least 2 characters.</p> : null}
              {!searching && !searchError && !totalResults && searchQuery.trim().length >= 2 ? <p className="text-gray-600">No matches found.</p> : null}
              {!searching && !searchError && totalResults > 0 ? (
                <div className="space-y-2">
                  {[['Firms', searchResults.firms], ['Admins', searchResults.admins], ['Audit references', searchResults.audit]].map(([label, rows]) => (
                    rows?.length ? (
                      <div key={label}>
                        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                        {rows.map((row) => (
                          <button
                            key={`${row.type}-${row.id}`}
                            type="button"
                            className="mt-1 w-full rounded px-2 py-1.5 text-left hover:bg-white"
                            onClick={() => {
                              setSearchOpen(false);
                              closeMobileNav();
                              navigate(row.href);
                            }}
                          >
                            <p className="text-sm font-medium text-gray-900">{row.name || row.firmName || row.actionType || row.targetEntityId || row.firmId}</p>
                            <p className="text-xs text-gray-500">{row.firmId || row.xID || row.requestId || row.targetEntityType || ''}</p>
                          </button>
                        ))}
                      </div>
                    ) : null
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 hidden rounded-xl border border-gray-200 bg-gray-50 p-3 md:block">
          <p className="truncate text-xs text-gray-500">Signed in as</p>
          <p className="truncate text-sm font-medium text-gray-900">{user?.xID || user?.email || 'SuperAdmin'}</p>
          <button aria-label="Logout from SuperAdmin" onClick={handleLogout} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2">
            Logout
          </button>
        </div>
      </aside>

      <main aria-label="Main Content" className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8">{children}</main>
    </div>
  );
};
