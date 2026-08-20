import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { DataTable } from '../../../components/common/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { getNormalizedUserStatus, isPrimaryAdminUser, getRoleBadgePresentation, requiresPasswordSetup } from '../adminPageUtils';
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
  onLock,
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
        <EmptyState title="No team members added yet" description="Invite your team to start collaborating." />
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: 'User Name', render: (u) => <span className="font-medium text-gray-900">{u.name}</span> },
            { key: 'email', header: 'Email' },
            {
              key: 'role',
              header: 'Role',
              render: (u) => {
                const badge = getRoleBadgePresentation({ role: u.role, isPrimaryAdmin: u.isPrimaryAdmin, isSystem: u.isSystem });
                const isPrimary = u.isPrimaryAdmin || u.role === 'PRIMARY_ADMIN';
                const isAdmin = u.role === 'ADMIN';
                const isManager = u.role === 'MANAGER';
                const badgeStyle = isPrimary
                  ? 'bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold'
                  : isAdmin
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-medium'
                    : isManager
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/80 font-medium'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80 font-medium';

                return (
                  <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs ${badgeStyle}`}>
                    {badge.label}
                  </span>
                );
              },
            },
            { key: 'status', header: 'Status', render: (u) => <AdminStatusBadge status={u.status} /> },
            {
              key: 'qcRate',
              header: 'QC Rate',
              render: (u) => {
                const hasRate = u.qcSamplingRate !== undefined && u.qcSamplingRate !== null;
                return (
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${hasRate ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                    {hasRate ? `${u.qcSamplingRate}%` : 'Default'}
                  </span>
                );
              }
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (u) => {
                const status = getNormalizedUserStatus(u);
                const setupPending = requiresPasswordSetup(u);
                const isActionLoading = Boolean(actionLoadingByUser[u.xID]);
                return (
                  <div className="flex justify-end gap-2" style={{ flexWrap: 'wrap' }}>
                    {canCreateUsers ? (
                      <Button size="sm" variant="outline" onClick={() => onEditUser(u)} disabled={isActionLoading}>Edit Access</Button>
                    ) : null}
                    {setupPending ? (
                      <Button size="sm" variant="default" onClick={() => onResendInvite(u.xID)} disabled={isActionLoading}>Send Setup Link</Button>
                    ) : null}
                    {(!isPrimaryAdminUser(u) && u.role !== 'PRIMARY_ADMIN') ? (
                      u.lockedByAdmin ? (
                        <Button size="sm" variant="outline" onClick={() => onUnlock(u)} disabled={isActionLoading}>Unlock</Button>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => onLock(u.xID)} disabled={isActionLoading}>Lock</Button>
                      )
                    ) : null}
                    {!setupPending ? (
                      <Button size="sm" variant="outline" onClick={() => onResetPassword(u)} disabled={isActionLoading}>Reset Password</Button>
                    ) : null}
                    {canCreateUsers ? (
                      <Button
                        size="sm"
                        variant={status === 'active' ? 'danger' : 'default'}
                        disabled={isPrimaryAdminUser(u) || isActionLoading}
                        onClick={() => onToggleUserStatus(u)}
                      >
                        {setupPending ? 'Cancel Invite' : (status === 'active' ? 'Deactivate' : 'Activate')}
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
