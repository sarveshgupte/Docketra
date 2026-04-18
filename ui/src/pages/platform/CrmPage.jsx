import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { EmptyState } from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import { crmApi } from '../../api/crm.api';
import { useToast } from '../../hooks/useToast';
import { ROUTES } from '../../constants/routes';
import { DataTable, toArray } from './PlatformShared';

export const PlatformCrmPage = () => {
  const { firmSlug } = useParams();
  const { showError, showSuccess } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.listClients({ limit: 50 });
      setClients(toArray(res?.data || res?.items));
    } catch (loadError) {
      setClients([]);
      setError(loadError?.message || 'Failed to load CRM clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const handleCreateClient = async () => {
    try {
      await crmApi.createClient({ name: 'New Client', email: 'new@example.com' });
      showSuccess('CRM client created.');
      await loadClients();
    } catch (actionError) {
      showError(actionError?.message || 'Failed to create CRM client');
    }
  };

  return (
    <PlatformShell title="CRM" subtitle="Client portfolio and docket relationships">
      {loading ? <TableSkeleton rows={5} showToolbar={false} /> : null}
      {!loading && error ? (
        <EmptyState
          title="Couldn’t load CRM"
          description={error}
          actionLabel="Retry"
          onAction={() => { void loadClients(); }}
          icon
        />
      ) : null}
      {!loading && !error && clients.length === 0 ? (
        <EmptyState
          title="No clients yet (except internal)"
          description="Your firm’s INTERNAL workspace client already exists. Add external clients when you are ready."
          actionLabel="Add external client"
          onAction={() => { void handleCreateClient(); }}
          icon
        />
      ) : null}
      {!loading && !error && clients.length > 0 ? (
        <DataTable columns={['Client Name', 'Email', 'Phone', 'Total Dockets', 'Actions']} rows={clients.map((c) => (
          <tr key={c._id || c.id}><td>{c.name || c.clientName}</td><td>{c.email || '-'}</td><td>{c.phone || '-'}</td><td>{c.totalDockets || 0}</td><td className="action-row"><Link to={ROUTES.CRM_CLIENT_DETAIL(firmSlug, c._id || c.id)}>View client</Link><Link to={ROUTES.CASES(firmSlug)}>See all dockets</Link><button type="button" onClick={() => { void handleCreateClient(); }}>Add client</button></td></tr>
        ))} />
      ) : null}
    </PlatformShell>
  );
};

export default PlatformCrmPage;
