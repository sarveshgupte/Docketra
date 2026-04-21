import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { dashboardApi } from '../../api/dashboard.api';
import { ROUTES } from '../../constants/routes';
import { InlineNotice, PageSection, StatGrid } from './PlatformShared';
import { usePermissions } from '../../hooks/usePermissions';

export const PlatformDashboardPage = () => {
  const { firmSlug } = useParams();
  const { isAdmin } = usePermissions();
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await dashboardApi.getSummary({ filter: 'ALL' });
        setSummary(res?.data?.data || {});
      } catch {
        setSummary({});
        setError('Dashboard metrics are temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const cards = [
    { label: 'Total dockets', value: summary.totalDockets || 0, helpText: 'All dockets tracked across the firm.' },
    { label: 'In progress', value: summary.inProgress || 0, helpText: 'Active execution work right now.' },
    { label: 'Pending review', value: summary.pending || 0, helpText: 'Waiting for managerial or partner decision.' },
    { label: 'Resolved', value: summary.resolved || 0, helpText: 'Successfully completed dockets.' },
    { label: 'QC passed', value: summary.qcPassed || 0, helpText: 'Dockets approved by quality checks.' },
    { label: 'Time spent (hrs)', value: summary.timeSpentHours || 0, helpText: 'Tracked effort across assigned work.' },
  ];

  return (
    <PlatformShell
      moduleLabel="Dashboard / Firm Ops"
      title="Dashboard"
      subtitle="Unified snapshot across CMS acquisition, CRM relationships, and docket execution."
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>New Docket</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <StatGrid items={cards} />


      <PageSection title="Modules" description="Open the right workspace quickly based on your current objective.">
        <div className="action-row">
          {isAdmin ? <Link to={ROUTES.CMS(firmSlug)}>CMS · Forms & Intake</Link> : null}
          {isAdmin ? <Link to={ROUTES.CRM_CLIENTS(firmSlug)}>CRM · Leads & Clients</Link> : null}
          <Link to={ROUTES.CASES(firmSlug)}>Dockets · Oversight & Worklists</Link>
        </div>
        {!isAdmin ? <p className="muted">CMS and CRM modules are available to admin roles.</p> : null}
      </PageSection>

      <PageSection title="Productivity trend" description="Quick signal of current workload throughput.">
        {loading ? <p className="muted">Loading productivity signal…</p> : (
          <div className="bar" aria-label="Productivity score">
            <span style={{ width: `${Math.min(100, Number(summary.productivityScore || 62))}%` }} />
          </div>
        )}
      </PageSection>

      <PageSection
        title="Execution shortcuts"
        description="Jump directly into core operations without searching through navigation."
        actions={<Link to={ROUTES.CASES(firmSlug)}>Open all dockets</Link>}
      >
        <div className="action-row">
          <Link to={ROUTES.WORKLIST(firmSlug)}>My Worklist</Link>
          <Link to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>Workbench</Link>
          <Link to={ROUTES.QC_QUEUE(firmSlug)}>QC Workbench</Link>
          {isAdmin ? <Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>Reports</Link> : null}
        </div>
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformDashboardPage;
