export const isAdminUser = (user) => ['ADMIN', 'Admin'].includes(String(user?.role || ''));

export const isRoutedTeamCannotResolve = ({ caseInfo, user }) => {
  const userTeams = Array.isArray(user?.teamIds)
    ? user.teamIds.map((id) => String(id))
    : [String(user?.teamId || '')];

  return Boolean(caseInfo?.routedToTeamId) && userTeams.includes(String(caseInfo?.routedToTeamId));
};

export const canAdminMoveAssignedDocketForUser = ({ caseInfo, user }) => (
  isAdminUser(user) && Boolean(caseInfo?.assignedToXID)
);

export const canRouteDocketByPolicy = ({ caseInfo, isViewOnlyMode, routingTeams }) => (
  Boolean(caseInfo)
  && !isViewOnlyMode
  && Array.isArray(routingTeams)
  && routingTeams.length > 0
);

export const canCloneDocketByPolicy = ({ permissions, caseData }) => (
  permissions?.canCloneCase?.(caseData) !== false
);

export const isTerminalDocketLifecycle = (lifecycle) => (
  ['RESOLVED', 'FILED', 'DONE', 'COMPLETED', 'ARCHIVED', 'CLOSED'].includes(String(lifecycle || '').toUpperCase())
);
