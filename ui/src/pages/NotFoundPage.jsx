import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';

export const NotFoundPage = () => {
  const { firmSlug } = useParams();
  const { isAuthenticated, user } = useAuth();

  const activeFirmSlug = firmSlug || user?.firmSlug;
  const primaryRoute = isAuthenticated && activeFirmSlug ? ROUTES.DASHBOARD(activeFirmSlug) : '/';
  const secondaryRoute = isAuthenticated && activeFirmSlug ? ROUTES.WORKLIST(activeFirmSlug) : ROUTES.SUPERADMIN_LOGIN;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">
        The page you requested does not exist or may have moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to={primaryRoute} aria-label="Navigate to primary page" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          {isAuthenticated && activeFirmSlug ? 'Go to Dashboard' : 'Go to Home'}
        </Link>
        <Link to={secondaryRoute} aria-label="Navigate to secondary page" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          {isAuthenticated && activeFirmSlug ? 'Go to Worklist' : 'Go to Login'}
        </Link>
      </div>
    </div>
  );
};
