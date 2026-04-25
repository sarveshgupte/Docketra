import { useQuery } from '@tanstack/react-query';
import { reportsService } from '../services/reports.service';

const getErrorMessage = (error) => {
  if (!error?.response) return 'Unable to connect to server';
  if (error.response?.status === 401 || error.response?.status === 403) return 'You do not have permission';
  return 'Something went wrong. Please try again.';
};

export const useReportsDashboardQuery = () => useQuery({
  queryKey: ['reports', 'dashboard-summary'],
  queryFn: async () => {
    const [metricsResponse, pendingResponse, slaResponse] = await Promise.all([
      reportsService.getCaseMetrics(),
      reportsService.getPendingCases(),
      reportsService.getSlaWeeklySummary(),
    ]);

    return {
      metrics: metricsResponse?.data?.success ? metricsResponse.data.data : null,
      pendingReport: pendingResponse?.data?.success ? pendingResponse.data.data : null,
      slaWeeklySummary: slaResponse?.data?.success ? slaResponse.data.data : null,
    };
  },
  staleTime: 3 * 60 * 1000,
  gcTime: 20 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 1,
  meta: {
    getErrorMessage,
  },
});

export { getErrorMessage };
