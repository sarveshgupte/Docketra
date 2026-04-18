import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard.api';

const PAGE_SIZE = 10;

const EMPTY_WIDGET = { items: [], total: 0, hasNextPage: false };
const EMPTY_SUMMARY = {
  myDockets: EMPTY_WIDGET,
  overdueDockets: EMPTY_WIDGET,
  recentDockets: EMPTY_WIDGET,
  workbasketLoad: [],
};

export const useDashboardWidgetQuery = (widgetKey, { filter, page, sort, workbasketId }) =>
  useQuery({
    queryKey: ['dashboard', widgetKey, { filter, page, sort, workbasketId }],
    queryFn: () =>
      dashboardApi.getSummary({ filter, page, limit: PAGE_SIZE, sort, workbasketId, only: widgetKey }),
    select: (result) => result?.data?.[widgetKey] ?? EMPTY_SUMMARY[widgetKey],
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

export const useSetupStatusQuery = () =>
  useQuery({
    queryKey: ['firm', 'setup-status'],
    queryFn: () => dashboardApi.getSetupStatus(),
    select: (result) => Boolean(result?.data?.isSetupComplete),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
