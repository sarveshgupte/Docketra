import React from 'react';
import { Button } from '../common/Button';

const ALLOWED_LIFECYCLE_ACTIONS = {
  WL: [],
  ACTIVE: ['mark_waiting', 'mark_done'],
  WAITING: ['resume_work'],
  DONE: [],
};

const LIFECYCLE_ACTION_KEYS = new Set(['mark_waiting', 'mark_done', 'resume_work', 'pend', 'resolve', 'file', 'move_wl']);
const OWNERSHIP_ACTION_KEYS = new Set(['assign', 'move_wb']);

export const DocketActions = React.memo(({ actions = [], loadingAction, lifecycle = 'WL' }) => {
  if (!actions.length) return null;

  const lifecycleKey = String(lifecycle || 'WL').trim().toUpperCase();
  const allowedLifecycleActions = ALLOWED_LIFECYCLE_ACTIONS[lifecycleKey] || [];
  const lifecycleActions = actions.filter((action) => allowedLifecycleActions.includes(action.key));
  const ownershipActions = actions.filter(
    (action) => OWNERSHIP_ACTION_KEYS.has(action.key) || !LIFECYCLE_ACTION_KEYS.has(action.key),
  );

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
