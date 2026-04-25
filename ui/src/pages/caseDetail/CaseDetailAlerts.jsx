import { Button } from '../../components/common/Button';
import { formatDateTime } from '../../utils/formatDateTime';
import { SupportContext } from '../../components/feedback/SupportContext';

export const CaseDetailAlerts = ({
  actionError,
  caseInfo,
  caseId,
  user,
  isViewOnlyMode,
  canAdminMoveAssignedDocket,
  isMoveLockedByAnotherUser,
  lockOwnerLabel,
  assigningCase,
  onOpenAssignModal,
  onMoveToWorkbasket,
  onViewUserWorklist,
  isInactiveWarning,
  docketSlaStatus,
}) => (
  <>
    {actionError ? (
      <div className="neo-alert neo-alert--danger case-detail__alert">
        {actionError.message}{' '}
        {actionError.retry ? (
          <button type="button" className="case-detail__retry" onClick={actionError.retry}>
            Retry
          </button>
        ) : null}
        <SupportContext context={actionError.supportContext} className="mt-2" />
      </div>
    ) : null}
    {caseInfo?.stage?.requiresApproval === true && isViewOnlyMode && (
      <div className="neo-alert neo-alert--info case-detail__alert">
        <strong>Role Restricted Action</strong> — Action restricted: Only Partners can approve this lifecycle stage.
      </div>
    )}
    {canAdminMoveAssignedDocket && (
      <div className="neo-alert neo-alert--info case-detail__alert">
        <strong>Admin Worklist Movement</strong> — Move this docket between user worklists or back to workbasket.
        {isMoveLockedByAnotherUser ? ` Movement is locked while ${lockOwnerLabel} is active in this docket.` : ''}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenAssignModal} disabled={isMoveLockedByAnotherUser || assigningCase}>
            Move to another WL
          </Button>
          <Button variant="outline" onClick={onMoveToWorkbasket} disabled={isMoveLockedByAnotherUser || assigningCase}>
            Move WL → WB
          </Button>
          <Button variant="ghost" onClick={() => onViewUserWorklist(caseInfo?.assignedToXID)}>
            View {caseInfo?.assignedToXID || 'owner'} WL
          </Button>
        </div>
      </div>
    )}
    {caseInfo?.lockStatus?.isLocked &&
      caseInfo?.lockStatus?.activeUserEmail !== user?.email?.toLowerCase() && (
      <div className="neo-alert neo-alert--warning case-detail__alert">
        <strong>Docket {caseInfo?.caseId || caseId} is locked</strong>{' '}
        {(() => {
          const name = caseInfo.lockStatus.activeUserDisplayName;
          const xid = caseInfo.lockStatus.activeUserXID;
          const who = name && xid ? `${name} (${xid})` : name || xid || caseInfo.lockStatus.activeUserEmail;
          return `by ${who}`;
        })()}
        {' '}since{' '}
        {formatDateTime(caseInfo.lockStatus.lastActivityAt || caseInfo.lockStatus.lockedAt)}.
      </div>
    )}
    {isInactiveWarning && (
      <div className="case-detail__inactivity-warning case-detail__alert" role="status">
        ⚠ No activity in 3 days
      </div>
    )}
    {docketSlaStatus === 'RED' ? (
      <div className="neo-alert neo-alert--danger case-detail__alert" role="status">
        <strong>SLA breached</strong> — This docket is overdue and needs attention.
      </div>
    ) : null}
    {docketSlaStatus === 'YELLOW' ? (
      <div className="neo-alert neo-alert--warning case-detail__alert" role="status">
        <strong>SLA at risk</strong> — Less than 24 hours remain on this docket.
      </div>
    ) : null}
  </>
);

