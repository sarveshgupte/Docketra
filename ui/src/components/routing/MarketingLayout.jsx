import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../layout/PageWrapper';
import { SharedLayout } from './SharedLayout';

export const MarketingLayout = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);

  return (
    <SharedLayout>
      <AnimatePresence mode="wait" initial={false}>
        <PageWrapper key={location.pathname}>
          <Outlet />
        </PageWrapper>
      </AnimatePresence>
    </SharedLayout>
  );
};
