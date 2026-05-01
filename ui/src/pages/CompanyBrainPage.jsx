import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { crmApi } from '../api/crm.api';
import { dashboardApi } from '../api/dashboard.api';
import { ROUTES } from '../constants/routes';
import { PageSection, StatGrid, StatusMessageStack, toArray } from './platform/PlatformShared';

const fmt = (loading, value, fallback = '—') => (loading ? '…' : (value ?? fallback));

const AttentionRow = ({ label, count, loading, reason, linkTo, linkLabel, emptyMessage }) => {
  const displayCount = fmt(loading, count, 0);
  const isEmpty = !loading && (count === 0 || count === null || count === undefined);
  return (
    <div className="panel attention-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem 1rem' }}>
      <div style={{ minWidth: '2.5rem', textAlign: 'right' }}>
        <span className="kpi" style={{ fontSize: '1.25rem' }}>{displayCount}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
        <p className="muted" style={{ margin: '0.15rem 0 0' }}>
          {isEmpty && emptyMessage ? emptyMessage : reason}
        </p>
      </div>
      {linkTo && linkLabel && !isEmpty ? (
        <Link to={linkTo} style={{ alignSelf: 'center', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{linkLabel} →</Link>
      ) : null}
    </div>
  );
};

const MemoryMapTile = ({ title, description, linkTo }) => (
  <Link
    className="module-tile"
    to={linkTo}
    style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
  >
    <strong>{title}</strong>
    <span>{description}</span>
  </Link>
);

export const CompanyBrainPage = () => {
  const { firmSlug } = useParams();
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadData = async ({ background = false } = {}) => {
    if (background && hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    const [clientsResult, leadsResult, summaryResult] = await Promise.allSettled([
      crmApi.listClients({ limit: 100 }),
      crmApi.listLeads({ limit: 100 }),
      dashboardApi.getSummary({ filter: 'ALL', limit: 20 }),
    ]);

    const nextClients = clientsResult.status === 'fulfilled'
      ? toArray(clientsResult.value?.data?.data || clientsResult.value?.data?.items || clientsResult.value?.data)
      : [];
    const nextLeads = leadsResult.status === 'fulfilled'
      ? toArray(leadsResult.value?.data?.data || leadsResult.value?.data?.items || leadsResult.value?.data)
      : [];
    const nextSummary = summaryResult.status === 'fulfilled' ? (summaryResult.value?.data || null) : null;

    setClients(nextClients);
    setLeads(nextLeads);
    setSummary(nextSummary);

    const failedCalls = [clientsResult, leadsResult, summaryResult].filter((result) => result.status === 'rejected').length;
    if (failedCalls === 3) setError('Company Brain overview is temporarily unavailable. Please refresh to try again.');
    else if (failedCalls > 0) setError('Some Company Brain data could not be loaded. Showing available data.');
    else setError('');

    hasLoadedRef.current = true;
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = Date.now();
  const activeClients = useMemo(() => clients.filter((client) => String(client?.status || 'active').toLowerCase() !== 'inactive').length, [clients]);
  const prospectiveClients = leads.length;
  const activeWork = summary?.myDockets?.total ?? summary?.myDockets?.items?.length ?? null;
  const overdueWork = summary?.overdueDockets?.total ?? summary?.overdueDockets?.items?.length ?? null;
  const pendingReview = summary?.workbasketLoad ? summary.workbasketLoad.reduce((acc, item) => acc + Number(item?.pending || 0), 0) : null;
  const intakeItems = leads.length ? leads.filter((lead) => String(lead?.source || '').toLowerCase().includes('cms')).length : 0;
  const leadsNeedFollowup = leads.filter((lead) => lead?.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= now).length;

  const noFollowupLeads = leads.filter((lead) => !lead?.nextFollowUpAt).length;
  const clientsWithoutOwner = clients.filter((client) => !(client?.ownerXid || client?.assignedTo || client?.ownerId)).length;

  return (
    <PlatformShell
      moduleLabel="Firm Memory"
      title="Company Brain"
      subtitle="Your firm's connected memory for clients, work, follow-ups, documents, and knowledge gaps."
      actions={<button type="button" onClick={() => void loadData({ background: true })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
    >
      <StatusMessageStack messages={[{ tone: 'error', message: error }, { tone: 'info', message: refreshing ? 'Refreshing Company Brain data in the background…' : '' }]} />

      <PageSection>
        <p className="muted">
          Company Brain connects existing Docketra records into one operational view. It does not create or edit data
          here; it helps you see what needs attention.
        </p>
      </PageSection>

      <PageSection title="Attention summary" description="Read-only overview of key firm metrics from available workspace data.">
        <StatGrid items={[
          { label: 'Active clients', value: fmt(loading, activeClients) },
          { label: 'Prospective clients', value: fmt(loading, prospectiveClients) },
          { label: 'Active work', value: fmt(loading, activeWork), helpText: activeWork == null ? 'Will appear when work data is available.' : '' },
          { label: 'Overdue work', value: fmt(loading, overdueWork), helpText: overdueWork == null ? 'Will appear when work data is available.' : '' },
          { label: 'Pending review / QC', value: fmt(loading, pendingReview), helpText: pendingReview == null ? 'Will appear when queue data is available.' : '' },
          { label: 'Knowledge intake items', value: fmt(loading, intakeItems) },
        ]}
        />
      </PageSection>

      <PageSection title="Needs attention" description="Action-oriented signals from available workspace data. Go here to decide what to address next.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <AttentionRow
            label="Prospects without follow-up date"
            count={noFollowupLeads}
            loading={loading}
            reason="These prospects have no scheduled next follow-up and may go cold."
            linkTo={ROUTES.CRM(firmSlug)}
            linkLabel="Relationships"
            emptyMessage="No prospects need follow-up right now."
          />
          <AttentionRow
            label="Prospects needing follow-up now"
            count={leadsNeedFollowup}
            loading={loading}
            reason="Follow-up date has passed for these prospective clients."
            linkTo={ROUTES.CRM(firmSlug)}
            linkLabel="Relationships"
            emptyMessage="No overdue prospect follow-ups found."
          />
          <AttentionRow
            label="Clients without owner"
            count={clientsWithoutOwner}
            loading={loading}
            reason="These clients have no assigned owner, which may affect accountability."
            linkTo={ROUTES.CLIENTS(firmSlug)}
            linkLabel="Clients"
            emptyMessage="All visible clients have owners."
          />
          <AttentionRow
            label="Overdue work"
            count={overdueWork}
            loading={loading}
            reason="Work past its deadline that has not been closed or extended."
            linkTo={ROUTES.TASK_MANAGER(firmSlug)}
            linkLabel="Work"
            emptyMessage={overdueWork == null ? 'Work data will appear when dashboard summary is available.' : 'No overdue work found from available data.'}
          />
          <AttentionRow
            label="Pending review / QC"
            count={pendingReview}
            loading={loading}
            reason="Work items waiting in the review queue before they can be finalized."
            linkTo={ROUTES.QC_QUEUE(firmSlug)}
            linkLabel="Review queue"
            emptyMessage={pendingReview == null ? 'Review queue data will appear when queue data is available.' : 'No items pending review.'}
          />
          <AttentionRow
            label="Intake items captured"
            count={intakeItems}
            loading={loading}
            reason="Form submissions received through Knowledge Intake."
            linkTo={ROUTES.CMS(firmSlug)}
            linkLabel="Knowledge Intake"
            emptyMessage="No intake items captured from this source yet."
          />
        </div>
      </PageSection>

      <PageSection title="Memory map" description="How Docketra connects firm memory across modules. Click a module to navigate.">
        <div className="tile-grid">
          <MemoryMapTile
            title="Knowledge Intake"
            description="Captures enquiries and form submissions from prospective clients."
            linkTo={ROUTES.CMS(firmSlug)}
          />
          <MemoryMapTile
            title="Relationships"
            description="Tracks prospective clients, follow-ups, proposals, and conversion status."
            linkTo={ROUTES.CRM(firmSlug)}
          />
          <MemoryMapTile
            title="Clients"
            description="Active client records, ownership, and ongoing relationship context."
            linkTo={ROUTES.CLIENTS(firmSlug)}
          />
          <MemoryMapTile
            title="Work"
            description="Dockets, deadlines, execution queues, and review workflows."
            linkTo={ROUTES.TASK_MANAGER(firmSlug)}
          />
          <MemoryMapTile
            title="Reports"
            description="Operational and executive-level performance visibility."
            linkTo={ROUTES.ADMIN_REPORTS(firmSlug)}
          />
        </div>
      </PageSection>

      <PageSection title="Knowledge gaps" description="Rule-based visibility gaps detected from existing data.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {!loading && noFollowupLeads === 0 && clientsWithoutOwner === 0 && activeWork != null && pendingReview != null ? (
            <p className="muted">No rule-based knowledge gaps detected from available data.</p>
          ) : null}

          {loading ? (
            <p className="muted">Checking for knowledge gaps…</p>
          ) : null}

          {!loading && noFollowupLeads > 0 ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {noFollowupLeads} prospective {noFollowupLeads === 1 ? 'client has' : 'clients have'} no next follow-up date
              </p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Prospects without a follow-up date are more likely to go cold.{' '}
                <Link to={ROUTES.CRM(firmSlug)}>Review in Relationships →</Link>
              </p>
            </div>
          ) : null}

          {!loading && clientsWithoutOwner > 0 ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {clientsWithoutOwner} {clientsWithoutOwner === 1 ? 'client has' : 'clients have'} no assigned owner
              </p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Unowned clients may lack a responsible team member for follow-up.{' '}
                <Link to={ROUTES.CLIENTS(firmSlug)}>Review in Clients →</Link>
              </p>
            </div>
          ) : null}

          {!loading && activeWork == null ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Work data unavailable</p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Dashboard summary could not be loaded. Work overdue counts are not visible.
              </p>
            </div>
          ) : null}

          {!loading && pendingReview == null ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Review queue data unavailable</p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Queue metrics could not be loaded. Pending review counts are not visible.
              </p>
            </div>
          ) : null}

          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Additional gap detection (checklists, SOPs, process templates) will be added in future versions.
          </p>
        </div>
      </PageSection>

      <PageSection title="How to read this page" description="Read-only command center — no data is created or edited here.">
        <p className="muted" style={{ marginBottom: '0.5rem' }}>
          Company Brain is currently a read-only overview. It uses existing clients, prospects, work, intake, and
          reports data from your Docketra workspace without adding new backend APIs, models, or AI infrastructure.
        </p>
        <p className="muted">
          Future versions will add knowledge records, process templates, linked checklists, and richer connected maps.
          Detection of SOPs, checklists, and document content is not yet implemented.
        </p>
      </PageSection>
    </PlatformShell>
  );
};

export default CompanyBrainPage;
