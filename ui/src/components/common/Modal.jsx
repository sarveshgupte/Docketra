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

  const sizeStyle = useMemo(() => {
    if (size === 'lg') {
      return { maxWidth: '900px' };
    }

    return { maxWidth: '560px' };
  }, [size]);

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
        const primaryAction = modalRef.current.querySelector('[data-modal-primary="true"], .btn-primary, .neo-btn--primary');

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
      className="neo-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        className="neo-modal"
        style={{
          width: '100%',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'none',
          color: 'var(--text-main)',
          outline: 'none',
          ...sizeStyle,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div
          className="neo-modal__header"
          style={{
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        <div style={{ padding: 'var(--space-4)' }}>{children}</div>
        {actions ? (
          <div
            className="neo-modal__actions"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
              padding: '0 var(--space-4) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
};
