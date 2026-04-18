import React, { useEffect, useRef, useState } from 'react';
import { LEGAL_VERSION, LAST_UPDATED, COMPANY_NAME } from '../../lib/legalVersion';
import { PageContainer } from '../layout/PageContainer';
import { PageHeader } from '../layout/PageHeader';
import { spacingClasses } from '../../theme/tokens';

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

      <div className="grid grid-cols-1 gap-12 md:grid-cols-[240px_1fr]">
        {sections && sections.length > 0 && (
          <nav
            aria-label="Table of contents"
            className="mb-12 w-full md:mb-0 md:w-[240px] md:flex-shrink-0 md:sticky md:top-8 md:self-start"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Contents
            </p>
            <ul className="space-y-1">
              {sections.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`block w-full break-words rounded px-2 py-1 text-sm text-gray-600 transition-colors ${
                      activeId === id
                        ? 'bg-surface font-medium text-gray-900'
                        : 'hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main className={`min-w-0 w-full ${spacingClasses.sectionMargin} text-sm text-gray-700 leading-relaxed`}>
          {children}

          <footer className="mt-12 border-t border-gray-200 pt-6 text-xs text-gray-400">
            <p>Operated by <strong className="text-gray-700">{COMPANY_NAME}</strong></p>
            <p className="mt-1">Legal Version {LEGAL_VERSION} &mdash; {LAST_UPDATED}</p>
          </footer>
        </main>
      </div>
    </PageContainer>
  );
};
