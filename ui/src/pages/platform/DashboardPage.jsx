import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { EmptyState, PageSection, StatGrid, StatRow, StatusMessageStack } from './PlatformShared';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformDashboardSummaryQuery, usePlatformRiskBriefQuery } from '../../hooks/usePlatformDataQueries';
import { dashboardApi } from '../../api/dashboard.api';
import { docketExceptionApi } from '../../api/docketException.api';
import { mapOnboardingBlocker, mapOnboardingStepsWithCopy } from '../../components/onboarding/firstRunGuidance';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };

export const PlatformDashboardPage = () => {
  const { firmSlug } = useParams();
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [onboardingError, setOnboardingError] = useState('');
  const [exceptionDashboard, setExceptionDashboard] = useState(null);
  const [exceptionDashboardLoading, setExceptionDashboardLoading] = useState(false);
  const {
    data: summary = {},
    isLoading,
    isFetching,
    isError,
    refetch,
  } = usePlatformDashboardSummaryQuery();
  const { data: riskBrief = {}, isLoading: riskLoading } = usePlatformRiskBriefQuery();
  const currentRole = String(user?.role || '').toUpperCase();
  const canViewRiskBrief = (roleRank[currentRole] || 0) >= roleRank.MANAGER;
  
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

  useEffect(() => {
    if (!canViewRiskBrief) return;
    let isCancelled = false;
    const fetchExceptionDashboard = async () => {
      setExceptionDashboardLoading(true);
      try {
        const res = await docketExceptionApi.getExceptionDashboard();
        if (!isCancelled && res.success) {
          setExceptionDashboard(res.data);
        }
      } catch (err) {
        console.error('Failed to load exceptions dashboard:', err);
      } finally {
        if (!isCancelled) setExceptionDashboardLoading(false);
      }
    };
    fetchExceptionDashboard();
    return () => { isCancelled = true; };
  }, [canViewRiskBrief]);

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
    { label: 'New Docket', kicker: 'Create', helpText: 'Create and route a new docket.', route: ROUTES.CREATE_CASE(firmSlug) },
    { label: 'My Worklist', kicker: 'Queue', helpText: 'Review your assigned daily queue.', route: ROUTES.WORKLIST(firmSlug) },
    { label: 'Workbaskets', kicker: 'Shared', helpText: 'Check team workbasket backlog.', route: ROUTES.GLOBAL_WORKLIST(firmSlug) },
    { label: 'QC Worklist', kicker: 'Review', helpText: 'Review dockets in quality checks.', route: ROUTES.QC_QUEUE(firmSlug) },
    { label: 'Task Manager', kicker: 'Registry', helpText: 'Search and open the daily execution hub.', route: ROUTES.TASK_MANAGER(firmSlug) },
    ...(isAdmin ? [{ label: 'Clients', kicker: 'Relationships', helpText: 'Open client records and context.', route: ROUTES.CLIENTS(firmSlug) }] : []),
    ...(isAdmin ? [{ label: 'Settings', kicker: 'Administration', helpText: 'Manage firm and workspace settings.', route: ROUTES.SETTINGS(firmSlug) }] : []),
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
  const healthSummary = [
    { label: 'Active execution', value: metricValue(summary.inProgress), note: 'currently moving' },
    { label: 'Waiting zones', value: metricValue(summary.pending), note: 'needs review' },
    { label: 'Closed loop', value: metricValue(summary.resolved), note: 'resolved' },
  ];
  const riskCards = [
    { label: 'At-risk entities', value: riskLoading ? '…' : Number(riskBrief.atRiskEntities || 0), helpText: 'Open dockets already overdue on due date or SLA.' },
    { label: 'Waiting on clients', value: riskLoading ? '…' : Number(riskBrief.waitingClient || 0), helpText: 'Pended dockets blocked on client-side response.' },
    { label: 'Awaiting approval', value: riskLoading ? '…' : Number(riskBrief.awaitingApproval || 0), helpText: 'Submitted or review queues pending approver sign-off.' },
    { label: 'Stale pending', value: riskLoading ? '…' : Number(riskBrief.stalePending || 0), helpText: 'Pended dockets untouched for more than 10 days.' },
  ];
  const blockerRows = Object.entries(riskBrief.blockedByType || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5);

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
        variant="highlight"
      >
        <div className="dashboard-command-panel">
          <article className="panel dashboard-priority-card dashboard-priority-card--primary">
            <p className="dashboard-card-kicker">Priority</p>
            <div>
              <p className="section-title">Next best action</p>
              <p>{recommendedAction?.note || 'Review daily queues and continue execution.'}</p>
            </div>
            {recommendedAction?.route ? <Link to={recommendedAction.route}>{recommendedAction.label}</Link> : null}
          </article>
          <article className="panel dashboard-priority-card dashboard-priority-card--queues">
            <p className="dashboard-card-kicker">Queues</p>
            <div>
              <p className="section-title">Daily queues</p>
              <p className="muted">Jump directly into the queue that matches today’s work.</p>
            </div>
            <div className="action-row action-row--tight dashboard-queue-actions">
              <Link to={ROUTES.WORKLIST(firmSlug)}>My Worklist</Link>
              <Link to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>Workbaskets</Link>
              <Link to={ROUTES.QC_QUEUE(firmSlug)}>QC Worklist</Link>
            </div>
          </article>
          <StatRow items={healthSummary} />
        </div>
      </PageSection>

      <PageSection
        title="Operational health"
        description="Current workload and flow based on live dashboard metrics."
      >
        <StatGrid items={cards} />
      </PageSection>

      {canViewRiskBrief ? (
        <PageSection
          title="Morning risk brief"
          description="Quick manager/admin view: risk, blockers, approvals, and capacity hotspots."
        >
          <StatGrid items={riskCards} />
          <div className="layout-two-col" style={{ marginTop: 12 }}>
            <article className="panel">
              <p className="section-title">Top blocked reasons</p>
              {blockerRows.length ? (
                <ul className="dashboard-attention-list-items">
                  {blockerRows.map(([type, count]) => (
                    <li key={type} className="dashboard-attention-item">
                      <p className="section-title">{type.replaceAll('_', ' ')}</p>
                      <p className="muted">{count} active dockets</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No blocker reasons logged right now.</p>
              )}
            </article>
            <article className="panel">
              <p className="section-title">Overloaded teammates</p>
              {(riskBrief.overloadedAssignees || []).length ? (
                <ul className="dashboard-attention-list-items">
                  {riskBrief.overloadedAssignees.map((row) => (
                    <li key={row.assigneeXID} className="dashboard-attention-item">
                      <p className="section-title">{row.assigneeXID}</p>
                      <p className="muted">{row.docketCount} active dockets</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No overloaded teammates right now.</p>
              )}
            </article>
          </div>

          {exceptionDashboard ? (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="section-header">
                <div>
                  <p className="section-title">Exceptions and blockers</p>
                  <p className="muted section-description">Open exceptions grouped by type, age, due-date risk, and client concentration.</p>
                </div>
                <div className="dashboard-attention-meta">
                  <span className="dashboard-attention-flag">{exceptionDashboard.dueDateRisk?.atRisk || 0} at risk</span>
                </div>
              </div>
              <div className="dashboard-quick-actions-grid">
                <article className="dashboard-attention-item">
                  <p className="dashboard-card-kicker">By category</p>
                  {Object.entries(exceptionDashboard.byType || {}).some(([, count]) => count > 0) ? (
                    Object.entries(exceptionDashboard.byType || {}).map(([type, count]) => count > 0 ? (
                      <div key={type} className="dashboard-attention-meta">
                        <span className="section-title">{type.replace(/_/g, ' ')}</span>
                        <span className="dashboard-attention-flag">{count}</span>
                      </div>
                    ) : null)
                  ) : (
                    <p className="muted">No active blockers logged.</p>
                  )}
                </article>
                <article className="dashboard-attention-item">
                  <p className="dashboard-card-kicker">By age</p>
                  <div className="dashboard-attention-meta"><span className="section-title">Under 3 days</span><span className="dashboard-attention-flag">{exceptionDashboard.byAge?.under_3_days || 0}</span></div>
                  <div className="dashboard-attention-meta"><span className="section-title">3 to 7 days</span><span className="dashboard-attention-flag">{exceptionDashboard.byAge?.between_3_and_7_days || 0}</span></div>
                  <div className="dashboard-attention-meta"><span className="section-title">Over 7 days</span><span className="dashboard-attention-flag">{exceptionDashboard.byAge?.over_7_days || 0}</span></div>
                </article>
                <article className="dashboard-attention-item">
                  <p className="dashboard-card-kicker">Due-date jeopardy</p>
                  <div className="dashboard-attention-meta"><span className="section-title">Overdue statutory date</span><span className="dashboard-attention-flag">{exceptionDashboard.dueDateRisk?.overdue || 0}</span></div>
                  <div className="dashboard-attention-meta"><span className="section-title">Due within 2 days</span><span className="dashboard-attention-flag">{exceptionDashboard.dueDateRisk?.closeDue || 0}</span></div>
                </article>
                <article className="dashboard-attention-item">
                  <p className="dashboard-card-kicker">Top blocked clients</p>
                  {Object.entries(exceptionDashboard.byClient || {}).length ? (
                    Object.entries(exceptionDashboard.byClient || {})
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([clientKey, count]) => (
                        <div key={clientKey} className="dashboard-attention-meta">
                          <span className="section-title" title={clientKey}>{clientKey}</span>
                          <span className="dashboard-attention-flag">{count}</span>
                        </div>
                      ))
                  ) : (
                    <p className="muted">No blocked clients.</p>
                  )}
                </article>
              </div>
            </div>
          ) : null}
        </PageSection>
      ) : null}

      <div className="layout-two-col">
        <PageSection title="Needs attention" description="Items that require action before smooth daily flow." className="dashboard-attention-list">
          {attentionItems.length ? (
            <ul className="dashboard-attention-list-items">
              {attentionItems.map((item) => (
                <li key={item.key} className="dashboard-attention-item">
                  <div className="dashboard-attention-meta">
                    <span className="dashboard-attention-flag">Needs action</span>
                  </div>
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
                <p className="dashboard-action-icon">{action.kicker}</p>
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
