import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, FilterBar, InlineNotice, PageSection, RefreshNotice, toArray } from './PlatformShared';

export const PlatformCrmPage = () => {
  const { firmSlug } = useParams();
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadClients = async ({ background = false } = {}) => {
    if (background && clients.length > 0) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await crmApi.listClients({ limit: 50 });
      setClients(toArray(res?.data?.data || res?.data?.items));
    } catch {
      setClients([]);
      setError('Unable to load CRM clients.');
    } finally {
      setRefreshing(false);
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
      moduleLabel="CRM / Relationship Management"
      title="CRM"
      subtitle="Manage leads, clients, deals, and relationship context linked to execution work."
      actions={<Link to={ROUTES.CLIENTS(firmSlug)}>Client workspace</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <RefreshNotice refreshing={refreshing} message="Refreshing CRM clients in the background…" />
      <PageSection title="CRM surfaces" description="Relationship-management records linked to delivery execution.">
        <div className="action-row">
          <span>Leads</span>
          <span>Clients / Accounts</span>
          <span>Deals</span>
          <span>Invoices</span>
        </div>
      </PageSection>
      <PageSection title="Clients" description="Access client records and related dockets quickly.">
        <FilterBar onClear={() => setQuery('')} clearDisabled={!query}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search client name, email, phone"
            aria-label="Search clients"
          />
          <button type="button" onClick={() => void loadClients({ background: clients.length > 0 })} disabled={loading || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
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
          onRetry={() => void loadClients()}
          hasActiveFilters={Boolean(query.trim())}
          emptyLabel="No CRM clients yet. Add a lead or convert a submission into a client."
          emptyLabelFiltered="No CRM clients match your current search."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCrmPage;
