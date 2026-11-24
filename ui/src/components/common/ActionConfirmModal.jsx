/**
 * ActionConfirmModal
 * Reusable confirmation modal for operational actions.
 * Replaces browser-native window.confirm() dialogs.
 */

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { cn } from '../../lib/utils';

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
  className = '',
}) => (
  <Modal
    isOpen={isOpen}
    onClose={loading ? () => {} : onCancel}
    title={title}
    maxWidth="sm"
    className={className}
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
      <div className="flex items-start gap-3">
        {danger ? (
          <div className="mt-0.5 rounded-full p-1 bg-rose-50 text-rose-600 shrink-0 border border-rose-200/60">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : (
          <div className="mt-0.5 rounded-full p-1 bg-blue-50 text-blue-600 shrink-0 border border-blue-200/60">
            <Info className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
        <p className="whitespace-pre-line text-xs leading-5 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    ) : null}
  </Modal>
);
