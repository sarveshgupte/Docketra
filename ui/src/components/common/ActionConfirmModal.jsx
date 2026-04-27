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
import { Modal } from './Modal';

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
}) => (
  <Modal
    isOpen={isOpen}
    onClose={loading ? () => {} : onCancel}
    title={title}
    maxWidth="sm"
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
    {description ? (
      <p className="whitespace-pre-line text-sm leading-6 text-[var(--dt-text-secondary)]">{description}</p>
    ) : null}
  </Modal>
);
