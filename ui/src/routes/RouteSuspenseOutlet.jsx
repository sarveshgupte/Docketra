import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RouteLoadingShell } from '../components/routing/RouteLoadingShell';

export const RouteSuspenseOutlet = () => (
  <Suspense fallback={<RouteLoadingShell />}>
    <Outlet />
  </Suspense>
);
