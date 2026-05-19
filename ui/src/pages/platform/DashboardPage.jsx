import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { EmptyState, PageSection, StatGrid, StatusMessageStack } from './PlatformShared';
import { usePermissions } from '../../hooks/usePermissions';
import { usePlatformDashboardSummaryQuery } from '../../hooks/usePlatformDataQueries';
import { dashboardApi } from '../../api/dashboard.api';
import { mapOnboardingBlocker, mapOnboardingStepsWithCopy } from '../../components/onboarding/firstRunGuidance';

export const PlatformDashboardPage = () => {
  const { firmSlug } = useParams();
  const { isAdmin } = usePermissions();
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [onboardingError, setOnboardingError] = useState('');
  const {
    data: summary = {},
    isLoading,
    isFetching,
    isError,
    refetch,
  } = usePlatformDashboardSummaryQuery();
  
  useEffect(() => {
    let isCancelled = false;
    const loadOnboarding = async () => {
      try {
        const response = await dashboardApi.getOnboardingProgress();
        if (!isCancelled && response?.success) {
          setOnboardingProgress(response.data || null);
          setOnboardingError('');
        }
      } catch (_error) {
        if (!isCancelled) {
          setOnboardingError('Onboarding guidance is temporarily unavailable.');
        }
      }
    };

    void loadOnboarding();
    return () => {
      isCancelled = true;
    };
  }, []);

  const onboardingMode = onboardingProgress?.role === 'PRIMARY_ADMIN' ? 'primary-admin' : 'admin';
  const mappedSteps = useMemo(() => mapOnboardingStepsWithCopy({
    steps: onboardingProgress?.steps || [],
    firmSlug,
    mode: onboardingMode,
  }), [firmSlug, onboardingMode, onboardingProgress?.steps]);
  const pendingSteps = mappedSteps.filter((step) => !step.completed);
  const nextStep = pendingSteps[0] || null;
  const blockers = useMemo(() => (onboardingProgress?.blockers || []).map((blocker) => mapOnboardingBlocker({
    blocker,
    firmSlug,
    mode: onboardingMode,
  })), [firmSlug, onboardingMode, onboardingProgress?.blockers]);
  const hasOnboardingSteps = Boolean(onboardingProgress && mappedSteps.length);
  const setupComplete = hasOnboardingSteps && pendingSteps.length === 0 && blockers.length === 0;

  const metricValue = (value) => {
    if (isLoading) return '…';
    if (value === null || value === undefined) return '—';
    return Number(value);
  };
  const cards = [
    { label: 'Open dockets', value: metricValue(summary.totalDockets), helpText: 'All tracked dockets across the firm.' },
    { label: 'In progress', value: metricValue(summary.inProgress), helpText: 'Execution work currently active.' },
    { label: 'Pending', value: metricValue(summary.pending), helpText: 'Waiting on review or decision.' },
    { label: 'QC passed', value: metricValue(summary.qcPassed), helpText: 'Quality-approved docket outcomes.' },
    { label: 'Resolved', value: metricValue(summary.resolved), helpText: 'Dockets closed successfully.' },
  ];
  const quickActions = [
    { label: 'New Docket', helpText: 'Create and route a new docket.', route: ROUTES.CREATE_CASE(firmSlug) },
    { label: 'My Worklist', helpText: 'Review your assigned daily queue.', route: ROUTES.WORKLIST(firmSlug) },
    { label: 'Workbaskets', helpText: 'Check team workbasket backlog.', route: ROUTES.GLOBAL_WORKLIST(firmSlug) },
    { label: 'QC Worklist', helpText: 'Review dockets in quality checks.', route: ROUTES.QC_QUEUE(firmSlug) },
    { label: 'All Dockets', helpText: 'Search and open all firm dockets.', route: ROUTES.DOCKETS(firmSlug) },
    ...(isAdmin ? [{ label: 'Clients', helpText: 'Open client records and context.', route: ROUTES.CLIENTS(firmSlug) }] : []),
    ...(isAdmin ? [{ label: 'Settings', helpText: 'Manage firm and workspace settings.', route: ROUTES.SETTINGS(firmSlug) }] : []),
  ];
  const recommendedAction = !setupComplete
    ? (nextStep?.route ? { label: nextStep.actionLabel, route: nextStep.route, note: nextStep.title } : null)
    : { label: 'Review My Worklist', route: ROUTES.WORKLIST(firmSlug), note: 'Prioritize today’s assigned work.' };
  const attentionItems = [
    ...blockers.map((blocker) => ({
      key: `blocker-${blocker.code}`,
      title: blocker.title,
      reason: blocker.description,
      actionLabel: blocker.actionLabel,
      route: blocker.route,
    })),
    ...(!setupComplete && nextStep ? [{
      key: `step-${nextStep.id}`,
      title: 'Next onboarding step',
      reason: nextStep.description || nextStep.explanation || nextStep.title,
      actionLabel: nextStep.actionLabel,
      route: nextStep.route,
    }] : []),
  ];

  return (
    <PlatformShell
      moduleLabel="Daily Operations"
      title="Dashboard"
      subtitle="Operations command center for daily priorities, workload health, and next actions."
      actions={<Link to={ROUTES.CREATE_CASE(firmSlug)}>New Docket</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Dashboard metrics are temporarily unavailable.' : '' },
          { tone: 'error', message: onboardingError },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing dashboard metrics in the background…' : '' },
        ]}
      />
      <PageSection
        title="Today’s command center"
        description="Next best action and queue direction for today."
        actions={recommendedAction?.route ? <Link to={recommendedAction.route}>{recommendedAction.label}</Link> : null}
      >
        <div className="dashboard-command-panel layout-two-col">
          <article className="panel dashboard-priority-card">
            <p className="section-title">Next best action</p>
            <p>{recommendedAction?.note || 'Review daily queues and continue execution.'}</p>
            {recommendedAction?.route ? <Link to={recommendedAction.route}>{recommendedAction.label}</Link> : null}
          </article>
          <article className="panel dashboard-priority-card">
            <p className="section-title">Daily queues</p>
            <div className="action-row action-row--tight">
              <Link to={ROUTES.WORKLIST(firmSlug)}>My Worklist</Link>
              <Link to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>Workbaskets</Link>
              <Link to={ROUTES.QC_QUEUE(firmSlug)}>QC Worklist</Link>
            </div>
          </article>
        </div>
      </PageSection>

      <PageSection
        title="Operational health"
        description="Current workload and flow based on live dashboard metrics."
      >
        <StatGrid items={cards} />
      </PageSection>

      <div className="layout-two-col">
        <PageSection title="Needs attention" description="Items that require action before smooth daily flow." className="dashboard-attention-list">
          {attentionItems.length ? (
            <ul className="dashboard-attention-list-items">
              {attentionItems.map((item) => (
                <li key={item.key} className="panel">
                  <p className="section-title">{item.title}</p>
                  <p className="muted">{item.reason}</p>
                  {item.route ? <Link to={item.route}>{item.actionLabel || 'Open'}</Link> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No setup blockers right now."
              body="Continue daily operations from your queues."
            />
          )}
        </PageSection>

        <PageSection
          title="Quick actions"
          description="High-value command links for docket operations."
          className="dashboard-quick-actions"
          actions={<button type="button" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh metrics'}</button>}
        >
          <div className="dashboard-quick-actions-grid">
            {quickActions.map((action) => (
              <article className="panel" key={action.label}>
                <p className="section-title">{action.label}</p>
                <p className="muted">{action.helpText}</p>
                <Link to={action.route}>Open</Link>
              </article>
            ))}
          </div>
        </PageSection>
      </div>

    </PlatformShell>
  );
};

export default PlatformDashboardPage;
