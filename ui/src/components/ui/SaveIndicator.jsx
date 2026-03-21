// NEW
import React from 'react';
import { formatDateTime } from '../../utils/formatDateTime';

export const SaveIndicator = ({ status, time, onRetry }) => {
  if (!status) return null;

  if (status === 'saving') {
    return <span className="save-indicator save-indicator--saving">Saving...</span>;
  }

  if (status === 'error') {
    return (
      <span className="save-indicator save-indicator--error" role="status">
        Save failed.
        {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
      </span>
    );
  }

  return (
    <span className="save-indicator save-indicator--saved" role="status">
      Saved at {formatDateTime(time)}
    </span>
  );
};
