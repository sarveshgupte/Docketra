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

  const activeClients = useMemo(() => clients.filter((client) => String(client?.status || 'active').toLowerCase() !== 'inactive').length, [clients]);
  const prospectiveClients = leads.length;
  const activeWork = summary?.myDockets?.total ?? summary?.myDockets?.items?.length ?? null;
  const overdueWork = summary?.overdueDockets?.total ?? summary?.overdueDockets?.items?.length ?? null;
  const pendingReview = summary?.workbasketLoad ? summary.workbasketLoad.reduce((acc, item) => acc + Number(item?.pending || 0), 0) : null;
  const intakeItems = leads.length ? leads.filter((lead) => String(lead?.source || '').toLowerCase().includes('cms')).length : 0;
  const leadsNeedFollowup = leads.filter((lead) => lead?.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= now).length;

  const noFollowupLeads = leads.filter((lead) => !lead?.nextFollowUpAt).length;
  const clientsWithoutOwner = clients.filter((client) => !(client?.ownerXid || client?.assignedTo || client?.ownerId)).length;

  // Knowledge health metrics
  const totalKnowledge = knowledgeItems.length;
  const activeKnowledge = knowledgeItems.filter((item) => String(item?.status || '').toLowerCase() === 'active').length;
  const draftKnowledge = knowledgeItems.filter((item) => String(item?.status || '').toLowerCase() === 'draft').length;
  const archivedKnowledge = knowledgeItems.filter((item) => String(item?.status || '').toLowerCase() === 'archived').length;
  const knowledgeReviewDue = knowledgeItems.filter((item) => {
    if (!item?.reviewDueAt) return false;
    return new Date(item.reviewDueAt).getTime() <= today.getTime();
  }).length;
  const knowledgeWithoutOwner = knowledgeItems.filter((item) => !(item?.ownerXid || item?.assignedTo || item?.ownerId || item?.owner)).length;
  const knowledgeWithoutLinks = knowledgeItems.filter(
    (item) => !(item?.linkedWorkType || item?.linkedClientId || item?.linkedDocketId),
  ).length;

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
          Company Brain connects existing Docketra records into one read-only operational view. It does not create or
          edit data here; it helps you see what needs attention across clients, work, prospects, and knowledge.
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
          { label: 'Knowledge records', value: fmt(loading, totalKnowledge) },
          { label: 'Active knowledge records', value: fmt(loading, activeKnowledge) },
          { label: 'Knowledge review due', value: fmt(loading, knowledgeReviewDue) },
        ]}
        />
      </PageSection>

      <PageSection title="Connected map" description="Read-only view of how Docketra connects firm memory. Connected from existing records using metadata links.">
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

      <PageSection title="Knowledge health" description="Rule-based cues from existing Knowledge Library records. No semantic analysis is performed.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading ? (
            <p className="muted">Checking knowledge health…</p>
          ) : null}

          {!loading && totalKnowledge === 0 ? (
            <p className="muted">No knowledge records found. Use Knowledge Library to add SOPs, checklists, and process records.</p>
          ) : null}

          {!loading && draftKnowledge > 0 ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {draftKnowledge} draft knowledge {draftKnowledge === 1 ? 'record' : 'records'}
              </p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Draft records are not yet active and are not surfaced during work execution.{' '}
                <Link to={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}>Review in Knowledge Library →</Link>
              </p>
            </div>
          ) : null}

          {!loading && archivedKnowledge > 0 ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {archivedKnowledge} archived knowledge {archivedKnowledge === 1 ? 'record' : 'records'}
              </p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Archived records are no longer active. Review if any should be restored.{' '}
                <Link to={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}>Review in Knowledge Library →</Link>
              </p>
            </div>
          ) : null}

          {!loading && knowledgeReviewDue > 0 ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {knowledgeReviewDue} knowledge {knowledgeReviewDue === 1 ? 'record' : 'records'} due for review
              </p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                These records have a review due date on or before today. Check that they are still current.{' '}
                <Link to={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}>Review in Knowledge Library →</Link>
              </p>
            </div>
          ) : null}

          {!loading && knowledgeWithoutOwner > 0 ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {knowledgeWithoutOwner} knowledge {knowledgeWithoutOwner === 1 ? 'record has' : 'records have'} no owner
              </p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Knowledge records without an assigned owner may lack accountability for updates.{' '}
                <Link to={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}>Review in Knowledge Library →</Link>
              </p>
            </div>
          ) : null}

          {!loading && knowledgeWithoutLinks > 0 ? (
            <div className="panel" style={{ padding: '0.75rem 1rem' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {knowledgeWithoutLinks} knowledge {knowledgeWithoutLinks === 1 ? 'record' : 'records'} without links
              </p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                Knowledge without links means records that do not have a linked work type, client, or docket. These
                records will not surface automatically during work execution.{' '}
                <Link to={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}>Review in Knowledge Library →</Link>
              </p>
            </div>
          ) : null}

          {!loading && totalKnowledge > 0 && draftKnowledge === 0 && knowledgeReviewDue === 0 && knowledgeWithoutOwner === 0 && knowledgeWithoutLinks === 0 ? (
            <p className="muted">No rule-based knowledge health issues detected from available records.</p>
          ) : null}
        </div>
      </PageSection>

      <PageSection title="Useful connections" description="Read-only rows showing examples of existing relationships across modules. Connected from existing records.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <AttentionRow
            label="Prospective clients without follow-up"
            count={noFollowupLeads}
            loading={loading}
            reason="Prospects with no next follow-up date are at risk of going cold. Set a follow-up date in Relationships."
            linkTo={ROUTES.CRM(firmSlug)}
            linkLabel="Relationships"
            emptyMessage="All prospects have a follow-up date set."
          />
          <AttentionRow
            label="Clients without owner"
            count={clientsWithoutOwner}
            loading={loading}
            reason="Unowned clients may not have a responsible team member for follow-up or escalation."
            linkTo={ROUTES.CLIENTS(firmSlug)}
            linkLabel="Clients"
            emptyMessage="All visible clients have an assigned owner."
          />
          <AttentionRow
            label="Knowledge records without links"
            count={knowledgeWithoutLinks}
            loading={loading}
            reason="Unlinked knowledge records will not be surfaced automatically during work execution. Link them to a work type, client, or docket."
            linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}
            linkLabel="Knowledge Library"
            emptyMessage="All knowledge records have at least one metadata link."
          />
          <AttentionRow
            label="Overdue work"
            count={overdueWork}
            loading={loading}
            reason="Overdue work needs attention before deadlines compound."
            linkTo={ROUTES.TASK_MANAGER(firmSlug)}
            linkLabel="Work"
            emptyMessage={overdueWork == null ? 'Work data unavailable from dashboard summary.' : 'No overdue work found.'}
          />
          <AttentionRow
            label="Pending review / QC"
            count={pendingReview}
            loading={loading}
            reason="Work in the review queue cannot be finalized until reviewed."
            linkTo={ROUTES.QC_QUEUE(firmSlug)}
            linkLabel="Work / Reports"
            emptyMessage={pendingReview == null ? 'Review queue data unavailable.' : 'No items pending review.'}
          />
        </div>
      </PageSection>

      <PageSection title="Memory map" description="How Docketra connects firm memory across modules. Click a module to navigate.">
        <div className="tile-grid">
          <MemoryMapTile
            title="Knowledge Intake"
            description="Captures enquiries and form submissions from prospective clients. Incoming context from the outside world."
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
            title="Knowledge Library"
            description="Reusable internal firm knowledge: SOPs, checklists, templates, notes, client instructions, and process records."
            linkTo={ROUTES.KNOWLEDGE_LIBRARY(firmSlug)}
          />
          <MemoryMapTile
            title="Reports"
            description="Operational and executive-level performance visibility."
            linkTo={ROUTES.ADMIN_REPORTS(firmSlug)}
          />
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem' }}>
          Flow: Knowledge Intake → Relationships → Clients → Work → Knowledge Library → Company Brain
        </p>
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
          Company Brain is a read-only connected view. It uses existing clients, prospects, work, knowledge records,
          and intake data from your Docketra workspace. All connections are based on metadata links, not AI or semantic
          analysis. No new backend APIs, models, or AI infrastructure are used.
        </p>
        <p className="muted">
          Future versions will add richer connected views and deeper link surfaces. Detection of document content is
          not implemented and is not planned without an explicit product decision.
        </p>
      </PageSection>
    </PlatformShell>
  );
};

export default CompanyBrainPage;
