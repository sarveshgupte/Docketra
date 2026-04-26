import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { usePermissions } from '../../hooks/usePermissions';
import { PageSection, StatGrid, StatusMessageStack } from './PlatformShared';
import { usePlatformTaskManagerStatsQuery } from '../../hooks/usePlatformDataQueries';

export const PlatformTaskManagerPage = () => {
  const { firmSlug } = useParams();
  const { isAdmin } = usePermissions();
  const { stats, isLoading, isFetching, isError } = usePlatformTaskManagerStatsQuery();

  const cards = [
    { label: 'All active dockets', value: isLoading ? '…' : stats.allActiveDockets, helpText: 'In progress, pending, and in QC right now.' },
    { label: 'My Worklist', value: isLoading ? '…' : stats.myWorklistCount, helpText: 'Your active and pended docket workload.' },
    { label: 'Workbench', value: isLoading ? '…' : stats.workbasketCount, helpText: 'Shared queue dockets available to pull and start.' },
    { label: 'QC Workbench', value: isLoading ? '…' : stats.qcPendingCount, helpText: 'Dockets waiting for pass/correct/fail review.' },
  ];

  return (
    <PlatformShell
      moduleLabel="Docket Operations"
      title="Docket Workbench"
      subtitle="Daily docket execution hub for team intake, personal work, QC review, and oversight."
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>New Docket</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Docket Workbench metrics are temporarily unavailable. You can still navigate to all execution surfaces.' : '' },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing Docket Workbench metrics in the background…' : '' },
        ]}
      />
      <StatGrid items={cards} />

      <PageSection title="Quick actions" description="Go straight to the queue that matches your next workflow step.">
        <div className="action-row">
          <Link to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>Go to Workbench</Link>
          <Link to={ROUTES.WORKLIST(firmSlug)}>Go to My Worklist</Link>
          <Link to={ROUTES.DOCKETS(firmSlug)}>Open All Dockets</Link>
        </div>
      </PageSection>

      <PageSection title="Execution surfaces" description="Docket Workbench owns docket execution; document collection remains inside each docket detail under Attachments.">
        <div className="tile-grid">
          <Link className="module-tile" to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>
            <strong>Workbench</strong>
            <span>Team queue dockets available for pull and assignment.</span>
          </Link>
          <Link className="module-tile" to={ROUTES.WORKLIST(firmSlug)}>
            <strong>My Worklist</strong>
            <span>Your own active and pended docket execution workload.</span>
          </Link>
          <Link className="module-tile" to={ROUTES.QC_QUEUE(firmSlug)}>
            <strong>QC Workbench</strong>
            <span>Dockets awaiting quality-control pass, correction, or fail decisions.</span>
          </Link>
          <Link className="module-tile" to={ROUTES.DOCKETS(firmSlug)}>
            <strong>All Dockets</strong>
            <span>Master oversight view across workflow states and ownership.</span>
          </Link>
          {isAdmin ? (
            <Link className="module-tile" to={ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)}>
              <strong>Category Management</strong>
              <span>Manage category/subcategory and workbasket linkage.</span>
            </Link>
          ) : null}
        </div>
      </PageSection>

      {isAdmin ? (
        <PageSection title="Manager/Admin configuration" description="Control category/subcategory setup and routing behavior.">
          <div className="action-row">
            <Link to={ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)}>Category + subcategory setup</Link>
            <Link to={ROUTES.WORK_SETTINGS(firmSlug)}>Workbasket linkage / routing config</Link>
          </div>
        </PageSection>
      ) : null}
    </PlatformShell>
  );
};

export default PlatformTaskManagerPage;
