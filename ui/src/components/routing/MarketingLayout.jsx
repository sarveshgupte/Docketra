import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { COMPANY_NAME, COMPANY_CIN } from '../../lib/legalVersion';
import { PageWrapper } from '../layout/PageWrapper';

const navLinkClass = 'marketing-nav-item text-sm font-medium';
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

  return (
    <div className="marketing-shell min-h-screen bg-white text-gray-900">
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 ${
          isScrolled ? 'border-gray-200 bg-white/95 shadow-sm' : 'border-gray-100 bg-white/80'
        }`}
      >
        <nav className={`marketing-container flex w-full items-center justify-between transition-[height] duration-300 ${isScrolled ? 'h-16' : 'h-20'}`}>
          <Link to="/" className="text-xl font-semibold tracking-tight">
            Docketra
          </Link>

          <div className="flex items-center gap-6">
            <Link to="/features" className={navLinkClass}>Features</Link>
            <Link to="/pricing" className={navLinkClass}>Pricing</Link>
            <Link to="/security" className={navLinkClass}>Security</Link>
            <Link to="/about" className={navLinkClass}>About</Link>
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
        <PageWrapper key={location.pathname}>
          <Outlet />
        </PageWrapper>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <section className="w-full" style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-2xl)' }}>
          <div className="marketing-container">
            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Product</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li><Link to="/features" className={navLinkClass}>Features</Link></li>
                  <li><Link to="/pricing" className={navLinkClass}>Pricing</Link></li>
                  <li><Link to="/security" className={navLinkClass}>Security</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Company</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li><Link to="/about" className={navLinkClass}>About</Link></li>
                  <li><Link to="/contact" className={navLinkClass}>Contact</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Legal</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li><Link to="/terms" className={navLinkClass}>Terms</Link></li>
                  <li><Link to="/privacy" className={navLinkClass}>Privacy</Link></li>
                </ul>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6 text-xs text-gray-500">
              <p>© {new Date().getFullYear()} Docketra</p>
              <p className="mt-1">Operated by {COMPANY_NAME}</p>
              <p className="mt-1">CIN: {COMPANY_CIN}</p>
            </div>
          </div>
        </section>
      </footer>
    </div>
  );
};
