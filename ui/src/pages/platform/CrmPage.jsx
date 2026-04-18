import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, FilterBar, InlineNotice, PageSection, toArray } from './PlatformShared';

export const PlatformCrmPage = () => {
  const { firmSlug } = useParams();
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClients = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await crmApi.listClients({ limit: 50 });
      setClients(toArray(res?.data?.data || res?.data?.items));
    } catch {
      setClients([]);
      setError('Unable to load CRM clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) => [client.name, client.clientName, client.email, client.phone]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [clients, query]);

  return (
    <PlatformShell
      title="CRM"
      subtitle="Client portfolio and operational docket relationships"
      actions={<Link to={ROUTES.CLIENTS(firmSlug)}>Client workspace</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <PageSection title="Clients" description="Access client records and related dockets quickly.">
        <FilterBar onClear={() => setQuery('')} clearDisabled={!query}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search client name, email, phone"
            aria-label="Search clients"
          />
          <button type="button" onClick={() => void loadClients()} disabled={loading}>Refresh</button>
        </FilterBar>

        <DataTable
          columns={['Client', 'Email', 'Phone', 'Total Dockets', 'Actions']}
          rows={filteredClients.map((client) => (
            <tr key={client._id || client.id}>
              <td>
                <Link className="action-primary" to={ROUTES.CRM_CLIENT_DETAIL(firmSlug, client._id || client.id)}>
                  {client.name || client.clientName || '-'}
                </Link>
              </td>
              <td>{client.email || '-'}</td>
              <td>{client.phone || '-'}</td>
              <td>{client.totalDockets || 0}</td>
              <td>
                <div className="action-group-secondary" role="group" aria-label="Client actions">
                  <Link to={ROUTES.CASES(firmSlug)}>View dockets</Link>
                </div>
              </td>
            </tr>
          ))}
          loading={loading}
          error={error}
          emptyLabel="No CRM clients match the current filters."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCrmPage;
