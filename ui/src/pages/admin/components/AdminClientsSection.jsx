import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { DataTable } from '../../../components/common/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { AdminSectionHeader } from './AdminSectionHeader';

const isProtectedClient = (client) => Boolean(client?.isDefaultClient || client?.isSystemClient || client?.isInternal);

export const AdminClientsSection = ({
  clients,
  hasAdditionalClients,
  defaultClients,
  tabError,
  onRetry,
  onBulkUpload,
  onDownloadTemplate,
  onBulkPaste,
  onCreateClient,
  onEditClient,
  onToggleClientStatus,
  StatusBadge,
}) => (
  <Card>
    <AdminSectionHeader
      title="Client Management"
      description="Manage firm clients, profile completeness, and status from one place."
      actions={[
        { key: 'bulk-upload-clients', label: 'Bulk Upload', onClick: onBulkUpload },
        { key: 'download-clients-template', label: 'Download Template', onClick: onDownloadTemplate },
        { key: 'bulk-paste-clients', label: 'Bulk Paste', onClick: onBulkPaste },
        { key: 'create-client', label: '+ Create Client', variant: 'primary', onClick: onCreateClient },
      ]}
    />

    {tabError?.tab === 'clients' ? (
      <EmptyState
        title={tabError.message}
        description="The admin panel is still available. Retry loading clients without leaving this page."
        actionLabel="Retry"
        onAction={onRetry}
      />
    ) : clients.length === 0 ? (
      <EmptyState
        title="No clients created yet"
        description="Create your first client to begin managing dockets and downstream workflows."
      />
    ) : (
      <>
        {!hasAdditionalClients && defaultClients.length > 0 && (
          <p className="text-secondary" style={{ marginBottom: '16px' }}>
            Your firm is set up as the default internal client. Add more clients when you are ready.
          </p>
        )}
        <div className="admin__clients-table-wrap">
          <DataTable
            columns={[
              { key: 'clientId', header: 'Client ID', render: (c) => <span className="font-medium text-gray-900">{c.clientId}</span> },
              { key: 'clientName', header: 'Client Name', render: (c) => c.clientName || '—' },
              { key: 'entityType', header: 'Entity Type', render: (c) => c.entityType || '—' },
              { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
              { key: 'createdAt', header: 'Added On', render: (c) => formatDate(c.createdAt) },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (c) => (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEditClient(c)}>Edit</Button>
                    {!isProtectedClient(c) ? (
                      <Button
                        size="sm"
                        variant={String(c?.status || '').trim().toUpperCase() === 'ACTIVE' ? 'danger' : 'default'}
                        onClick={() => onToggleClientStatus(c)}
                      >
                        {String(c?.status || '').trim().toUpperCase() === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={clients}
            rowKey="_id"
          />
        </div>
      </>
    )}
  </Card>
);
