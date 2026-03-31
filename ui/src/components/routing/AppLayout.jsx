import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import Navbar from '../layout/Navbar';
import Container from '../layout/Container';

export const AppLayout = ({ children }) => {
  const content = children ?? <Outlet />;

  return (
    <div className="marketing-shell min-h-screen bg-white text-gray-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-blue-700">
        Skip to main content
      </a>
      <Navbar />

      <main id="main" className="w-full">
        {content}
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <section className="w-full py-16 md:py-20">
          <Container>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <Link to="/#features" className="text-gray-600 hover:text-gray-900">
                Features
              </Link>
              <Link to="/#pricing" className="text-gray-600 hover:text-gray-900">
                Pricing
              </Link>
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
