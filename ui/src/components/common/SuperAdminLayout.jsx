/**
 * SuperAdmin Layout Component
 * Dashboard shell for platform-level management
 */

import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Loading } from './Loading';
import { USER_ROLES } from '../../utils/constants';
import { superadminService } from '../../services/superadminService';

const navItemClass = (isActive) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
  }`;

export const SuperAdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState({ firms: [], admins: [], audit: [] });
  const [searchOpen, setSearchOpen] = useState(false);

  const totalResults = useMemo(
    () => (searchResults.firms.length + searchResults.admins.length + searchResults.audit.length),
    [searchResults],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/superadmin/login', { state: { message: 'You have been signed out safely.', messageType: 'success' } });
  };

  const isActive = (path) => location.pathname === path;
  const runSearch = async () => {
    const q = String(searchQuery || '').trim();
    setSearchOpen(true);
    setSearchError('');
    if (!q) {
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

  // Guard: Only render children if user is loaded and is SuperAdmin
  if (user === null || (user?.isSuperAdmin !== true && user?.role !== USER_ROLES.SUPER_ADMIN)) {
    return <Loading message="Preparing platform dashboard..." />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside aria-label="SuperAdmin Sidebar" className="w-72 shrink-0 border-r border-gray-200 bg-white px-6 py-8">
        <div className="flex items-start justify-between gap-3 md:block">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Docketra Platform</h1>
            <span className="mt-2 inline-flex rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              SuperAdmin
            </span>
          </div>
          <button aria-label="Logout" onClick={handleLogout} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 md:hidden">
            Logout
          </button>
        </div>

        <nav aria-label="SuperAdmin Navigation" className="mt-6 flex gap-2 md:flex-col">
          <Link to="/app/superadmin" className={navItemClass(isActive('/app/superadmin'))} aria-current={isActive('/app/superadmin') ? 'page' : undefined}>
            Platform Dashboard
          </Link>
          <Link to="/app/superadmin/firms" className={navItemClass(isActive('/app/superadmin/firms'))} aria-current={isActive('/app/superadmin/firms') ? 'page' : undefined}>
            Firms
          </Link>
          <Link to="/app/superadmin/onboarding-insights" className={navItemClass(isActive('/app/superadmin/onboarding-insights'))} aria-current={isActive('/app/superadmin/onboarding-insights') ? 'page' : undefined}>
            Onboarding Insights
          </Link>
          <Link to="/app/superadmin/diagnostics" className={navItemClass(isActive('/app/superadmin/diagnostics'))} aria-current={isActive('/app/superadmin/diagnostics') ? 'page' : undefined}>
            Support Diagnostics
          </Link>
          <Link to="/app/superadmin/audit" className={navItemClass(isActive('/app/superadmin/audit'))} aria-current={isActive('/app/superadmin/audit') ? 'page' : undefined}>
            Audit Logs
          </Link>
        </nav>
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Global search</p>
          <div className="mt-2 flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch();
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
              {!searching && !searchError && !totalResults && searchQuery.trim() ? <p className="text-gray-600">No matches found.</p> : null}
              {!searching && !searchError && totalResults > 0 ? (
                <div className="space-y-2">
                  {[['Firms', searchResults.firms], ['Admins', searchResults.admins], ['Audit references', searchResults.audit]].map(([label, rows]) => (
                    <div key={label}>
                      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                      {(rows || []).map((row) => (
                        <button
                          key={`${row.type}-${row.id}`}
                          type="button"
                          className="mt-1 w-full rounded px-2 py-1.5 text-left hover:bg-white"
                          onClick={() => {
                            setSearchOpen(false);
                            navigate(row.href);
                          }}
                        >
                          <p className="text-sm font-medium text-gray-900">{row.name || row.firmName || row.actionType || row.targetEntityId || row.firmId}</p>
                          <p className="text-xs text-gray-500">{row.firmId || row.xID || row.requestId || row.targetEntityType || ''}</p>
                        </button>
                      ))}
                    </div>
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
