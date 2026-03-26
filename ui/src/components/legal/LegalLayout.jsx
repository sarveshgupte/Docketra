import React, { useEffect, useRef, useState } from 'react';
import { LEGAL_VERSION, LAST_UPDATED, COMPANY_NAME, COMPANY_CIN } from '../../lib/legalVersion';
import { PageContainer } from '../layout/PageContainer';

export const LegalLayout = ({ title, description, sections, children }) => {
  const [activeId, setActiveId] = useState('');
  const observerRef = useRef(null);
  const containerRef = useRef(null);

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
    <PageContainer as="article" className="relative" ref={containerRef}>
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && (
          <p className="mt-2 w-full text-sm leading-relaxed text-slate-600">{description}</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Version {LEGAL_VERSION} &mdash; Last Updated: {LAST_UPDATED}
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-4">
        {sections && sections.length > 0 && (
          <nav
            aria-label="Table of contents"
            className="mb-8 w-full md:col-span-1 md:mb-0 md:max-w-sm md:sticky md:top-8 md:self-start"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Contents
            </p>
            <ul className="space-y-1">
              {sections.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`block w-full break-words rounded px-2 py-1 text-sm transition-colors ${
                      activeId === id
                        ? 'bg-slate-100 font-medium text-slate-900'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main className="min-w-0 w-full space-y-10 text-slate-700 md:col-span-3">
          {children}

          <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400">
            <p>Operated by <strong className="text-slate-600">{COMPANY_NAME}</strong></p>
            <p className="mt-1">CIN: {COMPANY_CIN}</p>
            <p className="mt-1">Legal Version {LEGAL_VERSION} &mdash; {LAST_UPDATED}</p>
          </footer>
        </main>
      </div>
    </PageContainer>
  );
};
