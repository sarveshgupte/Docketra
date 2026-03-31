import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

export const RouteErrorFallback = ({
  title = 'Unable to load page',
  message = 'An unexpected error occurred.',
  backTo,
  onRetry,
}) => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();

  const fallbackRoute = firmSlug ? ROUTES.DASHBOARD(firmSlug) : ROUTES.SUPERADMIN_LOGIN;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-xl border border-red-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-red-700">{title}</h2>
        <p className="mt-2 text-sm text-gray-700">{message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={onRetry || (() => window.location.reload())}>Retry</button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(backTo || fallbackRoute)}>
            {firmSlug ? 'Go to Dashboard' : 'Go to Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
