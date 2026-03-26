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
  action,
  actionLabel,
  onAction,
  children,
  icon,
}) => {
  const resolvedAction = action || (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : null);
  const resolvedIcon = icon === true ? DefaultEmptyStateIcon : icon;

  return (
    <div className="ui-empty-state" role="status">
      {resolvedIcon ? (
        <div className="ui-empty-state__icon mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500" aria-hidden="true">
          {resolvedIcon}
        </div>
      ) : null}
      <div className="ui-empty-state__content">
        <h3 className="ui-empty-state__title">{title}</h3>
        {description ? <p className="ui-empty-state__description">{description}</p> : null}
      </div>
      {children ? <div className="ui-empty-state__actions">{children}</div> : null}
      {!children && resolvedAction ? (
        <div className="ui-empty-state__actions">
          <Button variant="primary" onClick={resolvedAction.onClick}>
            {resolvedAction.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
