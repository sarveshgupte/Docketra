import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { DataTable } from '../../../components/common/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate } from '../../../utils/formatters';

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
  StatusBadge,
}) => (
  <Card>
    <div className="admin__section-header">
      <h2 className="neo-section__header">Client Management</h2>
      <div className="admin__section-actions">
        <Button variant="default" onClick={onBulkUpload}>Bulk Upload</Button>
        <Button variant="default" onClick={onDownloadTemplate}>Download Template</Button>
        <Button variant="default" onClick={onBulkPaste}>Bulk Paste</Button>
        <Button variant="primary" onClick={onCreateClient}>+ Create Client</Button>
      </div>
    </div>

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
        description="Create your first client to begin managing cases."
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
                render: (c) => (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEditClient(c)}>Edit</Button>
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
