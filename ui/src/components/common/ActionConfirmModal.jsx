/**
 * ActionConfirmModal
 * Reusable confirmation modal for operational actions.
 * Replaces browser-native window.confirm() dialogs.
 *
 * Usage:
 *   <ActionConfirmModal
 *     isOpen={showModal}
 *     title="Assign Cases"
 *     description="Assign 7 selected cases to yourself?"
 *     onConfirm={handleAssign}
 *     onCancel={() => setShowModal(false)}
 *   />
 */

import React from 'react';
import { Button } from './Button';

export const ActionConfirmModal = ({
  isOpen,
  title = 'Confirm Action',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
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
    <div className="neo-modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="action-confirm-title">
      <div className="neo-modal" style={{ maxWidth: '480px' }}>
        <div className="neo-modal__header" id="action-confirm-title">{title}</div>
        {description && (
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <p className="text-body">{description}</p>
          </div>
        )}
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
