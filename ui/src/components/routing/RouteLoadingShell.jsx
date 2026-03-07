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

  if (pathname.includes('/cases') || pathname.includes('/worklist') || pathname.includes('/admin')) {
    return <TableSkeleton />;
  }

  return <PageSkeleton />;
};

export const RouteLoadingShell = () => {
  const { pathname } = useLocation();

  if (pathname.startsWith('/app/firm/')) {
    return (
      <Layout>
        <div aria-busy="true" aria-live="polite">
          {getShellContent(pathname)}
        </div>
      </Layout>
    );
  }

  return (
    <div className="route-loading-shell" aria-busy="true" aria-live="polite">
      <div className="route-loading-shell__panel">
        <FormSkeleton />
      </div>
    </div>
  );
};
