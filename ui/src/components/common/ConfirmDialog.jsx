/**
 * Confirmation Dialog Component
 * For destructive actions requiring explicit user confirmation
 */

import React from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

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
}) => (
  <Modal
    isOpen={isOpen}
    onClose={loading ? () => {} : onCancel}
    title={title}
    actions={(
      <>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
          disabled={loading}
          data-modal-primary="true"
        >
          {confirmText}
        </Button>
      </>
    )}
  >
    <p className="text-sm leading-6 text-[var(--dt-text-secondary)]">{message}</p>
  </Modal>
);
