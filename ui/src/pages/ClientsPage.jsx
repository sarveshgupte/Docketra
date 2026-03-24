import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { PageHeader } from '../components/layout/PageHeader';
import { DataTable } from '../components/layout/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { clientService } from '../services/clientService';
import { formatDate } from '../utils/formatters';

export const ClientsPage = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await clientService.getClients(false);
        setClients(response?.data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <Layout>
      <PageHeader title="All Clients" description="View and manage all registered client workspaces." />
      <Card>
        {loading ? <Loading message="Loading clients..." /> : (
          <DataTable
            columns={[
              {
                key: 'clientId',
                header: 'Client ID',
                align: 'center',
                tabular: true,
                headerClassName: 'w-[1px] whitespace-nowrap',
                cellClassName: 'w-[1px] whitespace-nowrap',
              },
              {
                key: 'businessName',
                header: 'Business Name',
                headerClassName: 'w-full max-w-lg',
                cellClassName: 'w-full max-w-lg',
                contentClassName: 'truncate',
              },
              {
                key: 'businessEmail',
                header: 'Email',
                headerClassName: 'w-[1px] whitespace-nowrap',
                cellClassName: 'w-[1px] whitespace-nowrap',
                render: (client) => client.businessEmail || '—',
              },
              {
                key: 'status',
                header: 'Status',
                align: 'center',
                headerClassName: 'w-[1px] whitespace-nowrap',
                cellClassName: 'w-[1px] whitespace-nowrap',
                render: (client) => <Badge status={client.status === 'ACTIVE' ? 'Approved' : 'Rejected'}>{client.status}</Badge>,
              },
              {
                key: 'createdAt',
                header: 'Created',
                align: 'right',
                tabular: true,
                headerClassName: 'w-[1px] whitespace-nowrap',
                cellClassName: 'w-[1px] whitespace-nowrap',
                render: (client) => formatDate(client.createdAt),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                headerClassName: 'w-[1px] whitespace-nowrap',
                cellClassName: 'w-[1px] whitespace-nowrap',
                render: (client) => (
                  <div className="admin__actions justify-end">
                    <Button size="small" onClick={() => navigate(`/app/firm/${firmSlug}/clients/${client.clientId}`)}>Workspace</Button>
                    <Button size="small" variant="warning" onClick={() => navigate(`/app/firm/${firmSlug}/clients/${client.clientId}/cfs`)}>Edit CFS</Button>
                  </div>
                ),
              },
            ]}
            data={clients}
            rowKey="clientId"
            emptyContent={(
              <div className="p-8">
                <EmptyState
                  title="No clients available yet"
                  description="Create your first client to begin organizing dockets and workspaces."
                />
              </div>
            )}
          />
        )}
      </Card>
    </Layout>
  );
};
