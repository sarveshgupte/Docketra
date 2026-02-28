/**
 * Firm Layout Component
 * Wrapper for all firm-scoped routes
 * Validates firm context and prevents cross-firm access
 */

import React from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../common/Loading';
import { PageWrapper } from '../layout/PageWrapper';

export const FirmLayout = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading message="Checking firm access..." />;
  }

  if (user?.firmSlug && user.firmSlug !== firmSlug) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        <main className="max-w-7xl mx-auto px-6 py-24 text-center">
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
      <main className="max-w-7xl mx-auto px-6">
        <PageWrapper key={location.pathname}>
          <Outlet />
        </PageWrapper>
      </main>
    </div>
  );
};
