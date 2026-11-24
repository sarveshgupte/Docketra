/**
 * ActionConfirmModal
 * Reusable confirmation modal for operational actions.
 * Supports standard click confirmations as well as Kokonut UI slide-to-confirm
 * and hold-button for high-stakes compliance actions.
 */

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { HoldButton, SlideToConfirm } from '../kokonutui';
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
  slide = false,
  hold = false,
  className = '',
}) => {
  const renderActions = () => {
    if (slide) {
      return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <SlideToConfirm
            label={confirmText}
            doneLabel="Confirmed"
            onConfirm={onConfirm}
            disabled={loading}
            className="w-full sm:max-w-[260px]"
          />
        </div>
      );
    }

    if (hold) {
      return (
        <div className="flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <HoldButton
            variant={danger ? 'red' : 'compliance'}
            size="sm"
            onHoldComplete={onConfirm}
            disabled={loading}
          >
            {confirmText}
          </HoldButton>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2.5">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          loading={loading}
          disabled={loading}
          data-modal-primary="true"
        >
          {confirmText}
        </Button>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onCancel}
      title={title}
      maxWidth="sm"
      className={className}
      actions={renderActions()}
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
};
