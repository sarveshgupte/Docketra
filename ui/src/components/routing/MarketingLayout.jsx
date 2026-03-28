import React, { useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../layout/PageWrapper';

const navLinkClass = ({ isActive }) =>
  `text-sm text-gray-600 hover:text-gray-900${isActive ? ' text-gray-900' : ''}`;

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

      <header className="w-full border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex h-16 min-w-0 items-center justify-between">
            <div className="min-w-0 flex items-center">
              <Link to="/" className="text-lg font-semibold text-gray-900">
                Docketra
              </Link>
            </div>

            <nav className="min-w-0 flex items-center gap-8">
              <NavLink to="/features" className={navLinkClass}>
                Features
              </NavLink>
              <NavLink to="/pricing" className={navLinkClass}>
                Pricing
              </NavLink>
              <NavLink to="/security" className={navLinkClass}>
                Security
              </NavLink>
              <NavLink to="/about" className={navLinkClass}>
                About
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main id="main" className="w-full">
        <AnimatePresence mode="wait" initial={false}>
          <PageWrapper key={location.pathname}>
            <Outlet />
          </PageWrapper>
        </AnimatePresence>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <section className="w-full py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <Link to="/features" className="text-gray-600 hover:text-gray-900">
                Features
              </Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </Link>
              <a href="mailto:hello@docketra.com" className="text-gray-600 hover:text-gray-900">
                Contact
              </a>
            </div>
            <p className="mt-6 text-xs text-gray-500">
              © 2026 Docketra
            </p>
          </div>
        </section>
      </footer>
    </div>
  );
};
