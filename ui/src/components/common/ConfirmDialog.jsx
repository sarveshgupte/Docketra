/**
 * Confirmation Dialog Component
 * For destructive actions requiring explicit user confirmation
 */

import React from 'react';
import { Button } from './Button';

export const ConfirmDialog = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  loading = false,
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  };

  return (
    <div className="neo-modal-overlay" onClick={handleOverlayClick}>
      <div className="neo-modal" style={{ maxWidth: '480px' }}>
        <div className="neo-modal__header">{title}</div>
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <p className="text-body">{message}</p>
        </div>
        <div className="neo-modal__actions">
          <Button 
            variant="secondary" 
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button 
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
