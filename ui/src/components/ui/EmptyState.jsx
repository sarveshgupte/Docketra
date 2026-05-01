import React from 'react';
import { Button } from '../common/Button';

const DefaultEmptyStateIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 6.5h14" />
    <path d="M5 12h14" />
    <path d="M5 17.5h8" />
  </svg>
);

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  const resolvedIcon = icon === true ? DefaultEmptyStateIcon : icon;
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <div className="ui-empty-state" role="status">
      {resolvedIcon ? (
        <div className="ui-empty-state__icon mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dt-surface-muted)] text-[var(--dt-text-muted)]" aria-hidden="true">
          {resolvedIcon}
        </div>
      ) : null}
      <div className="ui-empty-state__content">
        <h3 className="ui-empty-state__title">{title}</h3>
        <p className="ui-empty-state__description">{description}</p>
      </div>
      {hasAction ? (
        <div className="ui-empty-state__actions">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
