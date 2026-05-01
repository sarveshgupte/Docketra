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
        <p className="muted" style={{ margin: '0.15rem 0 0' }}>{isEmpty && emptyMessage ? emptyMessage : reason}</p>
      </div>
      {linkTo && linkLabel && !isEmpty ? <Link to={linkTo} style={{ alignSelf: 'center', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{linkLabel} →</Link> : null}
    </div>
  );
};

const ConnectedMapNode = ({ title, description, count, linkTo, isCurrent = false }) => {
  const inner = (
    <div className="panel" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', opacity: isCurrent ? 0.85 : 1, border: isCurrent ? '2px solid var(--color-accent, #4f46e5)' : undefined }}>
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

    setClients(clientsResult.status === 'fulfilled' ? toArray(clientsResult.value?.data?.data || clientsResult.value?.data?.items || clientsResult.value?.data) : []);
    setLeads(leadsResult.status === 'fulfilled' ? toArray(leadsResult.value?.data?.data || leadsResult.value?.data?.items || leadsResult.value?.data) : []);
    setSummary(summaryResult.status === 'fulfilled' ? (summaryResult.value?.data || null) : null);
    setKnowledgeItems(knowledgeResult.status === 'fulfilled' ? toArray(knowledgeResult.value?.data?.data || knowledgeResult.value?.data?.items || knowledgeResult.value?.data) : []);

    const allResults = [clientsResult, leadsResult, summaryResult, knowledgeResult];
    const failedCalls = allResults.filter((result) => result.status === 'rejected').length;
    if (failedCalls === allResults.length) setError('Company Brain overview is temporarily unavailable. Please refresh to try again.');
    else if (failedCalls > 0) setError('Some Company Brain data could not be loaded. Showing available data.');
    else setError('');

    hasLoadedRef.current = true;
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);

  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const activeClients = useMemo(() => clients.filter((client) => String(client?.status || 'active').toLowerCase() !== 'inactive').length, [clients]);
  const prospectiveClients = leads.length;
  const activeWork = summary?.myDockets?.total ?? summary?.myDockets?.items?.length ?? null;
  const overdueWork = summary?.overdueDockets?.total ?? summary?.overdueDockets?.items?.length ?? null;
  const pendingReview = summary?.workbasketLoad ? summary.workbasketLoad.reduce((acc, item) => acc + Number(item?.pending || 0), 0) : null;
  const leadsNeedFollowup = leads.filter((lead) => lead?.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= now).length;
  const noFollowupLeads = leads.filter((lead) => !lead?.nextFollowUpAt).length;
  const clientsWithoutOwner = clients.filter((client) => !(client?.ownerXid || client?.assignedTo || client?.ownerId)).length;

  const totalKnowledge = knowledgeItems.length;
  const knowledgeReviewDue = knowledgeItems.filter((item) => item?.reviewDueAt && new Date(item.reviewDueAt).getTime() <= endOfToday.getTime()).length;
  const knowledgeWithoutLinks = knowledgeItems.filter((item) => !(item?.linkedWorkType || item?.linkedClientId || item?.linkedDocketId)).length;

  return (
    <PlatformShell
      moduleLabel="Firm Memory"
      title="Company Brain"
      subtitle="Read-only command center connected from existing records using metadata links and rule-based cues."
      actions={<button type="button" onClick={() => void loadData({ background: true })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
    >
      <StatusMessageStack messages={[{ tone: 'error', message: error }, { tone: 'info', message: refreshing ? 'Refreshing Company Brain data in the background…' : '' }]} />

      <PageSection title="Command Summary" description="Top firm-memory signals at a glance.">
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

      <PageSection title="Needs Attention" description="Actionable items to address next.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <AttentionRow label="Overdue work" count={overdueWork} loading={loading} reason="Work past due dates that needs immediate action." linkTo={ROUTES.TASK_MANAGER(firmSlug)} linkLabel="Open Task Manager" emptyMessage={overdueWork == null ? 'Work data will appear when dashboard summary is available.' : 'No overdue work found from available data.'} />
          <AttentionRow label="Pending review / QC" count={pendingReview} loading={loading} reason="Work items waiting for review before completion." linkTo={ROUTES.QC_QUEUE(firmSlug)} linkLabel="Open review queue" emptyMessage={pendingReview == null ? 'Review queue data will appear when queue data is available.' : 'No items pending review.'} />
          <AttentionRow label="Prospects without follow-up" count={noFollowupLeads} loading={loading} reason="These prospects do not have a next follow-up date and may go cold." linkTo={ROUTES.CRM(firmSlug)} linkLabel="Review Relationships" emptyMessage="All prospects have follow-up dates." />
          <AttentionRow label="Prospects needing follow-up now" count={leadsNeedFollowup} loading={loading} reason="Follow-up date has passed for these prospective clients." linkTo={ROUTES.CRM(firmSlug)} linkLabel="Review Relationships" emptyMessage="No overdue prospect follow-ups found." />
          <AttentionRow label="Knowledge records due for review" count={knowledgeReviewDue} loading={loading} reason="Records with review dates on or before today should be checked for accuracy." linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)} linkLabel="Review Knowledge Library" emptyMessage="No knowledge records are due for review." />
          <AttentionRow label="Knowledge records without links" count={knowledgeWithoutLinks} loading={loading} reason="Records are not linked to a work type, client, or docket." linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)} linkLabel="Review Knowledge Library" emptyMessage="All knowledge records have metadata links." />
          <AttentionRow label="Clients without owner" count={clientsWithoutOwner} loading={loading} reason="These clients have no assigned owner and may lack accountability." linkTo={ROUTES.CLIENTS(firmSlug)} linkLabel="Review Clients" emptyMessage="All visible clients have owners." />
        </div>
      </PageSection>

      <PageSection title="Connected Map" description="How firm memory is connected from existing records.">
        <div className="tile-grid">
          <ConnectedMapNode title="Clients" description="Active client records and ownership context." count={fmt(loading, activeClients)} linkTo={ROUTES.CLIENTS(firmSlug)} />
          <ConnectedMapNode title="Prospects" description="Relationships, follow-ups, and conversion pipeline." count={fmt(loading, prospectiveClients)} linkTo={ROUTES.CRM(firmSlug)} />
          <ConnectedMapNode title="Work" description="Dockets, deadlines, and review queues." count={fmt(loading, activeWork)} linkTo={ROUTES.TASK_MANAGER(firmSlug)} />
          <ConnectedMapNode title="Knowledge Library" description="SOPs, checklists, templates, and instructions." count={fmt(loading, totalKnowledge)} linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)} />
          <ConnectedMapNode title="Company Brain" description="Read-only operational command center." count="Live" isCurrent />
        </div>
      </PageSection>

      <PageSection title="How to use Company Brain" description="Read-only view built from metadata links and rule-based cues.">
        <p className="muted" style={{ marginBottom: '0.5rem' }}>
          Company Brain is a read-only command center. It connects existing records from Clients, Relationships, Work, and Knowledge Library using metadata links.
        </p>
        <ol className="muted" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>Add reusable SOPs, checklists, templates, and instructions in <Link to={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}>Knowledge Library</Link>.</li>
          <li>Link knowledge records to work types, clients, or dockets.</li>
          <li>Review Company Brain to spot gaps and execution risks.</li>
        </ol>
      </PageSection>
    </PlatformShell>
  );
};

export default CompanyBrainPage;
