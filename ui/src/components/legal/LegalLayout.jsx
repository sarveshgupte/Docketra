import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LEGAL_VERSION, LAST_UPDATED, COMPANY_NAME } from '../../lib/legalVersion';
import { PageContainer } from '../layout/PageContainer';
import SeoHead from '../common/SeoHead';

const LEGAL_LINKS = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/security', label: 'Security' },
  { to: '/acceptable-use', label: 'Use Policy' },
  { to: '/contact', label: 'Contact' },
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
    <article className="min-h-screen bg-slate-50/40 text-slate-900">
      <SeoHead
        canonicalPath={location.pathname}
        title={`${title} | Docketra`}
        description={description}
      />
      <PageContainer className="relative py-8 md:py-12" ref={containerRef}>
        <header className="rounded-sm border border-slate-200 bg-white p-6 sm:p-8 shadow-subtle">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div>
              <p className="text-xs font-semibold text-slate-600">{kicker}</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {title}
              </h1>
              {description && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  {description}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-xs border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                  {`Version ${LEGAL_VERSION}`}
                </span>
                <span className="rounded-xs border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                  {`Updated ${LAST_UPDATED}`}
                </span>
                <span className="rounded-xs border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                  Plain English summary
                </span>
              </div>
            </div>

            <aside className="rounded-sm border border-slate-200 bg-slate-50 p-4 text-slate-800">
              <p className="text-xs font-semibold text-slate-900">Key terms at a glance</p>
              <div className="mt-3 grid gap-2">
                {(highlights.length ? highlights : ['Policy scope', 'Firm-owned data', 'Support contact']).map((item) => (
                  <div key={item} className="rounded-xs border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <nav aria-label="Legal pages" className="mt-6 border-t border-slate-100 pt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {LEGAL_LINKS.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-xs border px-3 py-2 text-center text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900 active:bg-slate-800 ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {sections && sections.length > 0 && (
            <nav
              aria-label="Table of contents"
              className="w-full rounded-sm border border-slate-200 bg-white p-4 shadow-subtle lg:sticky lg:top-24 lg:self-start"
            >
              <p className="mb-3 text-xs font-semibold text-slate-500">
                Sections on this page
              </p>
              <ul className="space-y-1">
                {sections.map(({ id, label }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`block w-full break-words rounded-xs px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900 active:bg-slate-200 ${
                        activeId === id
                          ? 'bg-slate-900 font-semibold text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <main className="min-w-0 w-full rounded-sm border border-slate-200 bg-white p-6 sm:p-8 text-sm leading-relaxed text-slate-700 shadow-subtle">
            {children}

            <footer className="mt-10 rounded-sm border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              <p>Operated by <strong className="text-slate-800">{COMPANY_NAME}</strong></p>
              <p className="mt-1">{`Legal Version ${LEGAL_VERSION} • ${LAST_UPDATED}`}</p>
            </footer>
          </main>
        </div>
      </PageContainer>
    </article>
  );
};
