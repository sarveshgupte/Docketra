import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const inFlightRef = useRef(null);

  const fetchCase = useCallback(async () => {
    if (!caseId) return { data: null };
    if (inFlightRef.current) {
      const response = await inFlightRef.current;
      return { data: response };
    }

    const promise = caseApi.getCaseById(caseId, CASE_QUERY_PARAMS);
    inFlightRef.current = promise;
    try {
      const response = await promise;
      setData(response);
      setError(null);
      return { data: response };
    } catch (fetchError) {
      setError(fetchError);
      throw fetchError;
    } finally {
      inFlightRef.current = null;
    }
  }, [caseId]);

  useEffect(() => {
    if (!enabled || !caseId) return undefined;
    void fetchCase();

    const intervalMs = typeof refetchInterval === 'function' ? refetchInterval() : refetchInterval;
    if (!intervalMs || Number(intervalMs) <= 0) return undefined;

    const timer = window.setInterval(() => {
      void fetchCase();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [caseId, enabled, fetchCase, refetchInterval]);

  return {
    data,
    error,
    refetch: fetchCase,
  };
};

export { CASE_QUERY_PARAMS };
