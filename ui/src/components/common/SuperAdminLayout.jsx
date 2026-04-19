/**
 * SuperAdmin Layout Component
 * Dashboard shell for platform-level management
 */

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Loading } from './Loading';
import { USER_ROLES } from '../../utils/constants';

const navItemClass = (isActive) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
  }`;

export const SuperAdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess } = useToast();

  const handleLogout = async () => {
    await logout();
    navigate('/superadmin', { state: { message: 'You have been signed out safely.', messageType: 'success' } });
  };

  const isActive = (path) => location.pathname === path;

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
        </nav>

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
