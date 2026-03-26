import React from 'react';
import { useNavigate } from 'react-router-dom';

export const RouteErrorFallback = ({ title = 'Unable to load page', message = 'An unexpected error occurred.', backTo, onRetry }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-xl border border-red-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-red-700">{title}</h2>
        <p className="mt-2 text-sm text-gray-700">{message}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary" onClick={onRetry || (() => window.location.reload())}>Retry</button>
          <button type="button" className="btn btn-ghost" onClick={() => (backTo ? navigate(backTo) : navigate(-1))}>Go Back</button>
        </div>
      </div>
    </div>
  );
};
