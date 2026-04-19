export const loadOnboardingProgressSafely = async ({ fetchProgress, setProgress, firmSlug, onWarning }) => {
  try {
    const response = await fetchProgress();
    if (response?.success) {
      setProgress({ ...response.data, firmSlug });
      return { loaded: true };
    }
    setProgress(null);
    onWarning?.('Onboarding progress response was not successful.');
    return { loaded: false };
  } catch (error) {
    setProgress(null);
    onWarning?.(`Onboarding progress unavailable: ${error?.message || 'unknown error'}`);
    return { loaded: false };
  }
};
