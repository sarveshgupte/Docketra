const hasValue = (value) => Boolean(value);

const getTutorialStatus = (user = {}) => {
  if (hasValue(user.tutorialCompletedAt) || hasValue(user?.tutorialState?.completedAt)) {
    return 'completed';
  }

  if (hasValue(user?.tutorialState?.skippedAt)) {
    return 'skipped';
  }

  return 'pending';
};

const shouldShowWelcomeTutorial = (user = {}) => getTutorialStatus(user) === 'pending';

module.exports = {
  getTutorialStatus,
  shouldShowWelcomeTutorial,
};
