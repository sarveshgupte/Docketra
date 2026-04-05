import React from 'react';
import { Button } from '../common/Button';

export const DocketActions = React.memo(({ actions = [], loadingAction }) => {
  if (!actions.length) return null;
  const lifecycleKeys = ['pend', 'resolve', 'file'];
  const ownershipKeys = ['assign', 'move_wb', 'move_wl'];
  const lifecycleActions = actions.filter((action) => lifecycleKeys.includes(action.key));
  const ownershipActions = actions.filter((action) => ownershipKeys.includes(action.key) || !lifecycleKeys.includes(action.key));

  return (
    <div className="docket-action-bar sticky bottom-4 z-20 mt-6" aria-label="Docket quick actions">
      {lifecycleActions.length > 0 ? (
        <div className="docket-action-bar__group" role="group" aria-label="Lifecycle actions">
          {lifecycleActions.map((action) => (
            <Button
              key={action.key}
              variant={action.variant || 'outline'}
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
              loading={loadingAction === action.key}
              className="docket-action-bar__button"
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
      {lifecycleActions.length > 0 && ownershipActions.length > 0 ? (
        <div className="docket-action-bar__divider" aria-hidden="true" />
      ) : null}
      {ownershipActions.length > 0 ? (
        <div className="docket-action-bar__group" role="group" aria-label="Ownership actions">
          {ownershipActions.map((action) => (
            <Button
              key={action.key}
              variant={action.variant || 'outline'}
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
              loading={loadingAction === action.key}
              className="docket-action-bar__button"
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
