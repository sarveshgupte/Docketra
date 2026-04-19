/**
 * Firm Layout Component
 * Wrapper for all firm-scoped routes
 * Validates firm context and prevents cross-firm access
 */

import React from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageWrapper } from '../layout/PageWrapper';
import { RouteLoadingShell } from './RouteLoadingShell';
import { ROUTES } from '../../constants/routes';

export const FirmLayout = () => {
  const { firmSlug } = useParams();
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoadingShell />;
  }

  if (user?.firmSlug && user.firmSlug !== firmSlug) {
    const safeDashboardRoute = ROUTES.DASHBOARD(user.firmSlug);
    const safeLoginRoute = ROUTES.FIRM_LOGIN(user.firmSlug);
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <main className="w-full px-6 py-24 text-center lg:px-8">
          <h1 className="type-section">Access denied</h1>
          <p className="mt-6 type-body">
            You tried to open firm "{firmSlug}", but your session is scoped to "{user.firmSlug}".
          </p>
          <p className="mt-6 type-body">Switch back to your firm dashboard to continue safely.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={safeDashboardRoute}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Go to dashboard
            </Link>
            <Link
              to={safeLoginRoute}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
            >
              Switch workspace
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="flex w-full flex-1 px-6 lg:px-8">
        <PageWrapper>
          <Outlet />
        </PageWrapper>
      </main>
    </div>
  );
};
