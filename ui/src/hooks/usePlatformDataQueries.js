import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard.api';
import { worklistApi } from '../api/worklist.api';
import { caseApi } from '../api/case.api';
import { reportsService } from '../services/reports.service';
import { docketraIntelligenceApi } from '../api/docketraIntelligence.api';
import { toArray } from '../pages/platform/PlatformShared';
import { CASE_STATUS } from '../utils/constants';
import { trackAsync } from '../utils/performanceMonitor';

const queueDefaults = {
  placeholderData: keepPreviousData,
  staleTime: 90 * 1000,
  gcTime: 15 * 60 * 1000,
};

const extractListPayload = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  if (Array.isArray(res)) return res;
  return [];
};

export const usePlatformDashboardSummaryQuery = () => useQuery({
  queryKey: ['platform', 'dashboard-summary'],
  queryFn: () => trackAsync('platform.dashboard.summary', 'platform:dashboard:summary', () => dashboardApi.getSummary({ filter: 'ALL' })),
  select: (res) => res?.data || res?.data?.data || {},
  ...queueDefaults,
});

export const usePlatformRiskBriefQuery = () => useQuery({
  queryKey: ['platform', 'risk-brief'],
  queryFn: () => trackAsync('platform.dashboard.risk-brief', 'platform:dashboard:risk-brief', () => dashboardApi.getRiskBrief()),
  select: (res) => res?.data || res?.data?.data || {},
  ...queueDefaults,
});

export const usePlatformMyWorklistQuery = (options = {}) => useQuery({
  queryKey: ['platform', 'my-worklist', options.assigneeXID || 'self', options.status || 'ALL', options.category || 'ALL', options.workbasketId || 'all-workbaskets'],
  queryFn: () => trackAsync('platform.worklist.my', 'platform:worklist:my', () => worklistApi.getEmployeeWorklist({ limit: 50, ...options })),
  select: (res) => extractListPayload(res),
  ...queueDefaults,
});

export const usePlatformWorkbenchQuery = (options = {}) => useQuery({
  queryKey: ['platform', 'workbench', options.workbasketId || 'all-workbaskets'],
  queryFn: () => trackAsync('platform.worklist.global', 'platform:worklist:global', () => worklistApi.getGlobalWorklist({ limit: 50, ...options })),
  select: (res) => toArray(extractListPayload(res)),
  ...queueDefaults,
});

export const usePlatformQcQueueQuery = () => useQuery({
  queryKey: ['platform', 'qc-workbench'],
  queryFn: () => trackAsync('platform.qc.queue', 'platform:qc:queue', () => caseApi.getCases({ status: CASE_STATUS.QC_PENDING, limit: 50 })),
  select: (res) => toArray(extractListPayload(res)),
  ...queueDefaults,
});

export const usePlatformReportsMetricsQuery = () => useQuery({
  queryKey: ['platform', 'reports-metrics'],
  queryFn: () => trackAsync('platform.reports.metrics', 'platform:reports:metrics', () => reportsService.getCaseMetrics()),
  select: (res) => toArray(extractListPayload(res)),
  staleTime: 2 * 60 * 1000,
  gcTime: 20 * 60 * 1000,
  placeholderData: keepPreviousData,
});

export const usePlatformTaskManagerStatsQuery = () => {
  const dashboard = usePlatformDashboardSummaryQuery();
  const myWorklist = usePlatformMyWorklistQuery();
  const workbench = usePlatformWorkbenchQuery();
  const qcQueue = usePlatformQcQueueQuery();

  const summary = dashboard.data || {};
  const myWorklistRows = myWorklist.data || [];
  const workbenchRows = workbench.data || [];
  const qcRows = qcQueue.data || [];

  return {
    isLoading: dashboard.isLoading || myWorklist.isLoading || workbench.isLoading || qcQueue.isLoading,
    isFetching: dashboard.isFetching || myWorklist.isFetching || workbench.isFetching || qcQueue.isFetching,
    isError: dashboard.isError && myWorklist.isError && workbench.isError && qcQueue.isError,
    stats: {
      allActiveDockets: Number(summary.inProgress || 0) + Number(summary.pending || 0) + Number(summary.inQc || 0),
      myWorklistCount: myWorklistRows.length,
      workbasketCount: workbenchRows.length,
      qcPendingCount: qcRows.length,
    },
  };
};

export const usePlatformWorkloadIntelligenceQuery = (options = {}, queryOptions = {}) => useQuery({
  queryKey: ['platform', 'docketra-intelligence', 'workload', options.workbasketId || 'all-workbaskets', options.assigneeXID || 'all-assignees'],
  queryFn: () => trackAsync('platform.docketra-intelligence.workload', 'platform:docketra-intelligence:workload', () => docketraIntelligenceApi.getWorkload(options)),
  select: (res) => res?.data || {},
  staleTime: 90 * 1000,
  gcTime: 15 * 60 * 1000,
  placeholderData: keepPreviousData,
  ...queryOptions,
});

export const usePlatformWorkbasketCapacityQuery = (options = {}, queryOptions = {}) => useQuery({
  queryKey: ['platform', 'docketra-intelligence', 'workbasket-capacity', options.busyThreshold || 'default-busy', options.overloadedThreshold || 'default-overloaded', options.includeQc ? 'include-qc' : 'primary-only'],
  queryFn: () => trackAsync('platform.docketra-intelligence.workbasket-capacity', 'platform:docketra-intelligence:workbasket-capacity', () => docketraIntelligenceApi.getWorkbasketCapacity(options)),
  select: (res) => res?.data || {},
  staleTime: 90 * 1000,
  gcTime: 15 * 60 * 1000,
  placeholderData: keepPreviousData,
  ...queryOptions,
});

export const usePlatformDeadlineRiskQuery = (queryOptions = {}) => useQuery({
  queryKey: ['platform', 'docketra-intelligence', 'deadline-risk'],
  queryFn: () => trackAsync('platform.docketra-intelligence.deadline-risk', 'platform:docketra-intelligence:deadline-risk', () => docketraIntelligenceApi.getDeadlineRisk()),
  select: (res) => res?.data || {},
  staleTime: 60 * 1000,
  gcTime: 15 * 60 * 1000,
  placeholderData: keepPreviousData,
  ...queryOptions,
});
