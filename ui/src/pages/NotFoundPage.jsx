import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-container-x text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">
        The page you requested does not exist or may have moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/" aria-label="Navigate to home page" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Go to Home
        </Link>
        <Link to="/superadmin" aria-label="Navigate to login page" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          Go to Login
        </Link>
      </div>
    </div>
  );
};
