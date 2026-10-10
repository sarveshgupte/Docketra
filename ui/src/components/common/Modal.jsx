/**
 * Modal Component
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const sizeClasses = {
  xs: 'max-w-sm',
  small: 'max-w-md',
  sm: 'max-w-md',
  medium: 'max-w-lg',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  large: 'max-w-3xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-7xl',
  '3xl': 'max-w-7xl',
  '4xl': 'max-w-[56rem]',
};

export const Modal = ({
  isOpen,
  onClose,
  onRequestClose,
  title,
  children,
  actions,
  size = 'md',
  maxWidth,
}) => {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const onCloseRef = useRef(onClose);

  const modalSizeClass = useMemo(() => sizeClasses[maxWidth || size] || sizeClasses.md, [maxWidth, size]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = (reason = 'programmatic') => {
    const shouldClose = onRequestClose ? onRequestClose(reason) : true;
    if (shouldClose !== false) {
      onCloseRef.current?.();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previousActiveElementRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const focusableElements = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
    const firstFocusableElement = focusableElements?.[0];

    if (firstFocusableElement instanceof HTMLElement) {
      firstFocusableElement.focus();
    } else {
      modalRef.current?.focus();
    }

    const handleKeyDown = (event) => {
      if (!modalRef.current) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose('escape');
        return;
      }

      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.tagName !== 'TEXTAREA') {
        const primaryAction = modalRef.current.querySelector('[data-modal-primary="true"], .btn-primary, .btn-danger');

        if (primaryAction instanceof HTMLButtonElement && !primaryAction.disabled && event.target !== primaryAction) {
          event.preventDefault();
          primaryAction.click();
          return;
        }
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!focusable.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      requestClose('overlay');
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:items-center sm:p-6"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`relative my-8 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[var(--dt-radius-panel)] border border-slate-200/80 bg-white shadow-modal sm:my-0 ${modalSizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={() => requestClose('close-button')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
            aria-label="Close modal"
            title="Close modal"
          >
            <span aria-hidden="true" className="text-sm leading-none">✕</span>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {actions ? (
          <div className="flex justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};
