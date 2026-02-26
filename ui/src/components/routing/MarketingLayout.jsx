import React from 'react';
import { Link, Outlet } from 'react-router-dom';

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
            <Link to="/login" className="hover:text-slate-900">Login</Link>
            <Link
              to="/login"
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
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-slate-500">
          © {new Date().getFullYear()} Docketra
        </div>
      </footer>
    </div>
  );
};
