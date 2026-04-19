import React from 'react';
import { useLocation } from 'react-router-dom';
import { FormSkeleton } from '../common/Skeleton';
import { PlatformRouteLoadingShell } from './PlatformRouteLoadingShell';

const LoadingBody = ({ children, centered = false }) => (
  <div className="route-loading-shell" aria-busy="true" aria-live="polite">
    <div className="route-loading-shell__progress" aria-hidden="true" />
    <div className={centered ? 'route-loading-shell__panel' : 'route-loading-shell__content'}>
      {children}
      <p className="mt-3 text-xs text-gray-500">
        Waking up services and loading your workspace…
      </p>
    </div>
  </div>
);

export const RouteLoadingShell = () => {
  const { pathname } = useLocation();
  const isFirmWorkspaceRoute = pathname.startsWith('/app/firm') || pathname === '/app/dashboard';

  if (isFirmWorkspaceRoute) {
    return <PlatformRouteLoadingShell />;
  }

  return (
    <LoadingBody centered>
      <FormSkeleton />
    </LoadingBody>
  );
};
