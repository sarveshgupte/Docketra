import React from 'react';

export const ImpersonationBanner = ({ firmName, mode, onExit }) => {
  if (!firmName) return null;

  const isReadOnly = mode === 'READ_ONLY';
  const modeLabel = isReadOnly ? 'Read-Only' : 'Full Access';
  const ariaLabel = isReadOnly
    ? 'Read-only impersonation mode — view only, no changes allowed'
    : 'Full access impersonation mode — changes are allowed';

  return (
    <div
      className="sticky top-0 z-[60] flex w-full items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5"
      role="alert"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <span className="text-sm font-medium text-amber-800" aria-hidden="true">
        {isReadOnly ? '👁' : '✏️'} {modeLabel}
      </span>
      <span className="text-sm font-medium text-amber-800">
        Impersonating <strong>{firmName}</strong>
        {isReadOnly && <span> — no edits permitted</span>}
      </span>
      <button
        type="button"
        onClick={onExit}
        className="ml-4 rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-200"
        aria-label={`Exit impersonation of ${firmName}`}
      >
        Stop Impersonating
      </button>
    </div>
  );
};
