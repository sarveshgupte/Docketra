import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, InlineNotice, PageSection, RefreshNotice, StatGrid, toArray } from './PlatformShared';

const leadNeedsFollowUp = (lead) => {
  if (!lead?.nextFollowUpAt) return false;
  return new Date(lead.nextFollowUpAt).getTime() <= Date.now();
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

export const PlatformCrmPage = () => {
  const { firmSlug } = useParams();
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = async ({ background = false } = {}) => {
    if (background && (clients.length > 0 || leads.length > 0)) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [clientRes, leadRes] = await Promise.all([
        crmApi.listClients({ limit: 50 }),
        crmApi.listLeads({ limit: 50 }),
      ]);
      setClients(toArray(clientRes?.data?.data || clientRes?.data?.items || clientRes?.data));
      setLeads(toArray(leadRes?.data?.data || leadRes?.data?.items || leadRes?.data));
    } catch {
      setClients([]);
      setLeads([]);
      setError('Unable to load CRM overview right now.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [clients]
  );

  const recentlyAdded = sortedClients.slice(0, 5);
  const recentlyUpdated = useMemo(
    () => [...clients].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()).slice(0, 5),
    [clients]
  );
  const leadsNeedingFollowUp = useMemo(() => leads.filter(leadNeedsFollowUp).slice(0, 5), [leads]);

  const cards = [
    { label: 'Total clients', value: loading ? '…' : clients.length },
    { label: 'Active clients', value: loading ? '…' : clients.filter((client) => String(client.status || '').toLowerCase() === 'active').length },
    { label: 'Leads count', value: loading ? '…' : leads.length },
    { label: 'Recently added clients', value: loading ? '…' : recentlyAdded.length },
  ];

  return (
    <PlatformShell
      moduleLabel="CRM / Relationship Management"
      title="CRM"
      subtitle="Relationship and client management hub for pipeline visibility, follow-up, and conversion readiness."
      actions={<button type="button" onClick={() => void loadData({ background: true })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
    >
      <InlineNotice tone="error" message={error} />
      <RefreshNotice refreshing={refreshing} message="Refreshing CRM overview in the background…" />
      <StatGrid items={cards} />

      <PageSection title="Quick actions" description="Use CRM as your summary + routing hub; creation flows remain in Client Management and Leads.">
        <div className="action-row">
          <Link to={ROUTES.CRM_CLIENTS(firmSlug)}>Add Client</Link>
          <Link to={ROUTES.CRM_CLIENTS(firmSlug)}>Import Clients CSV</Link>
          <Link to={ROUTES.CRM_LEADS(firmSlug)}>Go to Leads</Link>
        </div>
      </PageSection>

      <PageSection title="CRM areas" description="Open the right CRM surface quickly.">
        <div className="tile-grid">
          <Link className="module-tile" to={ROUTES.CRM_CLIENTS(firmSlug)}>
            <strong>Client Management</strong>
            <span>Client records, profile details, and linked docket context.</span>
          </Link>
          <Link className="module-tile" to={ROUTES.CRM_LEADS(firmSlug)}>
            <strong>Leads</strong>
            <span>Pipeline stages, follow-up tracking, and conversion.</span>
          </Link>
        </div>
      </PageSection>

      <PageSection title="Recently added clients" description="Latest clients created in CRM.">
        <DataTable
          columns={['Client', 'Email', 'Phone', 'Created']}
          rows={recentlyAdded.map((client) => (
            <tr key={client._id || client.id}>
              <td>{client.businessName || client.name || '-'}</td>
              <td>{client.businessEmail || client.email || '-'}</td>
              <td>{client.primaryContactNumber || client.phone || '-'}</td>
              <td>{formatDate(client.createdAt)}</td>
            </tr>
          ))}
          loading={loading}
          error={error}
          onRetry={() => void loadData()}
          emptyLabel="No CRM clients yet. Add your first client from Client Management."
          pageSize={5}
        />
      </PageSection>

      <PageSection title="Recently updated clients" description="Clients with recent changes.">
        <DataTable
          columns={['Client', 'Status', 'Last updated']}
          rows={recentlyUpdated.map((client) => (
            <tr key={`updated-${client._id || client.id}`}>
              <td>{client.businessName || client.name || '-'}</td>
              <td>{String(client.status || 'active').replace('_', ' ')}</td>
              <td>{formatDate(client.updatedAt || client.createdAt)}</td>
            </tr>
          ))}
          loading={loading}
          error={error}
          onRetry={() => void loadData()}
          emptyLabel="No recent client updates yet."
          pageSize={5}
        />
      </PageSection>

      <PageSection title="Leads needing follow-up" description="Overdue or due-now follow-up commitments.">
        <DataTable
          columns={['Lead', 'Stage', 'Next follow-up', 'Owner']}
          rows={leadsNeedingFollowUp.map((lead) => (
            <tr key={`follow-up-${lead._id || lead.id}`}>
              <td>{lead.name || '-'}</td>
              <td>{String(lead.stage || lead.status || 'new').replace('_', ' ')}</td>
              <td>{formatDate(lead.nextFollowUpAt)}</td>
              <td>{lead.ownerXid || lead.assignedTo || '-'}</td>
            </tr>
          ))}
          loading={loading}
          error={error}
          onRetry={() => void loadData()}
          emptyLabel="No follow-up items are currently due."
          pageSize={5}
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCrmPage;
