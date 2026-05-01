import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { crmApi } from '../api/crm.api';
import { dashboardApi } from '../api/dashboard.api';
import { knowledgeItemsApi } from '../api/knowledgeItems.api';
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

const ConnectedMapNode = ({ title, description, count, linkTo, isCurrent = false }) => {
  const inner = (
    <div
      className="panel"
      style={{
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        opacity: isCurrent ? 0.85 : 1,
        border: isCurrent ? '2px solid var(--color-accent, #4f46e5)' : undefined,
      }}
    >
      <strong style={{ fontSize: '0.95rem' }}>{title}</strong>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{description}</p>
      <p className="kpi" style={{ margin: '0.25rem 0 0', fontSize: '1.1rem' }}>{count}</p>
      {isCurrent ? <span className="muted" style={{ fontSize: '0.75rem' }}>Current page</span> : null}
    </div>
  );
  if (isCurrent || !linkTo) return inner;
  return <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>;
};

export const CompanyBrainPage = () => {
  const { firmSlug } = useParams();
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadData = async ({ background = false } = {}) => {
    if (background && hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    const [clientsResult, leadsResult, summaryResult, knowledgeResult] = await Promise.allSettled([
      crmApi.listClients({ limit: 100 }),
      crmApi.listLeads({ limit: 100 }),
      dashboardApi.getSummary({ filter: 'ALL', limit: 20 }),
      knowledgeItemsApi.listKnowledgeItems({ limit: 100 }),
    ]);

    const nextClients = clientsResult.status === 'fulfilled'
      ? toArray(clientsResult.value?.data?.data || clientsResult.value?.data?.items || clientsResult.value?.data)
      : [];
    const nextLeads = leadsResult.status === 'fulfilled'
      ? toArray(leadsResult.value?.data?.data || leadsResult.value?.data?.items || leadsResult.value?.data)
      : [];
    const nextSummary = summaryResult.status === 'fulfilled' ? (summaryResult.value?.data || null) : null;
    const nextKnowledge = knowledgeResult.status === 'fulfilled'
      ? toArray(knowledgeResult.value?.data?.data || knowledgeResult.value?.data?.items || knowledgeResult.value?.data)
      : [];

    setClients(nextClients);
    setLeads(nextLeads);
    setSummary(nextSummary);
    setKnowledgeItems(nextKnowledge);

    const allResults = [clientsResult, leadsResult, summaryResult, knowledgeResult];
    const failedCalls = allResults.filter((result) => result.status === 'rejected').length;
    if (failedCalls === allResults.length) setError('Company Brain overview is temporarily unavailable. Please refresh to try again.');
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
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const endOfToday = today;

  const activeClients = useMemo(() => clients.filter((client) => String(client?.status || 'active').toLowerCase() !== 'inactive').length, [clients]);
  const prospectiveClients = leads.length;
  const activeWork = summary?.myDockets?.total ?? summary?.myDockets?.items?.length ?? null;
  const overdueWork = summary?.overdueDockets?.total ?? summary?.overdueDockets?.items?.length ?? null;
  const pendingReview = summary?.workbasketLoad ? summary.workbasketLoad.reduce((acc, item) => acc + Number(item?.pending || 0), 0) : null;
  const leadsNeedFollowup = leads.filter((lead) => lead?.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= now).length;
  const noFollowupLeads = leads.filter((lead) => !lead?.nextFollowUpAt).length;
  const clientsWithoutOwner = clients.filter((client) => !(client?.ownerXid || client?.assignedTo || client?.ownerId)).length;

  // Knowledge health metrics
  const totalKnowledge = knowledgeItems.length;
  const draftKnowledge = knowledgeItems.filter((item) => String(item?.status || '').toLowerCase() === 'draft').length;
  const archivedKnowledge = knowledgeItems.filter((item) => String(item?.status || '').toLowerCase() === 'archived').length;
  const knowledgeReviewDue = knowledgeItems.filter((item) => {
    if (!item?.reviewDueAt) return false;
    return new Date(item.reviewDueAt).getTime() <= endOfToday.getTime();
  }).length;
  const knowledgeWithoutOwner = knowledgeItems.filter((item) => !(item?.ownerXid || item?.assignedTo || item?.ownerId || item?.owner)).length;
  const knowledgeWithoutLinks = knowledgeItems.filter(
    (item) => !(item?.linkedWorkType || item?.linkedClientId || item?.linkedDocketId),
  ).length;

  return (
    <PlatformShell
      moduleLabel="Firm Memory"
      title="Company Brain"
      subtitle="Read-only command center. See what needs attention, what is connected, and where to go next."
      actions={<button type="button" onClick={() => void loadData({ background: true })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
    >
      <StatusMessageStack messages={[{ tone: 'error', message: error }, { tone: 'info', message: refreshing ? 'Refreshing Company Brain data in the background…' : '' }]} />

      {/* A. Command Summary */}
      <PageSection title="Command Summary" description="Key firm-memory signals from available workspace data.">
        <StatGrid items={[
          { label: 'Active clients', value: fmt(loading, activeClients) },
          { label: 'Prospective clients', value: fmt(loading, prospectiveClients) },
          { label: 'Active work', value: fmt(loading, activeWork), helpText: activeWork == null ? 'Will appear when work data is available.' : '' },
          { label: 'Overdue work', value: fmt(loading, overdueWork), helpText: overdueWork == null ? 'Will appear when work data is available.' : '' },
          { label: 'Knowledge records', value: fmt(loading, totalKnowledge) },
          { label: 'Review due', value: fmt(loading, knowledgeReviewDue) },
        ]}
        />
      </PageSection>

      {/* B. Needs Attention */}
      <PageSection title="Needs Attention" description="Actionable signals from available workspace data. Go here to decide what to address next.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
            label="Prospects without follow-up"
            count={noFollowupLeads}
            loading={loading}
            reason="These prospects have no scheduled next follow-up and may go cold."
            linkTo={ROUTES.CRM(firmSlug)}
            linkLabel="Relationships"
            emptyMessage="No prospects need follow-up right now."
          />
          <AttentionRow
            label="Knowledge records due for review"
            count={knowledgeReviewDue}
            loading={loading}
            reason="These records have a review due date on or before today. Check that they are still current."
            linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}
            linkLabel="Knowledge Library"
            emptyMessage="No knowledge records are due for review."
          />
          <AttentionRow
            label="Knowledge records without links"
            count={knowledgeWithoutLinks}
            loading={loading}
            reason="Knowledge without links means records that do not have a linked work type, client, or docket. These records will not surface automatically during work execution."
            linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}
            linkLabel="Review Knowledge Library"
            emptyMessage="All knowledge records have at least one metadata link."
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
        </div>
      </PageSection>

      {/* C. Connected Map */}
      <PageSection title="Connected Map" description="How firm memory connects across modules. Connected from existing records using metadata links.">
        <div className="tile-grid">
          <ConnectedMapNode
            title="Clients"
            description="Active client records and relationship context"
            count={fmt(loading, activeClients)}
            linkTo={ROUTES.CLIENTS(firmSlug)}
          />
          <ConnectedMapNode
            title="Prospective Clients"
            description="Enquiries, follow-ups, and conversion context"
            count={fmt(loading, leads.length)}
            linkTo={ROUTES.CRM(firmSlug)}
          />
          <ConnectedMapNode
            title="Work"
            description="Dockets, deadlines, and review queues"
            count={fmt(loading, activeWork)}
            linkTo={ROUTES.TASK_MANAGER(firmSlug)}
          />
          <ConnectedMapNode
            title="Knowledge Library"
            description="SOPs, checklists, templates, notes, client instructions, and process records"
            count={fmt(loading, totalKnowledge)}
            linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}
          />
          <ConnectedMapNode
            title="Company Brain"
            description="Read-only connected command center"
            count="Live"
            isCurrent
          />
        </div>
      </PageSection>

      {/* D. How to use Company Brain */}
      <PageSection title="How to use Company Brain" description="Read-only command center — no data is created or edited here.">
        <p className="muted" style={{ marginBottom: '0.75rem' }}>
          Company Brain is a read-only command center. It connects existing records from Clients, Relationships,
          Work, and Knowledge Library using metadata links. All signals are rule-based cues from available data — no
          AI, no graph databases, no document parsing.
        </p>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li className="muted">
            Add reusable SOPs, checklists, templates, and instructions in{' '}
            <Link to={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}>Knowledge Library</Link>.
          </li>
          <li className="muted">
            Link knowledge records to work types, clients, or dockets so they surface during execution.
          </li>
          <li className="muted">
            Review Company Brain to spot gaps and execution risks across clients, work, and knowledge.
          </li>
        </ol>
      </PageSection>
    </PlatformShell>
  );
};

export default CompanyBrainPage;
