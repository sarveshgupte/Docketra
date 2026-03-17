import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
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
      <div className="admin__header">
        <h1 className="neo-page__title">All Clients</h1>
      </div>
      <Card>
        {loading ? <Loading message="Loading clients..." /> : (
          <table className="neo-table">
            <thead>
              <tr>
                <th>Client ID</th><th>Business Name</th><th>Email</th><th>Status</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.clientId}>
                  <td>{client.clientId}</td>
                  <td>{client.businessName}</td>
                  <td>{client.businessEmail || '—'}</td>
                  <td><Badge status={client.status === 'ACTIVE' ? 'Approved' : 'Rejected'}>{client.status}</Badge></td>
                  <td>{formatDate(client.createdAt)}</td>
                  <td className="admin__actions">
                    <Button size="small" onClick={() => navigate(`/app/firm/${firmSlug}/clients/${client.clientId}`)}>Workspace</Button>
                    <Button size="small" variant="warning" onClick={() => navigate(`/app/firm/${firmSlug}/clients/${client.clientId}/cfs`)}>Edit CFS</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Layout>
  );
};
