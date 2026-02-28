import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { COMPANY_NAME, COMPANY_CIN } from '../../lib/legalVersion';
import { PageWrapper } from '../layout/PageWrapper';

const navLinkClass = 'text-gray-600 hover:text-black transition-colors';

export const MarketingLayout = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-200 backdrop-blur bg-white/80">
        <nav className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            Docketra
          </Link>

          <div className="flex items-center gap-6 text-sm font-medium">
            <Link to="/features" className={navLinkClass}>Features</Link>
            <Link to="/pricing" className={navLinkClass}>Pricing</Link>
            <Link to="/security" className={navLinkClass}>Security</Link>
            <Link to="/about" className={navLinkClass}>About</Link>
            <Link
              to="/signup"
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-white transition-all duration-150 hover:scale-[1.01] hover:-translate-y-0.5 hover:bg-black active:scale-[0.98]"
            >
              Create Free Workspace
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
        <section className="w-full py-24 px-6">
          <div className="max-w-6xl mx-auto">
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
