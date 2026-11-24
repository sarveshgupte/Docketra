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
        {onRetry ? <button type="button" onClick={onRetry} className="ml-1.5 underline underline-offset-2 font-medium hover:text-rose-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 rounded cursor-pointer">Retry</button> : null}
      </span>
    );
  }

  return (
    <span className="save-indicator save-indicator--saved" role="status">
      Saved at {formatDateTime(time)}
    </span>
  );
};
