export const isWorkspaceActive = (workspace = {}) => {
  if (workspace?.isActive === true) {
    return true;
  }

  if (workspace?.isActive === false) {
    return false;
  }

  return String(workspace?.status || '').trim().toLowerCase() === 'active';
};
