/**
 * SmartViewIndicator
 * Displays a subtle contextual message when Docketra automatically
 * selected a smart default view (Overdue → Due Today → My Open).
 *
 * Only shown when:
 *  - the user has no stored view preference (hasStoredView === false)
 *  - a smart default view was applied (not MY_OPEN baseline)
 */

import React from 'react';

const SMART_VIEW_MESSAGES = {
  OVERDUE: (count) =>
    `Showing Overdue dockets because ${count} docket${count !== 1 ? 's' : ''} ${count !== 1 ? 'have' : 'has'} breached SLA.`,
  DUE_TODAY: (count) =>
    `Showing Due Today dockets because ${count} docket${count !== 1 ? 's are' : ' is'} due today.`,
};

/**
 * @param {object}  props
 * @param {boolean} props.hasStoredView   — true when user manually set the view
 * @param {string}  props.activeView      — current view ID
 * @param {number}  props.caseCount       — number of cases in this view
 */
export const SmartViewIndicator = ({ hasStoredView, activeView, caseCount }) => {
  if (hasStoredView) return null;
  if (activeView === 'MY_OPEN') return null;

  const buildMessage = SMART_VIEW_MESSAGES[activeView];
  if (!buildMessage) return null;

  return (
    <div
      className="smart-view-indicator"
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        color: 'var(--text-secondary, #4b5563)',
        background: 'var(--color-surface-subtle, #f9fafb)',
        border: '1px solid var(--color-border, #e5e7eb)',
      }}
    >
      <span aria-hidden="true">ℹ️</span>
      {buildMessage(caseCount)}
    </div>
  );
};
