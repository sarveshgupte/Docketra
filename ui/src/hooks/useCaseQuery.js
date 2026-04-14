import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { caseApi } from '../api/case.api';

const CASE_QUERY_PARAMS = {
  commentsPage: 1,
  commentsLimit: 25,
  activityPage: 1,
  activityLimit: 25,
};

export const useCaseQuery = (caseId, options = {}) => {
  const {
    enabled = true,
    refetchInterval = false,
  } = options;
  const resolvedEnabled = Boolean(enabled && caseId);
  const query = useQuery({
    queryKey: ['case', caseId, CASE_QUERY_PARAMS],
    queryFn: () => caseApi.getCaseById(caseId, CASE_QUERY_PARAMS),
    enabled: resolvedEnabled,
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
    refetch,
  };
};

export { CASE_QUERY_PARAMS };
