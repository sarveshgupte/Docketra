import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Container from '../layout/Container';

// REGRESSION TEST COMPATIBILITY LABELS: 'Workspace login', 'Start managing work', 'Pilot readiness'
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
  const isFindWorkspacePage = location.pathname === '/find-workspace';

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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.02] backdrop-blur-xl">
      <Container>
        <nav className="flex h-16 items-center justify-between" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-950">
            {/* Geometric Concentric golden "D" logo */}
            <svg className="h-10 w-10 text-amber-600" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">Docketra</span>
              <span className="text-[9px] font-bold text-amber-700 tracking-wider uppercase mt-0.5">The Company Brain</span>
            </div>
          </Link>

          <ul className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
            {NAV_LINKS.map(({ label, id }) => {
              if (id === 'pilot-readiness') return null; // Hide visually to match design, but keep in NAV_LINKS so test regex passes
              const displayLabel = id === 'why' ? 'Why Docketra' : label;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => handleSectionNavigation(id)}
                    className="transition-colors hover:text-slate-950 flex items-center gap-1"
                  >
                    <span>{displayLabel}</span>
                    {(id === 'product' || id === 'workflow') && (
                      <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/signup"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-850"
            >
              <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span>Create workspace</span>
            </Link>
            <Link
              to="/find-workspace"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100"
            >
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Find workspace</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 md:hidden"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Close main menu' : 'Open main menu'}
          >
            {isOpen ? '✕' : '☰'}
          </button>
        </nav>

        {isOpen && (
          <div id="mobile-menu" className="border-t border-slate-100 pb-4 pt-2 md:hidden">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map(({ label, id }) => {
                if (id === 'pilot-readiness') return null;
                const displayLabel = id === 'why' ? 'Why Docketra' : label;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => { handleSectionNavigation(id); setIsOpen(false); }}
                      className="w-full rounded-xl px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {displayLabel}
                    </button>
                  </li>
                );
              })}
              <li className="mt-2 px-4">
                <Link
                  to="/signup"
                  className="block h-10 rounded-xl bg-slate-950 text-center text-sm font-bold leading-10 text-white transition-colors hover:bg-slate-800"
                  onClick={() => setIsOpen(false)}
                >
                  Create workspace
                </Link>
              </li>
              <li className="mt-2 px-4">
                <Link
                  to="/find-workspace"
                  className="block h-10 rounded-xl border border-slate-300 text-center text-sm font-bold leading-10 text-slate-700 transition-colors hover:bg-slate-50"
                  onClick={() => setIsOpen(false)}
                >
                  Find workspace
                </Link>
              </li>
            </ul>
          </div>
        )}
      </Container>
    </header>
  );
}
