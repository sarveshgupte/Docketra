import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caseApi } from '../api/case.api';

const CASE_QUERY_PARAMS = {
  commentsPage: 1,
  commentsLimit: 25,
  activityPage: 1,
  activityLimit: 25,
};

export const getCaseQueryKey = (caseId, params = CASE_QUERY_PARAMS) => ['case', caseId, params];

export const useCaseQuery = (caseId, options = {}) => {
  const {
    enabled = true,
    refetchInterval = false,
    staleTime = 90 * 1000,
    gcTime = 20 * 60 * 1000,
  } = options;
  const resolvedEnabled = Boolean(enabled && caseId);
  const query = useQuery({
    queryKey: getCaseQueryKey(caseId, CASE_QUERY_PARAMS),
    queryFn: () => caseApi.getCaseById(caseId, CASE_QUERY_PARAMS),
    enabled: resolvedEnabled,
    staleTime,
    gcTime,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: (queryContext) => (
      typeof refetchInterval === 'function'
        ? refetchInterval(queryContext)
        : refetchInterval
    ),
  });

  const refetch = useCallback(
    () => query.refetch({ throwOnError: true }),
    [query]
  );

  return {
    data: query.data,
    error: query.error,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    refetch,
  };
};

export { CASE_QUERY_PARAMS };
