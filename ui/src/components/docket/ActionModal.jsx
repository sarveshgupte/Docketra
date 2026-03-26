import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Textarea } from '../common/Textarea';

export const ActionModal = ({
  isOpen,
  title,
  comment,
  setComment,
  commentRequired = true,
  submitLabel,
  submitting,
  onClose,
  onSubmit,
  children,
  disabled = false,
}) => {
  const blocked = disabled || (commentRequired && !comment.trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      actions={(
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} disabled={blocked || submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Textarea
          label={`Comment${commentRequired ? ' (Required)' : ' (Optional)'}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          required={commentRequired}
        />
        {children}
      </div>
    </Modal>
  );
};
