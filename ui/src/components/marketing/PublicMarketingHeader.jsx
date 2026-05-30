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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/85 shadow-sm shadow-slate-900/[0.03] backdrop-blur-xl">
      <Container>
        <nav className="flex h-16 items-center justify-between" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-sm text-white" aria-hidden="true">✨</span>
            <span>Docketra</span>
          </Link>

          <ul className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex">
            {NAV_LINKS.map(({ label, id }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => handleSectionNavigation(id)}
                  className="transition-colors hover:text-slate-950"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 md:flex">
            {!isFindWorkspacePage ? <Link to="/find-workspace" className="text-sm font-bold text-slate-600 hover:text-slate-950">Workspace login</Link> : null}
            <Link
              to="/signup"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              Start managing work
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate900/30 md:hidden"
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
              {NAV_LINKS.map(({ label, id }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => { handleSectionNavigation(id); setIsOpen(false); }}
                    className="w-full rounded-xl px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {label}
                  </button>
                </li>
              ))}
              {!isFindWorkspacePage ? (
                <li className="mt-2 px-4">
                  <Link to="/find-workspace" className="block h-10 rounded-xl border border-slate-300 text-center text-sm font-bold leading-10 text-slate-700 transition-colors hover:bg-slate-50" onClick={() => setIsOpen(false)}>Workspace login</Link>
                </li>
              ) : null}
              <li className="mt-2 px-4">
                <Link
                  to="/signup"
                  className="block h-10 rounded-xl bg-slate-950 text-center text-sm font-bold leading-10 text-white transition-colors hover:bg-slate-800"
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
