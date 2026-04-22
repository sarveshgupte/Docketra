import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { DataTable } from '../../../components/common/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/common/Badge';
import { getNormalizedUserStatus, isPrimaryAdminUser, getRoleBadgePresentation } from '../adminPageUtils';

const StatusBadge = ({ status, fallback = 'ACTIVE' }) => {
  const normalizedStatus = String(status || fallback).toUpperCase();
  const map = {
    ACTIVE: 'Approved',
    INVITED: 'Pending',
    INACTIVE: 'Rejected',
    DISABLED: 'Rejected',
  };

  return <Badge status={map[normalizedStatus] || 'Pending'}>{normalizedStatus}</Badge>;
};

export const AdminUsersSection = ({
  users,
  canCreateUsers,
  onBulkUpload,
  onDownloadTemplate,
  onCreateUser,
  onEditUser,
  onResendInvite,
  onToggleUserStatus,
  onUnlock,
  onResetPassword,
  actionLoadingByUser = {},
  sectionMessage,
}) => {
  const hasUsers = users.length > 0;

  return (
    <Card>
      <div className="admin__section-header">
        <div>
          <h2 className="neo-section__header">Team Members</h2>
          <p className="neo-info-text">Use this section to manage people, access, and account safety actions.</p>
        </div>
        <div className="admin__section-actions">
          <Button variant="default" onClick={onBulkUpload}>Bulk Upload</Button>
          <Button variant="default" onClick={onDownloadTemplate}>Download Template</Button>
          <Button variant="primary" onClick={onCreateUser} disabled={!canCreateUsers}>+ Create User</Button>
        </div>
      </div>

      {sectionMessage ? <div className="neo-info-text" style={{ marginBottom: 12 }}>{sectionMessage}</div> : null}

      {!hasUsers ? (
        <EmptyState title="No users added yet" description="Invite your team to start collaborating." />
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: 'User Name', render: (u) => <span className="font-medium text-gray-900">{u.name}</span> },
            { key: 'email', header: 'Email' },
            {
              key: 'role',
              header: 'Role',
              render: (u) => <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">{getRoleBadgePresentation({ role: u.role, isPrimaryAdmin: u.isPrimaryAdmin, isSystem: u.isSystem }).label}</span>,
            },
            { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (u) => {
                const status = getNormalizedUserStatus(u);
                const isActionLoading = Boolean(actionLoadingByUser[u.xID]);
                return (
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {canCreateUsers ? (
                      <Button size="sm" variant="outline" onClick={() => onEditUser(u)} disabled={isActionLoading}>Edit Access</Button>
                    ) : null}
                    {status === 'invited' ? (
                      <Button size="sm" variant="default" onClick={() => onResendInvite(u.xID)} disabled={isActionLoading}>Resend Invite</Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => onUnlock(u.xID)} disabled={isActionLoading}>Unlock</Button>
                    <Button size="sm" variant="outline" onClick={() => onResetPassword(u)} disabled={isActionLoading}>Reset Password</Button>
                    {canCreateUsers ? (
                      <Button
                        size="sm"
                        variant={status === 'active' ? 'danger' : 'default'}
                        disabled={isPrimaryAdminUser(u) || isActionLoading}
                        onClick={() => onToggleUserStatus(u)}
                      >
                        {status === 'invited' ? 'Cancel Invite' : (status === 'active' ? 'Deactivate' : 'Activate')}
                      </Button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
          rows={users}
          rowKey="xID"
        />
      )}
    </Card>
  );
};
