import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
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
} from '../../hooks/usePlatformDataQueries';

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
      <span className="intelligence-score__value">{value}</span>
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
  const hasMembers = sortedMembers.length > 0;

  const overviewItems = [
    { label: 'Total Members', value: isLoading ? '...' : toNumber(summary.totalMembers) },
    { label: 'Available', value: isLoading ? '...' : toNumber(summary.available) },
    { label: 'Moderate', value: isLoading ? '...' : toNumber(summary.moderate) },
    { label: 'Busy', value: isLoading ? '...' : toNumber(summary.busy) },
    { label: 'Overloaded', value: isLoading ? '...' : toNumber(summary.overloaded) },
  ];

  return (
    <PlatformShell
      moduleLabel="Docketra Intelligence"
      title="Docketra Intelligence"
      subtitle="Manager view for team capacity, availability, and next-assignment guidance."
      actions={<Link to={ROUTES.GLOBAL_WORKLIST(firmSlug)}>Open Workbaskets</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? error?.message || 'Unable to load workload intelligence.' : '' },
          { tone: 'error', message: capacityError ? capacityQueryError?.message || 'Unable to load workbasket capacity intelligence.' : '' },
          { tone: 'error', message: deadlineError ? deadlineQueryError?.message || 'Unable to load deadline risk intelligence.' : '' },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing workload intelligence in the background...' : '' },
          { tone: 'info', message: capacityFetching && !capacityLoading ? 'Refreshing workbasket health in the background...' : '' },
          { tone: 'info', message: deadlineFetching && !deadlineLoading ? 'Refreshing deadline risk radar in the background...' : '' },
        ]}
      />

      <PageSection
        title="Team Capacity Overview"
        description="Live availability buckets from workload intelligence."
        actions={(
          <button type="button" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
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

      <PageSection
        title="Deadline Risk Radar"
        description="Deadline exposure across overdue work, near-term due dates, priority pressure, and review approvals."
        actions={(
          <button type="button" onClick={() => void refetchDeadlineRisk()} disabled={deadlineFetching}>
            {deadlineFetching ? 'Refreshing...' : 'Refresh Radar'}
          </button>
        )}
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
            <div>
              <span className="metric-label">Risk Level</span>
              <p className="intelligence-deadline-card__level">{deadlineRisk.riskLevel || 'Low Risk'}</p>
              <p className="muted">
                {toNumber(deadlineCounts.overdueDockets)} overdue dockets
              </p>
              <p className="muted">
                {toNumber(deadlineCounts.reviewBottlenecks)} awaiting review approval
              </p>
            </div>
            <div className="intelligence-deadline-card__radar" aria-label="Deadline risk signals">
              <span>Due Today <strong>{toNumber(deadlineCounts.dueToday)}</strong></span>
              <span>Due This Week <strong>{toNumber(deadlineCounts.dueThisWeek)}</strong></span>
              <span>High Priority This Week <strong>{toNumber(deadlineCounts.highPriorityDueThisWeek)}</strong></span>
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
        description="Capacity utilization by workbasket, sorted from highest utilization to lowest."
        actions={(
          <button type="button" onClick={() => void refetchCapacity()} disabled={capacityFetching}>
            {capacityFetching ? 'Refreshing...' : 'Refresh Health'}
          </button>
        )}
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
            <StatusBadge status={getAvailabilityStatus(recommendedAssignee.availabilityLabel)} label={recommendedAssignee.availabilityLabel} />
          </article>
        ) : (
          <EmptyState boxed title="No recommended assignee yet" body="Workload guidance appears after active team members are available in this firm." />
        )}
      </PageSection>

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

      <PageSection
        title="Assignment Guidance"
        description="Ranked recommendations for the next docket assignment."
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
    </PlatformShell>
  );
};

export default DocketraIntelligencePage;
