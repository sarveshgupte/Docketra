/**
 * InlineStatutoryCitation Component
 * Adapted from Kokonut UI inline citation components with /better-interface polish:
 * - Interactive statutory reference pill that lives seamlessly inside legal text
 * - Floating accessible popover with legislative extract, rule title, and copy button
 * - Keyboard navigable (Enter / Space to toggle, Esc to dismiss)
 * - Optical alignment matching font metrics and line-heights without layout shifts
 */

import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Copy, Check, ExternalLink, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const InlineStatutoryCitation = ({
  act = 'Companies Act, 2013',
  section = 'Sec 135(5)',
  title = 'Corporate Social Responsibility Expenditure',
  excerpt = 'The Board shall ensure that the company spends, in every financial year, at least two per cent of the average net profits of the company made during the three immediately preceding financial years.',
  notificationRef,
  url,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      const text = `${act} - ${section}: ${title}\n\n"${excerpt}"${notificationRef ? `\n\nRef: ${notificationRef}` : ''}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <span ref={containerRef} className="relative inline-block align-baseline">
      <button
        type="button"
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium align-baseline',
          'border transition-[background-color,border-color,color] duration-150 cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900',
          isOpen
            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
            : 'bg-indigo-50/80 text-indigo-900 border-indigo-200/80 hover:bg-indigo-100/70 hover:border-indigo-300',
          className
        )}
      >
        <BookOpen className="h-2.5 w-2.5 opacity-75 shrink-0" aria-hidden="true" />
        <span>{children || section}</span>
      </button>

      {/* Floating Legislative Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={`${act} ${section}`}
          className="absolute left-0 bottom-full mb-1.5 w-80 sm:w-96 rounded-[var(--dt-radius-card,8px)] border border-slate-200/90 bg-white p-3.5 shadow-xl z-50 text-slate-900 text-left"
        >
          {/* Popover Header */}
          <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200/60">
                  {section}
                </span>
                <span className="text-[11px] font-medium text-slate-500 truncate">
                  {act}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-slate-900 mt-1 leading-snug">
                {title}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 cursor-pointer"
              aria-label="Close citation details"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Statutory Excerpt */}
          <blockquote className="text-xs leading-relaxed text-slate-700 bg-slate-50/70 p-2.5 rounded-[var(--dt-radius-control,4px)] border border-slate-100 italic font-serif">
            "{excerpt}"
          </blockquote>

          {/* Official Gazette / Notification Ref */}
          {notificationRef && (
            <p className="mt-2 text-[10.5px] text-slate-500 font-mono">
              Govt Notification: <span className="font-semibold text-slate-700">{notificationRef}</span>
            </p>
          )}

          {/* Footer Actions */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  <span>Copy Statutory Citation</span>
                </>
              )}
            </button>

            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-900 transition-colors"
              >
                <span>Read e-Gazette</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}
    </span>
  );
};
