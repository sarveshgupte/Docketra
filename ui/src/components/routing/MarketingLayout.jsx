import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { COMPANY_NAME, COMPANY_CIN } from '../../lib/legalVersion';

export const MarketingLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            Docketra
          </Link>
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <Link to="/features" className="hover:text-slate-900">Features</Link>
            <Link to="/pricing" className="hover:text-slate-900">Pricing</Link>
            <Link to="/security" className="hover:text-slate-900">Security</Link>
            <Link to="/about" className="hover:text-slate-900">About</Link>
                        <Link
              to="/contact"
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Start Free Trial
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><Link to="/features" className="hover:text-slate-800">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-slate-800">Pricing</Link></li>
                <li><Link to="/security" className="hover:text-slate-800">Security</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Company</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><Link to="/about" className="hover:text-slate-800">About</Link></li>
                <li><Link to="/contact" className="hover:text-slate-800">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Legal</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                <li><Link to="/terms" className="hover:text-slate-800">Terms</Link></li>
                <li><Link to="/privacy" className="hover:text-slate-800">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} Docketra</p>
            <p className="mt-1">Operated by {COMPANY_NAME}</p>
            <p className="mt-0.5">CIN: {COMPANY_CIN}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
