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
