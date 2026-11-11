import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageSection,
  StatRow,
  StatusBadge,
  StatusMessageStack,
} from './PlatformShared';
import {
  usePlatformDeadlineRiskQuery,
  usePlatformWorkbasketCapacityQuery,
  usePlatformWorkloadIntelligenceQuery,
  usePlatformExecutiveBriefQuery,
  usePlatformClientRiskQuery,
} from '../../hooks/usePlatformDataQueries';
import { docketraIntelligenceApi } from '../../api/docketraIntelligence.api';
import { ROUTES } from '../../constants/routes';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Users,
  Layers,
  CheckCircle2,
} from '../../components/onboarding/OnboardingIcons';

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatHours = (value) => {
  const numeric = toNumber(value);
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}h`;
};

const getAvailabilityStatus = (label) => {
  const normalized = String(label || '').toLowerCase();
  if (normalized === 'available') return 'active';
  if (normalized === 'moderate') return 'review';
  if (normalized === 'busy') return 'warning';
  if (normalized === 'overloaded') return 'error';
  return 'neutral';
};

const getCapacityStatus = (label) => {
  const normalized = String(label || '').toLowerCase();
  if (normalized === 'healthy') return 'active';
  if (normalized === 'busy') return 'warning';
  if (normalized === 'overloaded') return 'error';
  return 'neutral';
};

const getDeadlineRiskStatus = (label) => {
  const normalized = String(label || '').toLowerCase();
  if (normalized === 'low risk') return 'active';
  if (normalized === 'medium risk') return 'review';
  if (normalized === 'high risk') return 'warning';
  if (normalized === 'critical') return 'error';
  return 'neutral';
};

const ScoreMeter = ({ score, label = 'Availability score' }) => {
  const value = Math.max(0, Math.min(100, toNumber(score)));
  return (
    <div className="intelligence-score" aria-label={`${label}: ${value}`}>
      <span className="intelligence-score__value">{value}%</span>
      <span className="intelligence-score__track" aria-hidden="true">
        <span style={{ inlineSize: `${value}%` }} />
      </span>
    </div>
  );
};

const RankedAssigneeCard = ({ assignee, index, mode = 'best' }) => (
  <article className={`panel intelligence-rank-card intelligence-rank-card--${mode}`}>
    <span className="intelligence-rank-card__rank">{index + 1}</span>
    <div className="intelligence-rank-card__body">
      <p className="section-title">{assignee?.name || assignee?.xID || 'Unassigned'}</p>
      <p className="muted">
        {mode === 'avoid'
          ? assignee?.reason || 'High workload pressure detected.'
          : `${assignee?.openDockets || 0} open, ${assignee?.overdue || 0} overdue, ${assignee?.reviewWorkload || 0} in review`}
      </p>
    </div>
    <StatusBadge status={getAvailabilityStatus(assignee?.availabilityLabel)} label={assignee?.availabilityLabel || 'Unknown'} />
    <strong>{toNumber(assignee?.availabilityScore)}</strong>
  </article>
);

export const DocketraIntelligencePage = () => {
  const { firmSlug } = useParams();
  const [rebalanceMessage, setRebalanceMessage] = useState('');
  const [rebalancing, setRebalancing] = useState(false);

  const {
    data = {},
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = usePlatformWorkloadIntelligenceQuery();

  const {
    data: capacityData = {},
    isLoading: capacityLoading,
    isFetching: capacityFetching,
    isError: capacityError,
    error: capacityQueryError,
    refetch: refetchCapacity,
  } = usePlatformWorkbasketCapacityQuery();

  const {
    data: deadlineRisk = {},
    isLoading: deadlineLoading,
    isFetching: deadlineFetching,
    isError: deadlineError,
    error: deadlineQueryError,
    refetch: refetchDeadlineRisk,
  } = usePlatformDeadlineRiskQuery();

  const {
    data: briefData = {},
    refetch: refetchBrief,
    isFetching: briefFetching,
  } = usePlatformExecutiveBriefQuery();

  const {
    data: clientRiskData = {},
    refetch: refetchClientRisk,
  } = usePlatformClientRiskQuery();

  const isAnyFetching = isFetching || capacityFetching || deadlineFetching || briefFetching;

  const handleRefreshAll = () => {
    void refetch();
    void refetchCapacity();
    void refetchDeadlineRisk();
    void refetchBrief();
    void refetchClientRisk();
  };

  const summary = data.summary || {};
  const deadlineCounts = deadlineRisk.counts || {};
  const workbasketHealth = Array.isArray(capacityData.workbaskets) ? capacityData.workbaskets : [];
  const recommendations = data.recommendations || {};
  const members = Array.isArray(data.members) ? data.members : [];
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => toNumber(b.availabilityScore) - toNumber(a.availabilityScore)),
    [members]
  );
  const recommendedAssignee = recommendations.recommendedAssignee || null;
  const bestAssignees = Array.isArray(recommendations.bestAssignees) ? recommendations.bestAssignees : [];
  const avoidAssigning = Array.isArray(recommendations.avoidAssigning) ? recommendations.avoidAssigning : [];
  const mentorSuggestions = Array.isArray(recommendations.mentorSuggestions) ? recommendations.mentorSuggestions : [];
  const clients = Array.isArray(clientRiskData.clients) ? clientRiskData.clients : [];
  const hasMembers = sortedMembers.length > 0;
  const isFirstTimeWorkspace = !hasMembers && workbasketHealth.length === 0;

  const handleRebalance = async () => {
    try {
      setRebalancing(true);
      const res = await docketraIntelligenceApi.rebalanceWorkload(true);
      setRebalanceMessage(res?.data?.message || 'Smart rebalancing completed.');
      void refetch();
    } catch (err) {
      setRebalanceMessage(err?.message || 'Rebalancing failed.');
    } finally {
      setRebalancing(false);
    }
  };

  const overviewItems = [
    { label: 'Total Members', value: isLoading ? '...' : toNumber(summary.totalMembers) },
    { label: 'Available', value: isLoading ? '...' : toNumber(summary.available) },
    { label: 'Moderate', value: isLoading ? '...' : toNumber(summary.moderate) },
    { label: 'Busy', value: isLoading ? '...' : toNumber(summary.busy) },
    { label: 'Overloaded', value: isLoading ? '...' : toNumber(summary.overloaded) },
  ];

  return (
    <PlatformShell
      moduleLabel="Operations"
      title="Docketra Intelligence"
      subtitle="Operational capacity, statutory deadline radar, and assignee recommendations."
    >
      <div className="intelligence-shell">
        {/* Executive Action & Brief Strip */}
        <header className="intelligence-header-strip">
          <div className="intelligence-brief-pill">
            <div className="intelligence-brief-icon">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            </div>
            <div className="min-w-0">
              <span className="intelligence-brief-tag">Executive AI Brief</span>
              <p className="intelligence-brief-text">
                {briefData?.executiveBrief || 'All statutory filing deadlines on schedule. Team capacity is balanced with no active review bottlenecks.'}
              </p>
            </div>
          </div>
          <div className="intelligence-header-actions">
            <button
              type="button"
              className="intelligence-action-btn intelligence-action-btn--secondary"
              onClick={handleRefreshAll}
              disabled={isAnyFetching}
              title="Refresh all intelligence metrics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isAnyFetching ? 'animate-spin' : ''}`} />
              <span>{isAnyFetching ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              className="intelligence-action-btn intelligence-action-btn--primary"
              onClick={handleRebalance}
              disabled={rebalancing || !hasMembers}
              title={!hasMembers ? 'Invite team members to enable automated workload rebalancing' : 'Auto-balance dockets across available team members'}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{rebalancing ? 'Rebalancing...' : 'Smart Rebalance'}</span>
            </button>
          </div>
        </header>

        {rebalanceMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
            {rebalanceMessage}
          </div>
        )}

        {/* First-time setup onboarding guide (shown cleanly when workspace is empty) */}
        {isFirstTimeWorkspace && (
          <div className="intelligence-onboarding-card">
            <div className="flex items-start gap-3">
              <div className="intelligence-onboarding-icon">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[var(--dt-text)]">
                  Practice Workspace Initialized · Intelligence Engine Ready
                </h3>
                <p className="mt-1 text-xs text-[var(--dt-text-secondary)] leading-relaxed">
                  Docketra Intelligence tracks statutory SLA timelines and balances task assignments automatically as your team operates.
                  To activate real-time analytics for your firm:
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Link
                    to={ROUTES.ADMIN(firmSlug)}
                    className="intelligence-onboarding-link"
                  >
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    <span>1. Add Team Members</span>
                  </Link>
                  <Link
                    to={ROUTES.WORK_SETTINGS(firmSlug)}
                    className="intelligence-onboarding-link"
                  >
                    <Layers className="h-3.5 w-3.5 text-slate-500" />
                    <span>2. Configure Workbaskets</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <StatusMessageStack
          messages={[
            { tone: 'error', message: isError ? error?.message || 'Unable to load workload intelligence.' : '' },
            { tone: 'error', message: capacityError ? capacityQueryError?.message || 'Unable to load workbasket capacity intelligence.' : '' },
            { tone: 'error', message: deadlineError ? deadlineQueryError?.message || 'Unable to load deadline risk intelligence.' : '' },
            { tone: 'info', message: isFetching && !isLoading ? 'Refreshing workload intelligence in the background...' : '' },
          ]}
        />

        {/* Practice Capacity Strip */}
        <PageSection
          title="Team Capacity Overview"
          description="Live capacity metrics weighted by capacity and work type experience."
        >
          {isError ? (
            <ErrorState
              boxed
              title="Workload intelligence is unavailable"
              body={error?.message || 'Retry to reload the capacity model.'}
              actionLabel="Retry"
              onAction={() => void refetch()}
            />
          ) : (
            <StatRow items={overviewItems} />
          )}
        </PageSection>

        {/* 2-Column Balanced Dashboard Grid */}
        <div className="intelligence-dashboard-grid">
          {/* Column 1: Operational Deadlines & Workbasket Health */}
          <div className="intelligence-dashboard-col">
            <PageSection
              title="Deadline Risk Radar"
              description="Proactive radar for overdue dockets, predictive SLA breaches, and QC bottlenecks."
            >
              {deadlineError ? (
                <ErrorState
                  boxed
                  title="Deadline risk is unavailable"
                  body={deadlineQueryError?.message || 'Retry to reload deadline risk intelligence.'}
                  actionLabel="Retry"
                  onAction={() => void refetchDeadlineRisk()}
                />
              ) : deadlineLoading ? (
                <LoadingState label="Loading deadline risk radar..." />
              ) : (
                <article className={`panel intelligence-deadline-card intelligence-deadline-card--${getDeadlineRiskStatus(deadlineRisk.riskLevel)}`}>
                  <div className="intelligence-deadline-card__header-col">
                    <span className="metric-label">Risk Level</span>
                    <p className="intelligence-deadline-card__level">{deadlineRisk.riskLevel || 'Low Risk'}</p>
                    <p className="muted">{toNumber(deadlineCounts.overdueDockets)} overdue dockets</p>
                    <p className="muted">{toNumber(deadlineCounts.predictiveSlaBreaches)} predictive SLA breach risks</p>
                  </div>
                  <div className="intelligence-deadline-card__radar" aria-label="Deadline risk signals">
                    <span>Due Today <strong>{toNumber(deadlineCounts.dueToday)}</strong></span>
                    <span>PEND Stagnation <strong>{toNumber(deadlineCounts.pendStagnation)}</strong></span>
                    <span>Review Bottlenecks <strong>{toNumber(deadlineCounts.qcBottlenecks)} awaiting review approval</strong></span>
                    <span>Affected Dockets <strong>{toNumber(deadlineRisk.affectedDocketCount)}</strong></span>
                  </div>
                  <div className="intelligence-deadline-card__action">
                    <span className="metric-label">Recommendation</span>
                    <strong>{deadlineRisk.recommendedAction || 'No immediate action required.'}</strong>
                  </div>
                  <StatusBadge status={getDeadlineRiskStatus(deadlineRisk.riskLevel)} label={deadlineRisk.riskLevel || 'Low Risk'} />
                </article>
              )}
            </PageSection>

            <PageSection
              title="Workbasket Health"
              description="Capacity utilization across active statutory queues."
            >
              {capacityError ? (
                <ErrorState
                  boxed
                  title="Workbasket capacity is unavailable"
                  body={capacityQueryError?.message || 'Retry to reload workbasket capacity intelligence.'}
                  actionLabel="Retry"
                  onAction={() => void refetchCapacity()}
                />
              ) : capacityLoading ? (
                <LoadingState label="Loading workbasket health..." />
              ) : workbasketHealth.length ? (
                <div className="intelligence-workbasket-grid">
                  {workbasketHealth.map((workbasket) => (
                    <article key={workbasket.workbasketId || workbasket.name} className="panel intelligence-workbasket-card">
                      <div>
                        <p className="section-title">{workbasket.name}</p>
                        <p className="intelligence-workbasket-card__capacity">Capacity: {toNumber(workbasket.capacityUtilization)}%</p>
                        <p className="muted">
                          {toNumber(workbasket.memberCount)} members, {toNumber(workbasket.openDockets)} open, {toNumber(workbasket.overdueDockets)} overdue
                        </p>
                      </div>
                      <StatusBadge status={getCapacityStatus(workbasket.capacityLabel)} label={workbasket.capacityLabel || 'Healthy'} />
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState boxed title="No workbasket health yet" body="Capacity intelligence appears after active workbaskets are configured." />
              )}
            </PageSection>
          </div>

          {/* Column 2: Assignment Guidance & Recommendations */}
          <div className="intelligence-dashboard-col">
            <PageSection
              title="Recommended Assignment Card"
              description="Best person to receive the next assignment."
            >
              {isLoading ? (
                <LoadingState label="Loading recommended assignee..." />
              ) : recommendedAssignee ? (
                <article className="panel intelligence-recommendation-card">
                  <div>
                    <span className="metric-label">Recommended Assignee</span>
                    <p className="intelligence-recommendation-card__name">{recommendedAssignee.name || recommendedAssignee.xID}</p>
                    <p className="muted">Best person to receive the next assignment</p>
                  </div>
                  <ScoreMeter score={recommendedAssignee.availabilityScore} />
                  <StatusBadge status={getAvailabilityStatus(recommendedAssignee.availabilityLabel)} label={recommendedAssignee.availabilityLabel || 'Available'} />
                </article>
              ) : (
                <EmptyState boxed title="No recommended assignee yet" body="Workload guidance appears after active team members are available in this firm. Best person to receive the next assignment is selected automatically based on availability." />
              )}
            </PageSection>

            <PageSection
              title="Assignment Guidance"
              description="Ranked availability recommendations and burnout protection."
            >
              {isLoading ? (
                <LoadingState label="Loading assignment guidance..." />
              ) : !hasMembers ? (
                <EmptyState boxed title="No assignment guidance yet" body="Team guidance appears once there are active members to score." />
              ) : (
                <div className="intelligence-guidance-grid">
                  <div>
                    <p className="section-title">Best Assignees</p>
                    <div className="intelligence-rank-list">
                      {bestAssignees.length ? bestAssignees.map((assignee, index) => (
                        <RankedAssigneeCard key={assignee.xID || assignee.name || index} assignee={assignee} index={index} />
                      )) : <EmptyState title="No best assignees available" />}
                    </div>
                  </div>
                  <div>
                    <p className="section-title">Avoid Assigning</p>
                    <div className="intelligence-rank-list">
                      {avoidAssigning.length ? avoidAssigning.map((assignee, index) => (
                        <RankedAssigneeCard key={assignee.xID || assignee.name || index} assignee={assignee} index={index} mode="avoid" />
                      )) : <EmptyState title="No avoid list" body="No overloaded assignees were flagged." />}
                    </div>
                  </div>
                </div>
              )}
            </PageSection>
          </div>
        </div>

        {mentorSuggestions.length > 0 && (
          <PageSection
            title="Senior Expert Mentor Suggestions"
            description="Overloaded senior experts paired as Mentors to guide primary assignees without taking execution load."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mentorSuggestions.map((mentor) => (
                <div key={mentor.xID} className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-xs">
                  <p className="font-semibold text-purple-900">{mentor.name} ({mentor.xID})</p>
                  <p className="text-purple-700 mt-1">{mentor.reason}</p>
                </div>
              ))}
            </div>
          </PageSection>
        )}

        {clients.length > 0 && (
          <PageSection
            title="Client Compliance & Responsiveness Risk"
            description="Client ranking based on document upload speed and pended request ratios."
          >
            <DataTable
              columns={['Client ID', 'Total Dockets', 'Pended Count', 'Pended Ratio (%)', 'Overdue Count', 'Responsiveness Risk']}
              rows={clients.slice(0, 10).map((c) => (
                <tr key={c.clientId}>
                  <td><strong>{c.clientId}</strong></td>
                  <td>{c.totalDockets}</td>
                  <td>{c.pendedCount}</td>
                  <td>{c.pendedRatio}%</td>
                  <td>{c.overdueCount}</td>
                  <td>
                    <StatusBadge
                      status={c.riskRating === 'High Risk' ? 'error' : c.riskRating === 'Sluggish' ? 'warning' : 'active'}
                      label={c.riskRating}
                    />
                  </td>
                </tr>
              ))}
              pageSize={10}
              emptyLabel="No client risk records available."
            />
          </PageSection>
        )}

        {/* Detailed Team Availability Table */}
        <PageSection
          title="Team Availability Table"
          description="Sorted by availability score from highest to lowest."
        >
          <DataTable
            columns={[
              'Employee Name',
              'Availability Score',
              'Availability Label',
              'Workload Score',
              'Open Dockets',
              'Overdue',
              'Due Today',
              'Review Queue',
              'Estimated Hours',
              'Actual Hours',
            ]}
            rows={sortedMembers.map((member) => (
              <tr key={member.xID || member.userId || member.name}>
                <td>
                  <strong>{member.name || member.xID || 'Team member'}</strong>
                  {member.xID ? <p className="muted">{member.xID}</p> : null}
                </td>
                <td><ScoreMeter score={member.availabilityScore} /></td>
                <td><StatusBadge status={getAvailabilityStatus(member.availabilityLabel)} label={member.availabilityLabel || 'Unknown'} /></td>
                <td>{toNumber(member.workloadScore)}</td>
                <td>{toNumber(member.metrics?.openDockets)}</td>
                <td>{toNumber(member.metrics?.overdue)}</td>
                <td>{toNumber(member.metrics?.dueToday)}</td>
                <td>{toNumber(member.metrics?.reviewWorkload)}</td>
                <td>{formatHours(member.metrics?.estimatedHours)}</td>
                <td>{formatHours(member.metrics?.actualHours)}</td>
              </tr>
            ))}
            loading={isLoading}
            error={isError ? error?.message || 'Unable to load team availability.' : ''}
            onRetry={() => void refetch()}
            emptyLabel="No team workload records found yet."
            tableClassName="queue-table intelligence-table"
            pageSize={12}
          />
        </PageSection>
      </div>
    </PlatformShell>
  );
};

export default DocketraIntelligencePage;
