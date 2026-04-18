import React from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '../common/Layout';
import { DashboardSkeleton, FormSkeleton, PageSkeleton, TableSkeleton } from '../common/Skeleton';

const getShellContent = (pathname) => {
  if (pathname.includes('/dashboard') || pathname.includes('/reports')) {
    return <DashboardSkeleton />;
  }

  if (pathname.includes('/create') || pathname.includes('/settings') || pathname.includes('/profile')) {
    return <FormSkeleton />;
  }

  if (pathname.includes('/dockets') || pathname.includes('/cases') || pathname.includes('/worklist') || pathname.includes('/admin')) {
    return <TableSkeleton rows={5} />;
  }

  return <PageSkeleton />;
};

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

  if (pathname.startsWith('/app/firm/')) {
    return (
      <Layout>
        <LoadingBody>{getShellContent(pathname)}</LoadingBody>
      </Layout>
    );
  }

  return (
    <LoadingBody centered>
      <FormSkeleton />
    </LoadingBody>
  );
};
