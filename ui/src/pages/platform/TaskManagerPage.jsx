import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { hasFirmRoleAtLeast, normalizeFirmRole } from '../../utils/roleHierarchy';
import { EmptyState, PageSection, StatGrid, StatRow, StatusMessageStack } from './PlatformShared';
import { usePlatformTaskManagerStatsQuery } from '../../hooks/usePlatformDataQueries';

export const PlatformTaskManagerPage = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { stats, isLoading, isFetching, isError } = usePlatformTaskManagerStatsQuery();
  const role = normalizeFirmRole(user?.role);
  const assignedWorkbaskets = Array.isArray(user?.workbaskets) ? user.workbaskets : [];
  const assignedQcWorkbaskets = Array.isArray(user?.qcWorkbaskets) ? user.qcWorkbaskets : [];
  const hasWorkbenchAccess = assignedWorkbaskets.length > 0;
  const hasQcQueueAccess = hasFirmRoleAtLeast(role, 'ADMIN') || assignedQcWorkbaskets.length > 0;
  const canConfigureWorkflow = hasFirmRoleAtLeast(role, 'MANAGER');

  const cards = useMemo(() => ([
    { label: 'Open docket load', value: isLoading ? '…' : stats.allActiveDockets, helpText: 'Active firm workload across execution, pending, and QC.' },
    { label: 'My Worklist', value: isLoading ? '…' : stats.myWorklistCount, helpText: 'Dockets already assigned to you.' },
    ...(hasWorkbenchAccess ? [{ label: 'Workbaskets', value: isLoading ? '…' : stats.workbasketCount, helpText: 'Shared intake or pull queues you can operate.' }] : []),
    ...(hasQcQueueAccess ? [{ label: 'QC Workbaskets', value: isLoading ? '…' : stats.qcPendingCount, helpText: 'Dockets currently waiting for quality review.' }] : []),
  ]), [hasQcQueueAccess, hasWorkbenchAccess, isLoading, stats.allActiveDockets, stats.myWorklistCount, stats.qcPendingCount, stats.workbasketCount]);

  const coverageItems = useMemo(() => ([
    { label: 'Role', value: role.replace(/_/g, ' '), note: 'current workspace access' },
    { label: 'My queue', value: isLoading ? '…' : stats.myWorklistCount, note: 'assigned dockets' },
    ...(hasWorkbenchAccess ? [{ label: 'Shared queues', value: assignedWorkbaskets.length, note: 'assigned workbaskets' }] : []),
    ...(hasQcQueueAccess ? [{ label: 'QC queues', value: hasFirmRoleAtLeast(role, 'ADMIN') ? 'All' : assignedQcWorkbaskets.length, note: hasFirmRoleAtLeast(role, 'ADMIN') ? 'admin visibility' : 'assigned QC workbaskets' }] : []),
  ]), [assignedQcWorkbaskets.length, assignedWorkbaskets.length, hasQcQueueAccess, hasWorkbenchAccess, isLoading, role, stats.myWorklistCount]);

  const primaryDestination = useMemo(() => {
    if (stats.myWorklistCount > 0) {
      return {
        label: 'Open My Worklist',
        route: ROUTES.WORKLIST(firmSlug),
        note: 'You already have assigned work waiting in your personal queue.',
      };
    }
    if (hasWorkbenchAccess) {
      return {
        label: 'Open Workbaskets',
        route: ROUTES.GLOBAL_WORKLIST(firmSlug),
        note: 'Use shared queues to pull or distribute fresh work.',
      };
    }
    if (hasQcQueueAccess) {
      return {
        label: 'Open QC Workbaskets',
        route: ROUTES.QC_QUEUE(firmSlug),
        note: 'Your review queue is the most relevant operational surface right now.',
      };
    }
    if (canConfigureWorkflow) {
      return {
        label: 'Open Work Settings',
        route: ROUTES.WORK_SETTINGS(firmSlug),
        note: 'No active queue access is configured yet. Start by reviewing routing and workbasket setup.',
      };
    }
    return {
      label: 'Open Dashboard',
      route: ROUTES.DASHBOARD(firmSlug),
      note: 'Use the dashboard for firm-wide orientation until work is assigned to you.',
    };
  }, [canConfigureWorkflow, firmSlug, hasQcQueueAccess, hasWorkbenchAccess, stats.myWorklistCount]);

  const surfaces = useMemo(() => ([
    {
      id: 'worklist',
      title: 'My Worklist',
      body: 'Your personal execution queue for assigned and pended work.',
      to: ROUTES.WORKLIST(firmSlug),
      meta: isLoading ? 'Loading…' : `${stats.myWorklistCount} assigned`,
      tone: stats.myWorklistCount > 0 ? 'live' : 'default',
      visible: true,
    },
    {
      id: 'workbaskets',
      title: 'Workbaskets',
      body: 'Shared intake and pull queues for fresh or unassigned docket work.',
      to: ROUTES.GLOBAL_WORKLIST(firmSlug),
      meta: `${assignedWorkbaskets.length} assigned queue${assignedWorkbaskets.length === 1 ? '' : 's'}`,
      tone: 'default',
      visible: hasWorkbenchAccess,
    },
    {
      id: 'qc',
      title: 'QC Workbaskets',
      body: 'Quality-review queues for pass, correction, and fail decisions.',
      to: ROUTES.QC_QUEUE(firmSlug),
      meta: hasFirmRoleAtLeast(role, 'ADMIN') ? 'admin-wide visibility' : `${assignedQcWorkbaskets.length} assigned QC queue${assignedQcWorkbaskets.length === 1 ? '' : 's'}`,
      tone: stats.qcPendingCount > 0 ? 'live' : 'default',
      visible: hasQcQueueAccess,
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      body: 'Operational summary for today’s workload, risks, and next actions.',
      to: ROUTES.DASHBOARD(firmSlug),
      meta: 'firm overview',
      tone: 'default',
      visible: true,
    },
    {
      id: 'category-management',
      title: 'Category Management',
      body: 'Adjust category, subcategory, and workbasket mapping for routing.',
      to: ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug),
      meta: 'manager control',
      tone: 'default',
      visible: isAdmin,
    },
    {
      id: 'work-settings',
      title: 'Work Settings',
      body: 'Review queue linkage, ownership rules, and intake routing behavior.',
      to: ROUTES.WORK_SETTINGS(firmSlug),
      meta: 'workflow setup',
      tone: 'default',
      visible: canConfigureWorkflow,
    },
  ].filter((item) => item.visible)), [assignedQcWorkbaskets.length, assignedWorkbaskets.length, canConfigureWorkflow, firmSlug, hasQcQueueAccess, isAdmin, isLoading, role, stats.myWorklistCount, stats.qcPendingCount]);

  const quickActions = useMemo(() => {
    const items = [
      { label: 'Go to My Worklist', to: ROUTES.WORKLIST(firmSlug) },
      { label: 'Go to Workbench', to: ROUTES.GLOBAL_WORKLIST(firmSlug), visible: hasWorkbenchAccess },
      { label: 'Go to QC Workbaskets', to: ROUTES.QC_QUEUE(firmSlug), visible: hasQcQueueAccess },
      { label: 'Open Dashboard', to: ROUTES.DASHBOARD(firmSlug) },
    ];
    return items.filter((item) => item.visible !== false);
  }, [firmSlug, hasQcQueueAccess, hasWorkbenchAccess]);

  const hasOperationalAccess = hasWorkbenchAccess || hasQcQueueAccess || stats.myWorklistCount > 0;

  return (
    <PlatformShell
      moduleLabel="Task Manager"
      title="Work execution hub"
      subtitle="Smart routing surface for the queues, reviews, and workflow controls available in this workspace."
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>New Docket</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Task Manager metrics are temporarily unavailable. You can still navigate to your available execution surfaces.' : '' },
          { tone: 'info', message: !hasQcQueueAccess ? 'QC Workbaskets are hidden until QC queue access is assigned.' : '' },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing Task Manager metrics in the background…' : '' },
        ]}
      />
      <PageSection
        title="Next best destination"
        description="This page stays out of the sidebar and works best as a clean command hub when you jump in directly."
        actions={<Link to={primaryDestination.route}>{primaryDestination.label}</Link>}
        variant="highlight"
      >
        <div className="task-manager-hero">
          <article className="panel task-manager-hero__primary">
            <p className="task-manager-kicker">Recommended</p>
            <p className="section-title">{primaryDestination.label}</p>
            <p className="muted">{primaryDestination.note}</p>
          </article>
          <article className="panel task-manager-hero__secondary">
            <p className="task-manager-kicker">Access coverage</p>
            <StatRow items={coverageItems} />
          </article>
        </div>
      </PageSection>

      <PageSection
        title="Live workload"
        description="Only the queue families relevant to your access are surfaced here."
      >
        <StatGrid items={cards} />
      </PageSection>

      <PageSection title="Quick actions" description="Go straight to the queue that matches your next workflow step.">
        <div className="action-row">
          {quickActions.map((item) => (
            <Link key={item.label} to={item.to}>{item.label}</Link>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Available surfaces"
        description="This hub stays smart: queues you cannot use do not appear here."
      >
        <div className="tile-grid tile-grid--smart">
          {surfaces.map((surface) => (
            <Link key={surface.id} className={`module-tile module-tile--smart module-tile--${surface.tone}`} to={surface.to}>
              <span className="module-tile__eyebrow">{surface.meta}</span>
              <strong>{surface.title}</strong>
              <span>{surface.body}</span>
            </Link>
          ))}
        </div>
      </PageSection>

      {!hasOperationalAccess ? (
        <PageSection title="No active queue access yet" description="Your sidebar stays clean until queue access is actually useful.">
          <EmptyState
            title="No queue surfaces are assigned yet"
            body={canConfigureWorkflow
              ? 'Review workbasket linkage and routing first, then return here once execution queues are live.'
              : 'Ask your admin to assign a workbasket or QC workbasket so your operational queues can appear here.'}
            actionLabel={canConfigureWorkflow ? 'Open Work Settings' : 'Open Dashboard'}
            onAction={() => navigate(canConfigureWorkflow ? ROUTES.WORK_SETTINGS(firmSlug) : ROUTES.DASHBOARD(firmSlug))}
            boxed
          />
        </PageSection>
      ) : null}

      {canConfigureWorkflow ? (
        <PageSection title="Workflow controls" description="Manager and admin controls stay visible here without adding sidebar noise.">
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
