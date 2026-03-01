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
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 ${
          isScrolled ? 'border-gray-200 bg-white/95 shadow-sm' : 'border-gray-100 bg-white/80'
        }`}
      >
        <nav className={`marketing-container flex w-full items-center justify-between transition-[height] duration-300 ${isScrolled ? 'h-16' : 'h-20'}`}>
          <Link to="/" className="text-xl font-semibold tracking-tight text-gray-900">
            Docketra
          </Link>

          <div className="flex items-center gap-6">
            <NavLink to="/features" className={navLinkClass}>Features</NavLink>
            <NavLink to="/pricing" className={navLinkClass}>Pricing</NavLink>
            <NavLink to="/security" className={navLinkClass}>Security</NavLink>
            <NavLink to="/about" className={navLinkClass}>About</NavLink>
            <Link
              to="/signup"
              className="marketing-btn-primary px-5 py-2.5 text-sm font-medium"
            >
              Request Early Access
            </Link>
          </div>
        </nav>
      </header>

      <main className="w-full">
        <AnimatePresence mode="wait" initial={false}>
          <PageWrapper key={location.pathname}>
            <Outlet />
          </PageWrapper>
        </AnimatePresence>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <section className="w-full marketing-section">
          <div className="marketing-container">
            <div className="flex flex-wrap items-center gap-6">
              <Link to="/features" className="marketing-footer-link">Features</Link>
              <Link to="/pricing" className="marketing-footer-link">Pricing</Link>
              <Link to="/security" className="marketing-footer-link">Security</Link>
              <Link to="/privacy" className="marketing-footer-link">Privacy</Link>
              <Link to="/terms" className="marketing-footer-link">Terms</Link>
              <Link to="/contact" className="marketing-footer-link">Contact</Link>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6 text-xs text-gray-500">
              <p>© 2026 GUPTE ENTERPRISES (OPC) PRIVATE LIMITED</p>
            </div>
          </div>
        </section>
      </footer>
    </div>
  );
};
