// NEW
import React from 'react';
import { Button } from '../common/Button';

export const EmptyState = ({ title, description, actionLabel, onAction }) => (
  <div className="ui-empty-state" role="status">
    <h3>{title}</h3>
    {description ? <p>{description}</p> : null}
    {actionLabel && onAction ? (
      <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
    ) : null}
  </div>
);
