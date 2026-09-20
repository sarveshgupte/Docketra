import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { RouteLoadingShell } from '../components/routing/RouteLoadingShell';
import { isRoutePreloaded } from './lazyPages';

export const RouteSuspenseOutlet = () => {
  const location = useLocation();
  const preloaded = isRoutePreloaded(location.pathname);

  if (preloaded) {
    return <Outlet />;
  }

  return (
    <Suspense fallback={<RouteLoadingShell />}>
      <Outlet />
    </Suspense>
  );
};
