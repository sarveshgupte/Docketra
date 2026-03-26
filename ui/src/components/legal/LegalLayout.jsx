import React, { useEffect, useRef, useState } from 'react';
import { LEGAL_VERSION, LAST_UPDATED, COMPANY_NAME, COMPANY_CIN } from '../../lib/legalVersion';
import { PageContainer } from '../layout/PageContainer';
import { PageHeader } from '../layout/PageHeader';

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
      <PageHeader
        title={title}
        description={description}
        meta={`Version ${LEGAL_VERSION} — Last Updated: ${LAST_UPDATED}`}
      />

      <div className="grid w-full grid-cols-1 gap-section md:grid-cols-[240px_1fr]">
        {sections && sections.length > 0 && (
          <nav
            aria-label="Table of contents"
            className="mb-section w-full md:mb-0 md:w-[240px] md:flex-shrink-0 md:sticky md:top-8 md:self-start"
          >
            <p className="mb-3 text-meta font-semibold uppercase tracking-wider text-text-muted">
              Contents
            </p>
            <ul className="space-y-1">
              {sections.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`block w-full break-words rounded px-2 py-1 text-body transition-colors ${
                      activeId === id
                        ? 'bg-surface font-medium text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main className="min-w-0 w-full space-y-section text-text-secondary">
          {children}

          <footer className="mt-12 border-t border-border pt-6 text-meta text-text-muted">
            <p>Operated by <strong className="text-text-secondary">{COMPANY_NAME}</strong></p>
            <p className="mt-1">CIN: {COMPANY_CIN}</p>
            <p className="mt-1">Legal Version {LEGAL_VERSION} &mdash; {LAST_UPDATED}</p>
          </footer>
        </main>
      </div>
    </PageContainer>
  );
};
