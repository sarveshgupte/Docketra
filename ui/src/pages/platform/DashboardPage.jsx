import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { PageSection, StatGrid, StatusMessageStack } from './PlatformShared';
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
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Dashboard metrics are temporarily unavailable.' : '' },
          { tone: 'error', message: onboardingError },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing dashboard metrics in the background…' : '' },
        ]}
      />
      <StatGrid items={cards} />

      <PageSection
        title="First-run setup guidance"
        description="Use this sequence to reach first pilot success quickly: firm setup → client readiness → category/subcategory + workbench → first docket → first teammate."
        actions={nextStep?.route ? <Link to={nextStep.route}>{nextStep.actionLabel}</Link> : null}
      >
        {nextStep ? (
          <div className="panel">
            <p className="section-title" style={{ marginBottom: 6 }}>Next recommended action: {nextStep.title}</p>
            <p className="muted">{nextStep.description || nextStep.explanation}</p>
            {nextStep.route ? <Link to={nextStep.route}>{nextStep.actionLabel}</Link> : null}
          </div>
        ) : (
          <p className="muted">Setup checklist is complete. Keep momentum by creating and assigning live dockets.</p>
        )}
        {pendingSteps.length > 1 ? (
          <ul className="muted" style={{ marginTop: 10, paddingLeft: 18 }}>
            {pendingSteps.slice(1, 4).map((step) => <li key={step.id}>{step.title}</li>)}
          </ul>
        ) : null}
      </PageSection>

      {blockers.length ? (
        <PageSection title="Setup blockers to clear" description="These are blocking first-use success. Clear them in order.">
          <div className="grid-cards">
            {blockers.map((blocker) => (
              <article className="panel metric-card" key={blocker.code}>
                <p className="metric-label">{blocker.title}</p>
                <p className="metric-note">{blocker.description}</p>
                {blocker.supportHint ? <p className="muted">{blocker.supportHint}</p> : null}
                {blocker.route ? <Link to={blocker.route}>{blocker.actionLabel}</Link> : null}
              </article>
            ))}
          </div>
        </PageSection>
      ) : null}

      <PageSection title="Modules" description="Open the right workspace quickly based on your current objective.">
        <div className="action-row">
          {isAdmin ? <Link to={ROUTES.CMS(firmSlug)}>CMS · Forms & Intake</Link> : null}
          {isAdmin ? <Link to={ROUTES.CRM_CLIENTS(firmSlug)}>CRM · Leads & Clients</Link> : null}
          <Link to={ROUTES.DOCKETS(firmSlug)}>Dockets · Oversight & Worklists</Link>
          <button type="button" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? 'Refreshing…' : 'Refresh metrics'}</button>
        </div>
        {!isAdmin ? <p className="muted">CMS and CRM modules are available to admin roles.</p> : null}
      </PageSection>

      <PageSection title="Productivity trend" description="Quick signal of current workload throughput.">
        {isLoading ? <p className="muted">Loading productivity signal…</p> : (
          <div className="bar" aria-label="Productivity score">
            <span style={{ width: `${Math.min(100, Number(summary.productivityScore || 62))}%` }} />
          </div>
        )}
      </PageSection>

      <PageSection
        title="Execution shortcuts"
        description="Jump directly into core operations without searching through navigation."
        actions={<Link to={ROUTES.DOCKETS(firmSlug)}>Open all dockets</Link>}
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
