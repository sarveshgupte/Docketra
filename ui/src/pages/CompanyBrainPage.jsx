import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { crmApi } from '../api/crm.api';
import { dashboardApi } from '../api/dashboard.api';
import { ROUTES } from '../constants/routes';
import { PageSection, StatGrid, StatusMessageStack, toArray } from './platform/PlatformShared';

const READ_ONLY_NOTES = [
  'This is a read-only strategy page. No operational data is created or edited here.',
  'Current implementation is intentionally frontend-only and does not introduce any new backend API dependencies.',
];

const BulletList = ({ items }) => (
  <ul className="list-disc pl-6 text-sm text-[var(--dt-text-muted)] space-y-2">
    {items.map((item) => <li key={item}>{item}</li>)}
  </ul>
);

const fmt = (loading, value, fallback = '—') => (loading ? '…' : (value ?? fallback));

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
  const clientsAdded7d = clients.filter((client) => client?.createdAt && new Date(client.createdAt).getTime() >= now - (7 * 24 * 60 * 60 * 1000)).length;

  const noFollowupLeads = leads.filter((lead) => !lead?.nextFollowUpAt).length;
  const clientsWithoutOwner = clients.filter((client) => !(client?.ownerXid || client?.assignedTo || client?.ownerId)).length;

  return (
    <PlatformShell
      moduleLabel="Firm Memory"
      title="Company Brain"
      subtitle="A read-only overview of existing clients, work, intake, and firm-memory signals across your workspace."
      actions={<button type="button" onClick={() => void loadData({ background: true })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
    >
      <StatusMessageStack messages={[{ tone: 'error', message: error }, { tone: 'info', message: refreshing ? 'Refreshing Company Brain data in the background…' : '' }]} />

      <StatGrid items={[
        { label: 'Active clients', value: fmt(loading, activeClients) },
        { label: 'Prospective clients', value: fmt(loading, prospectiveClients) },
        { label: 'Active work', value: fmt(loading, activeWork), helpText: activeWork == null ? 'Will appear when work data is available.' : '' },
        { label: 'Overdue work', value: fmt(loading, overdueWork), helpText: overdueWork == null ? 'Will appear when work data is available.' : '' },
        { label: 'Pending review / QC', value: fmt(loading, pendingReview), helpText: pendingReview == null ? 'Will appear when queue data is available.' : '' },
        { label: 'Knowledge intake items', value: fmt(loading, intakeItems), helpText: intakeItems == null ? 'Will appear when intake data is available.' : '' },
      ]}
      />

      <PageSection title="Connected firm memory" description="Open source modules where Company Brain context currently lives.">
        <div className="tile-grid">
          <Link className="module-tile" to={ROUTES.TASK_MANAGER(firmSlug)}><strong>Work</strong><span>Dockets, deadlines, and execution queues.</span></Link>
          <Link className="module-tile" to={ROUTES.CLIENTS(firmSlug)}><strong>Clients</strong><span>Client records and ongoing relationships.</span></Link>
          <Link className="module-tile" to={ROUTES.CMS(firmSlug)}><strong>Knowledge Intake</strong><span>Form submissions and intake conversion outcomes.</span></Link>
          <Link className="module-tile" to={ROUTES.CRM(firmSlug)}><strong>Relationships</strong><span>Leads, follow-up cadence, and progression.</span></Link>
          <Link className="module-tile" to={ROUTES.ADMIN_REPORTS(firmSlug)}><strong>Reports</strong><span>Operational and executive-level performance views.</span></Link>
        </div>
      </PageSection>

      <PageSection title="Signals to watch" description="Read-only operational cues assembled from available workspace data.">
        <BulletList items={[
          `Leads needing follow-up: ${fmt(loading, leadsNeedFollowup, 0)}`,
          `Clients recently added (7d): ${fmt(loading, clientsAdded7d, 0)}`,
          `Work overdue: ${fmt(loading, overdueWork)}`,
          `Work waiting for review: ${fmt(loading, pendingReview)}`,
          intakeItems == null ? 'Intake items needing conversion will appear when intake metadata is available.' : `Intake items captured from knowledge intake: ${intakeItems}`,
        ]}
        />
      </PageSection>

      <PageSection title="Knowledge gaps" description="Rule-based visibility for missing context that may affect execution reliability.">
        {(noFollowupLeads > 0 || clientsWithoutOwner > 0) ? (
          <BulletList items={[
            ...(noFollowupLeads > 0 ? [`Prospective clients without next follow-up: ${noFollowupLeads}`] : []),
            ...(clientsWithoutOwner > 0 ? [`Clients without owner: ${clientsWithoutOwner}`] : []),
          ]}
          />
        ) : <p className="muted">Knowledge gap detection will improve as Docketra adds knowledge records and process templates.</p>}
      </PageSection>

      <PageSection title="Read-only placeholder" description="This landing page explains the Company Brain model and roadmap inside your firm workspace.">
        <BulletList items={READ_ONLY_NOTES} />
      </PageSection>

      <PageSection title="What Company Brain connects">
        <BulletList items={[
          'Clients and prospective clients',
          'Dockets, tasks, deadlines, and review queues',
          'Documents and linked context',
          'SOPs, checklists, templates, and internal instructions',
          'Team members, responsibilities, notes, and decisions',
        ]} />
      </PageSection>

      <PageSection title="How this helps your firm">
        <BulletList items={[
          'Understand what work is pending and why',
          'See client history before acting',
          'Reuse checklists and process knowledge',
          'Reduce dependency on individual memory',
          'Help new team members understand how the firm works',
        ]} />
      </PageSection>

      <PageSection title="Current foundation" description="Today, Docketra already connects core memory-building layers for your firm.">
        <BulletList items={['Work', 'Clients', 'Knowledge Intake', 'Relationships', 'Reports']} />
      </PageSection>

      <PageSection title="Coming next">
        <BulletList items={[
          'Client memory views',
          'Knowledge records',
          'Process templates',
          'Linked checklists',
          'Knowledge gaps',
          'Connected client/work maps',
        ]} />
      </PageSection>
    </PlatformShell>
  );
};

export default CompanyBrainPage;
