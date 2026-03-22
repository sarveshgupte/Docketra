import React, { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageWrapper } from '../layout/PageWrapper';

const navLinkClass = ({ isActive }) =>
  `marketing-nav-item text-sm font-medium${isActive ? ' marketing-nav-item--active' : ''}`;
const SCROLL_THRESHOLD_PX = 6;

export const MarketingLayout = () => {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="marketing-shell min-h-screen bg-white text-gray-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-blue-700">
        Skip to main content
      </a>

      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 ${
          isScrolled ? 'border-gray-200 bg-white/95 shadow-sm' : 'border-gray-100 bg-white/80'
        }`}
      >
        <nav
          className={`marketing-container flex w-full flex-col items-stretch justify-between gap-4 py-4 transition-[height] duration-300 sm:flex-row sm:items-center sm:gap-6 sm:py-0 ${isScrolled ? 'sm:h-16' : 'sm:h-20'}`}
        >
          <Link to="/" className="shrink-0 text-xl font-semibold tracking-tight text-gray-900">
            Docketra
          </Link>

          <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 sm:w-auto sm:justify-end">
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
          </div>
        </nav>
      </header>

      <main id="main" className="w-full">
        <AnimatePresence mode="wait" initial={false}>
          <PageWrapper key={location.pathname}>
            <Outlet />
          </PageWrapper>
        </AnimatePresence>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <section className="w-full marketing-section">
          <div className="marketing-container w-full">
            <div className="mb-8 grid w-full grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Product</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/features" className="text-gray-600 hover:text-gray-900">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link to="/pricing" className="text-gray-600 hover:text-gray-900">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link to="/security" className="text-gray-600 hover:text-gray-900">
                      Security
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/about" className="text-gray-600 hover:text-gray-900">
                      About
                    </Link>
                  </li>
                  <li>
                    <a href="mailto:hello@docketra.com" className="text-gray-600 hover:text-gray-900">
                      Contact
                    </a>
                  </li>
                  <li>
                    <Link to="/contact" className="text-gray-600 hover:text-gray-900">
                      Contact Center
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Legal</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/privacy" className="text-gray-600 hover:text-gray-900">
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link to="/terms" className="text-gray-600 hover:text-gray-900">
                      Terms
                    </Link>
                  </li>
                  <li>
                    <Link to="/security" className="text-gray-600 hover:text-gray-900">
                      Security
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-gray-900">Contact</h4>
                <p className="text-sm text-gray-600">
                  <a href="mailto:hello@docketra.com" className="hover:text-gray-900">
                    hello@docketra.com
                  </a>
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <p className="text-xs text-gray-500">
                © 2026 GUPTE ENTERPRISES (OPC) PRIVATE LIMITED. All rights reserved. Docketra is in early development.
              </p>
            </div>
          </div>
        </section>
      </footer>
    </div>
  );
};
