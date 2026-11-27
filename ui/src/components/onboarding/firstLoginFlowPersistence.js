export const isFirmWorkspaceRoute = (pathname = '') => {
  const cleanPath = String(pathname || '').split('?')[0].replace(/\/+$/, '');
  return cleanPath.startsWith('/app/firm/') && !cleanPath.endsWith('/setup');
};

export const canShowFirstLoginTour = ({
  pathname = '',
  user = null,
  isTourQuery = false,
  manualOpen = false,
} = {}) => {
  if (!user || !isFirmWorkspaceRoute(pathname)) {
    return false;
  }

  const role = String(user?.role || '').trim().toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') {
    return false;
  }

  if (manualOpen || isTourQuery) {
    return true;
  }

  if (!user?.welcomeTutorial?.show) {
    return false;
  }

  const firmSlug = user?.firmSlug || user?.firm?.firmSlug || '';
  const isSetupPending = user?.isSetupComplete === false || user?.firm?.isSetupComplete === false;
  const isSetupDismissed = Boolean(
    firmSlug
    && typeof window !== 'undefined'
    && window.localStorage?.getItem(`setupDismissed:${firmSlug}`) === 'true'
  );

  return !isSetupPending || isSetupDismissed;
};

export const resolveTutorialPersistenceIntent = ({
  serverShowTutorial,
  action,
  role,
  stepIndex,
}) => {
  if (!serverShowTutorial) {
    return null;
  }

  if (action !== 'completed' && action !== 'skipped') {
    return null;
  }

  const safeStepIndex = Number.isFinite(Number(stepIndex)) && Number(stepIndex) >= 0
    ? Math.floor(Number(stepIndex))
    : 0;

  return {
    status: action,
    role,
    stepIndex: safeStepIndex,
  };
};
