export const isAdminUser = (user) => ['ADMIN', 'Admin'].includes(String(user?.role || ''));

export const isRoutedTeamCannotResolve = ({ caseInfo, user }) => {
  const isRoutedToMyTeam = Boolean(caseInfo?.routedToTeamId) && String(caseInfo?.routedToTeamId) === String(user?.teamId || '');
  const isOwnerTeam = Boolean(caseInfo?.ownerTeamId) && String(caseInfo?.ownerTeamId) === String(user?.teamId || '');
  return isRoutedToMyTeam && !isOwnerTeam;
};

export const canAdminMoveAssignedDocketForUser = ({ caseInfo, user }) => (
  isAdminUser(user) && Boolean(caseInfo?.assignedToXID)
);

export const canRouteDocketByPolicy = ({ caseInfo, isViewOnlyMode, routingTeams }) => (
  Boolean(caseInfo)
  && !isViewOnlyMode
  && !caseInfo?.routedToTeamId
  && Array.isArray(routingTeams)
  && routingTeams.length > 0
);

export const canCloneDocketByPolicy = ({ permissions, caseData }) => (
  permissions?.canCloneCase?.(caseData) !== false
);

