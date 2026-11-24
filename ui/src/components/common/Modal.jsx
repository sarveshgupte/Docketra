/**
 * Enterprise Modal & Dialog Component
 * Built with accessible dialog patterns and shadcn composable primitives:
 * - Focus trapping and focus restoration on unmount
 * - Escape key dismiss and Enter key submit for primary actions
 * - Overscroll containment to lock body scroll without layout shift
 * - Optical alignment with Lucide icons
 * - Full backward compatibility with <Modal isOpen onClose title actions ... />
 * - Exported subcomponents: Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription
 */

import React, { forwardRef, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

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

export const Modal = forwardRef(({
  isOpen,
  onClose,
  onRequestClose,
  title,
  children,
  actions,
  size = 'md',
  maxWidth,
  className = '',
}, ref) => {
  const internalRef = useRef(null);
  const modalRef = ref || internalRef;
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
    const originalOverflow = document.body.style.overflow;
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
        const primaryAction = modalRef.current.querySelector('[data-modal-primary="true"], .btn-primary, .btn-danger, .action-primary');

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
      document.body.style.overflow = originalOverflow || 'unset';
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
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-4 sm:p-6 backdrop-blur-xs motion-safe:transition-opacity duration-150"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={cn(
          'relative m-auto flex max-h-[min(90vh,calc(100vh-3rem))] w-full flex-col overflow-hidden rounded-[var(--dt-radius-panel,8px)] border border-slate-200/90 bg-white shadow-2xl',
          modalSizeClass,
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={() => requestClose('close-button')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 cursor-pointer"
              aria-label="Close modal"
              title="Close modal"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5 text-xs text-slate-700 leading-relaxed">
          {children}
        </div>
        {actions ? (
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
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
});

Modal.displayName = 'Modal';

// Subcomponents for shadcn-style Dialog composition
export const Dialog = Modal;
export const DialogContent = ({ children, className = '', ...props }) => (
  <div className={cn('px-6 py-5', className)} {...props}>{children}</div>
);
export const DialogHeader = ({ children, className = '', ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props}>{children}</div>
);
export const DialogFooter = ({ children, className = '', ...props }) => (
  <div className={cn('flex items-center justify-end gap-2', className)} {...props}>{children}</div>
);
export const DialogTitle = ({ children, className = '', ...props }) => (
  <h2 className={cn('text-xs font-semibold uppercase tracking-wider text-slate-900', className)} {...props}>{children}</h2>
);
export const DialogDescription = ({ children, className = '', ...props }) => (
  <p className={cn('text-xs text-slate-500 leading-relaxed', className)} {...props}>{children}</p>
);
