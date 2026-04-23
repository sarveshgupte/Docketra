import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { crmApi } from '../../api/crm.api';
import { ROUTES, safeRoute } from '../../constants/routes';
import { resolveCrmErrorMessage } from '../crm/crmUiUtils';
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
  const [invoices, setInvoices] = useState([]);

  const loadData = async ({ background = false } = {}) => {
    if (background && (clients.length > 0 || leads.length > 0)) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [clientResult, leadResult, invoiceResult] = await Promise.allSettled([
        crmApi.listClients({ limit: 50 }),
        crmApi.listLeads({ limit: 50 }),
        crmApi.listInvoices({ limit: 100 }),
      ]);

      const nextClients = clientResult.status === 'fulfilled'
        ? toArray(clientResult.value?.data?.data || clientResult.value?.data?.items || clientResult.value?.data)
        : [];
      const nextLeads = leadResult.status === 'fulfilled'
        ? toArray(leadResult.value?.data?.data || leadResult.value?.data?.items || leadResult.value?.data)
        : [];
      const nextInvoices = invoiceResult.status === 'fulfilled'
        ? toArray(invoiceResult.value?.data?.data || invoiceResult.value?.data?.items || invoiceResult.value?.data)
        : [];

      setClients(nextClients);
      setLeads(nextLeads);
      setInvoices(nextInvoices);

      const failedCalls = [clientResult, leadResult, invoiceResult].filter((result) => result.status === 'rejected');
      if (failedCalls.length > 0) {
        if (failedCalls.length === 3) {
          const rootError = failedCalls[0].reason;
          setError(resolveCrmErrorMessage(rootError, 'Unable to load CRM overview right now.'));
        } else {
          setError('Some CRM overview data could not be loaded right now. Showing available data.');
        }
      }
    } catch (loadError) {
      setClients([]);
      setLeads([]);
      setInvoices([]);
      setError(resolveCrmErrorMessage(loadError, 'Unable to load CRM overview right now.'));
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

  const stageCounts = useMemo(() => leads.reduce((acc, lead) => {
    const key = String(lead.stage || lead.status || 'new').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [leads]);
  const overdueFollowUps = useMemo(() => leads.filter(leadNeedsFollowUp).length, [leads]);
  const clientsAddedLast7Days = useMemo(
    () => clients.filter((client) => {
      if (!client.createdAt) return false;
      return new Date(client.createdAt).getTime() >= Date.now() - (7 * 24 * 60 * 60 * 1000);
    }).length,
    [clients]
  );
  const unpaidInvoices = useMemo(
    () => invoices.filter((invoice) => !['paid', 'PAID'].includes(String(invoice.status || '').trim())).length,
    [invoices]
  );

  const cards = [
    { label: 'Leads · new', value: loading ? '…' : (stageCounts.new || 0) },
    { label: 'Leads · contacted', value: loading ? '…' : (stageCounts.contacted || 0) },
    { label: 'Overdue follow-ups', value: loading ? '…' : overdueFollowUps },
    { label: 'Clients added (7d)', value: loading ? '…' : clientsAddedLast7Days },
    { label: 'Unpaid invoices', value: loading ? '…' : unpaidInvoices },
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
      <PageSection
        title="What this module is for"
        description="CRM tracks lead-to-client progression. If this page is empty, start by creating your first client or lead."
      >
        <p className="muted">Client records also power clearer docket context and reporting readiness.</p>
      </PageSection>

      <PageSection title="Quick actions" description="Use CRM as your summary + routing hub; creation flows remain in Client Management and Leads.">
        <div className="action-row">
          <Link to={safeRoute(`${ROUTES.CRM_CLIENTS(firmSlug)}?action=new`)}>New Client</Link>
          <Link to={safeRoute(ROUTES.CRM_LEADS(firmSlug))}>Go to Leads Queue</Link>
          <Link to={safeRoute(ROUTES.CRM_CLIENTS(firmSlug))}>Open Client Management</Link>
        </div>
      </PageSection>

      <PageSection title="CRM areas" description="Open the right CRM surface quickly.">
        <div className="tile-grid">
          <Link className="module-tile" to={safeRoute(ROUTES.CRM_CLIENTS(firmSlug))}>
            <strong>Client Management</strong>
            <span>Client records, profile details, and linked docket context.</span>
          </Link>
          <Link className="module-tile" to={safeRoute(ROUTES.CRM_LEADS(firmSlug))}>
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
          emptyLabel="No recent client updates yet. Add or edit a client record to start tracking updates."
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
          emptyLabel="No follow-up items are currently due. New leads or scheduled follow-ups will appear here."
          pageSize={5}
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformCrmPage;
