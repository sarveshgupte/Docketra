export const loadPlatformOverviewData = async ({
  getPlatformStats,
  getOnboardingInsights,
  insightsParams = { sinceDays: 30, staleAfterDays: 3, recentLimit: 10 },
}) => {
  const statsResponse = await getPlatformStats();
  let onboardingResponse = null;

  try {
    onboardingResponse = await getOnboardingInsights(insightsParams);
  } catch (_error) {
    onboardingResponse = null;
  }

  return { statsResponse, onboardingResponse };
};
