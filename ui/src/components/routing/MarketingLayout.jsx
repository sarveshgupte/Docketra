import React, { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../layout/PageWrapper';
import Container from '../layout/Container';
import Navbar from '../layout/Navbar';


export const MarketingLayout = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="marketing-shell min-h-screen bg-white text-gray-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-blue-700">
        Skip to main content
      </a>
      <Navbar />

      <main id="main" className="w-full">
        <AnimatePresence mode="wait" initial={false}>
          <PageWrapper key={location.pathname}>
            <Outlet />
          </PageWrapper>
        </AnimatePresence>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <section className="w-full py-20 md:py-28">
          <Container>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <a href="/#features" className="text-gray-600 hover:text-gray-900">
                Features
              </a>
              <a href="/#pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </a>
              <a href="mailto:hello@docketra.com" className="text-gray-600 hover:text-gray-900">
                Contact
              </a>
            </div>
            <p className="mt-6 text-xs text-gray-500">
              © 2026 Docketra
            </p>
          </Container>
        </section>
      </footer>
    </div>
  );
};
