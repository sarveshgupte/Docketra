import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { DataTable } from '../../../components/common/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { getNormalizedUserStatus, isPrimaryAdminUser, getRoleBadgePresentation } from '../adminPageUtils';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminStatusBadge } from './AdminStatusBadge';


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
      <AdminSectionHeader
        title="Team Members"
        description="Manage users, role-based access, and account safety actions."
        actions={[
          { key: 'bulk-upload-users', label: 'Bulk Upload', onClick: onBulkUpload },
          { key: 'download-users-template', label: 'Download Template', onClick: onDownloadTemplate },
          { key: 'create-user', label: '+ Create User', variant: 'primary', onClick: onCreateUser, disabled: !canCreateUsers },
        ]}
      />

      {sectionMessage ? <div className="mb-3 text-sm text-gray-600">{sectionMessage}</div> : null}

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
            { key: 'status', header: 'Status', render: (u) => <AdminStatusBadge status={u.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (u) => {
                const status = getNormalizedUserStatus(u);
                const isActionLoading = Boolean(actionLoadingByUser[u.xID]);
                return (
                  <div className="flex justify-end gap-2" style={{ flexWrap: 'wrap' }}>
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
