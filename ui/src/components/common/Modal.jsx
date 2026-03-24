/**
 * Modal Component
 */

import React, { useEffect, useMemo, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  large: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
}) => {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  const modalSizeClass = useMemo(() => sizeClasses[size] || sizeClasses.md, [size]);

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
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4 sm:p-6"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl ${modalSizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            aria-label="Close modal"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {actions ? (
          <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
};
