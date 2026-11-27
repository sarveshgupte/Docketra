import { formatDateTime } from '../../utils/formatDateTime';
import { SupportContext } from '../../components/feedback/SupportContext';

const formatLockOwner = (lockStatus) => {
  const name = lockStatus?.activeUserDisplayName;
  const xid = lockStatus?.activeUserXID;
  if (name && xid) return `${name} (${xid})`;
  return name || xid || lockStatus?.activeUserEmail || 'another user';
};

export const CaseDetailAlerts = ({
  actionError,
  caseInfo,
  caseId,
  user,
  isViewOnlyMode,
  retryQueueCount = 0,
}) => {
  const lockedByOther = Boolean(caseInfo?.lockStatus?.isLocked)
    && caseInfo?.lockStatus?.activeUserEmail !== user?.email?.toLowerCase();

  return (
    <>
      {actionError ? (
        <div className="neo-alert neo-alert--danger case-detail__alert" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{actionError.message}</span>
            {actionError.retry ? (
              <button type="button" className="case-detail__retry" onClick={actionError.retry}>
                Retry
              </button>
            ) : null}
          </div>
          <SupportContext context={actionError.supportContext} className="mt-2" />
        </div>
      ) : null}

      {retryQueueCount > 0 ? (
        <div className="neo-alert neo-alert--info case-detail__alert" role="status">
          <strong>Offline Sync Pending</strong> — {retryQueueCount} action{retryQueueCount === 1 ? '' : 's'} queued and will sync automatically when reconnected.
        </div>
      ) : null}

      {caseInfo?.stage?.requiresApproval === true && isViewOnlyMode ? (
        <div className="neo-alert neo-alert--info case-detail__alert" role="note">
          <strong>Role Restricted Action</strong> — Approval for this lifecycle stage requires Manager, Admin, or Primary Admin access.
        </div>
      ) : null}

      {lockedByOther ? (
        <div className="neo-alert neo-alert--warning case-detail__alert" role="status">
          <strong>Docket {caseInfo?.caseId || caseId} is locked</strong>{' '}
          by {formatLockOwner(caseInfo.lockStatus)} since{' '}
          {formatDateTime(caseInfo.lockStatus.lastActivityAt || caseInfo.lockStatus.lockedAt)}.
        </div>
      ) : null}
    </>
  );
};
