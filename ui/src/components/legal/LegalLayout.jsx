import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LEGAL_VERSION, LAST_UPDATED, COMPANY_NAME } from '../../lib/legalVersion';
import { PageContainer } from '../layout/PageContainer';

const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms', icon: '📜' },
  { to: '/privacy', label: 'Privacy', icon: '🛡️' },
  { to: '/security', label: 'Security', icon: '🔐' },
  { to: '/acceptable-use', label: 'Use Policy', icon: '✅' },
  { to: '/contact', label: 'Contact', icon: '👋' },
];

export const LegalLayout = ({
  title,
  description,
  sections,
  children,
  kicker = 'Docketra policy hub',
  highlights = [],
}) => {
  const [activeId, setActiveId] = useState('');
  const observerRef = useRef(null);
  const containerRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    const headings = container.querySelectorAll('section[id]');
    headings.forEach((el) => observerRef.current.observe(el));

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return (
    <article className="bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_42%,#e0f2fe_100%)]">
      <PageContainer className="relative py-8 md:py-12" ref={containerRef}>
        <header className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.45)] backdrop-blur md:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="text-sm font-bold text-teal-700">{kicker}</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[0.98] tracking-normal text-slate-950 md:text-6xl">
                {title}
              </h1>
              {description && (
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                  {description}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  Version {LEGAL_VERSION}
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800">
                  Updated {LAST_UPDATED}
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                  Plain-English preview
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl">
              <p className="text-sm font-semibold text-sky-200">Quick orientation</p>
              <div className="mt-4 grid gap-3">
                {(highlights.length ? highlights : ['Policy scope', 'Firm-owned data', 'Support contact']).map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <nav aria-label="Legal pages" className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {LEGAL_LINKS.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    isActive
                      ? 'border-slate-950 bg-slate-950 text-white shadow-lg'
                      : 'border-white/80 bg-white/70 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <span className="mr-2" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {sections && sections.length > 0 && (
            <nav
              aria-label="Table of contents"
              className="w-full rounded-[1.5rem] border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur lg:sticky lg:top-24 lg:self-start"
            >
              <p className="mb-3 text-xs font-bold text-slate-500">
                On this page
              </p>
              <ul className="space-y-1">
                {sections.map(({ id, label }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`block w-full break-words rounded-xl px-3 py-2 text-sm transition-colors ${
                        activeId === id
                          ? 'bg-slate-950 font-bold text-white'
                          : 'text-slate-600 hover:bg-white hover:text-slate-950'
                      }`}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <main className="min-w-0 w-full rounded-[1.5rem] border border-white/80 bg-white/90 p-5 text-sm leading-relaxed text-slate-700 shadow-sm md:p-8">
            {children}

            <footer className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">
              <p>Operated by <strong className="text-slate-800">{COMPANY_NAME}</strong></p>
              <p className="mt-1">Legal Version {LEGAL_VERSION} &mdash; {LAST_UPDATED}</p>
            </footer>
          </main>
        </div>
      </PageContainer>
    </article>
  );
};
