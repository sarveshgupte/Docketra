import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Container from '../layout/Container';

const NAV_LINKS = [
  { label: 'Why', id: 'why' },
  { label: 'Product', id: 'product' },
  { label: 'Workflow', id: 'workflow' },
  { label: 'Pilot readiness', id: 'pilot-readiness' },
  { label: 'Trust', id: 'trust' },
];

export default function PublicMarketingHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSectionNavigation = (sectionId) => {
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      setIsOpen(false);
      return;
    }

    navigate({ pathname: '/', hash: `#${sectionId}` });

    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setIsOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <Container>
        <nav className="flex h-16 items-center justify-between" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900 text-lg tracking-tight">
            Docketra
          </Link>

          <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            {NAV_LINKS.map(({ label, id }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => handleSectionNavigation(id)}
                  className="hover:text-slate-900 transition-colors"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/find-workspace" className="text-sm font-medium text-slate-600 hover:text-slate-900">Workspace login</Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center h-9 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors shadow-sm"
            >
              Start managing work
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate900/30 transition-colors"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Close main menu' : 'Open main menu'}
          >
            {isOpen ? '✕' : '☰'}
          </button>
        </nav>

        {isOpen && (
          <div id="mobile-menu" className="md:hidden border-t border-slate-100 pb-4 pt-2">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map(({ label, id }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => { handleSectionNavigation(id); setIsOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md"
                  >
                    {label}
                  </button>
                </li>
              ))}
              <li className="mt-2 px-4">
                <Link to="/find-workspace" className="block text-center h-9 leading-9 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors" onClick={() => setIsOpen(false)}>Workspace login</Link>
              </li>
              <li className="mt-2 px-4">
                <Link
                  to="/signup"
                  className="block text-center h-9 leading-9 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Start managing work
                </Link>
              </li>
            </ul>
          </div>
        )}
      </Container>
    </header>
  );
}
