import React from 'react';

export const ASSIGNEE_RECOMMENDATION_TOOLTIP = 'Recommendation is based on active workload, due dates, review commitments, estimated effort and actual effort.';

const LABEL_STATUS = {
  Available: 'available',
  Moderate: 'moderate',
  Busy: 'busy',
  Overloaded: 'overloaded',
};

const normalizeXid = (value) => String(value || '').trim().toUpperCase();

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getCandidateKeys = (user = {}) => [
  user.xID,
  user.xid,
  user.userId,
  user.value,
  user._id,
  user.id,
  user.email,
].map(normalizeXid).filter(Boolean);

const getWorkloadKeys = (member = {}) => [
  member.xID,
  member.xid,
  member.userId,
  member._id,
  member.id,
  member.email,
].map(normalizeXid).filter(Boolean);

export const getAssigneeAvailabilityStatus = (label) => LABEL_STATUS[String(label || '').trim()] || 'unknown';

export const enrichAssignableUsersWithIntelligence = (assignableUsers = [], workloadData = {}) => {
  const workloadMembers = Array.isArray(workloadData?.members) ? workloadData.members : [];
  const workloadByKey = new Map();

  workloadMembers.forEach((member) => {
    getWorkloadKeys(member).forEach((key) => workloadByKey.set(key, member));
  });

  const recommended = workloadData?.recommendations?.recommendedAssignee || workloadData?.recommendedAssignee || null;
  const recommendedKeys = new Set(getWorkloadKeys(recommended));

  return assignableUsers
    .map((user) => {
      const candidateKeys = getCandidateKeys(user);
      const workload = candidateKeys.map((key) => workloadByKey.get(key)).find(Boolean) || null;
      const metrics = workload?.metrics || {};
      const xID = normalizeXid(user?.xID || user?.xid || workload?.xID || workload?.xid || candidateKeys[0]);
      const availabilityScore = workload ? toNumber(workload.availabilityScore) : -1;
      const availabilityLabel = workload?.availabilityLabel || 'Unknown';

      return {
        ...user,
        xID: user?.xID || user?.xid || xID,
        intelligence: {
          availabilityScore,
          availabilityLabel,
          workloadScore: workload ? toNumber(workload.workloadScore) : 0,
          openDockets: toNumber(metrics.openDockets),
          overdue: toNumber(metrics.overdue),
          dueToday: toNumber(metrics.dueToday),
          reviewQueue: toNumber(metrics.reviewWorkload),
          estimatedHours: toNumber(metrics.estimatedHours),
          actualHours: toNumber(metrics.actualHours),
          isRecommended: candidateKeys.some((key) => recommendedKeys.has(key)),
          hasWorkloadData: Boolean(workload),
        },
      };
    })
    .sort((left, right) => (
      (right.intelligence.availabilityScore - left.intelligence.availabilityScore)
      || (left.intelligence.overdue - right.intelligence.overdue)
      || (left.intelligence.reviewQueue - right.intelligence.reviewQueue)
      || String(left.name || left.xID || '').localeCompare(String(right.name || right.xID || ''))
    ));
};

export const getAssigneeOptionLabel = (assignee = {}) => {
  const intel = assignee.intelligence || {};
  const name = assignee.name || assignee.xID || 'User';
  const xid = assignee.xID ? ` (${assignee.xID})` : '';
  if (!intel.hasWorkloadData) return `${name}${xid} - Workload pending`;

  const recommended = intel.isRecommended ? 'Recommended - ' : '';
  return `${recommended}${name}${xid} - Availability ${intel.availabilityScore} - ${intel.availabilityLabel} - ${intel.openDockets} Open Dockets - ${intel.overdue} Overdue`;
};

export const AssigneeIntelligencePanel = ({
  assignees = [],
  selectedXid = '',
  loading = false,
  error = false,
  compact = false,
}) => {
  if (loading) {
    return (
      <div className="assignee-intelligence assignee-intelligence--loading" role="status">
        Loading Docketra Intelligence for assignees...
      </div>
    );
  }

  if (error) {
    return (
      <div className="assignee-intelligence assignee-intelligence--warning" role="status">
        Workload intelligence is unavailable right now. Manual assignment is still available.
      </div>
    );
  }

  const visibleAssignees = assignees.filter((assignee) => assignee.intelligence?.hasWorkloadData).slice(0, compact ? 3 : 5);
  if (!visibleAssignees.length) {
    return (
      <div className="assignee-intelligence assignee-intelligence--empty" role="status">
        Workload intelligence appears after active assignee data is available. Manual selection is not blocked.
      </div>
    );
  }

  const normalizedSelected = normalizeXid(selectedXid);

  return (
    <div className={`assignee-intelligence ${compact ? 'assignee-intelligence--compact' : ''}`.trim()} aria-label="Docketra Intelligence assignee guidance">
      <div className="assignee-intelligence__header">
        <span>Docketra Intelligence</span>
        <span title={ASSIGNEE_RECOMMENDATION_TOOLTIP} className="assignee-intelligence__tooltip">Why?</span>
      </div>
      <div className="assignee-intelligence__list">
        {visibleAssignees.map((assignee) => {
          const intel = assignee.intelligence || {};
          const isSelected = normalizeXid(assignee.xID) === normalizedSelected;
          const status = getAssigneeAvailabilityStatus(intel.availabilityLabel);
          return (
            <div
              key={assignee.xID || assignee.email || assignee.name}
              className={`assignee-intelligence__card assignee-intelligence__card--${status} ${intel.isRecommended ? 'assignee-intelligence__card--recommended' : ''} ${isSelected ? 'assignee-intelligence__card--selected' : ''}`.trim()}
              title={intel.isRecommended ? ASSIGNEE_RECOMMENDATION_TOOLTIP : undefined}
            >
              <div>
                <div className="assignee-intelligence__name">
                  <span>{assignee.name || assignee.xID}</span>
                  {intel.isRecommended ? <span className="assignee-intelligence__recommended">Recommended</span> : null}
                </div>
                <div className="assignee-intelligence__meta">
                  <span>Availability: {intel.availabilityScore}</span>
                  <span>{intel.openDockets} Open Dockets</span>
                  <span>{intel.overdue} Overdue</span>
                </div>
              </div>
              <span className={`assignee-intelligence__label assignee-intelligence__label--${status}`}>
                {intel.availabilityLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
