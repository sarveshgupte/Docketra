export const isAdminUser = (user) => ['ADMIN', 'Admin'].includes(String(user?.role || ''));

export const isRoutedTeamCannotResolve = ({ caseInfo, user }) => {
  const myTeamId = String(user?.teamId || '');
  const isRoutedToMyTeam = Boolean(caseInfo?.routedToTeamId) && String(caseInfo?.routedToTeamId) === myTeamId;
  const isRouteOriginTeam = Boolean(caseInfo?.routeOriginatorTeamId) && String(caseInfo?.routeOriginatorTeamId) === myTeamId;
  return isRoutedToMyTeam && !isRouteOriginTeam;
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
