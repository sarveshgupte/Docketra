/**
 * Firm Layout Component
 * Wrapper for all firm-scoped routes
 * Validates firm context and prevents cross-firm access
 */

import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PageWrapper } from '../layout/PageWrapper';
import { RouteLoadingShell } from './RouteLoadingShell';

export const FirmLayout = () => {
  const { firmSlug } = useParams();
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoadingShell />;
  }

  if (user?.firmSlug && user.firmSlug !== firmSlug) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <main className="w-full px-6 py-24 text-center lg:px-8">
          <h1 className="type-section">Access denied</h1>
          <p className="mt-6 type-body">
            You tried to open firm "{firmSlug}", but your session is scoped to "{user.firmSlug}".
          </p>
          <p className="mt-6 type-body">Switch back to your firm dashboard to continue safely.</p>
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
