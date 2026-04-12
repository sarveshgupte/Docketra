import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import { caseApi } from '../api/case.api';

export const ActiveDocketContext = createContext(null);

const normalizeCasePayload = (response) => response?.data?.case || response?.data || response?.case || response || null;

export const ActiveDocketProvider = ({ children }) => {
  const [activeDocketId, setActiveDocketId] = useState(null);
  const [activeDocketData, setActiveDocketData] = useState(null);
  const [isDocketLoading, setIsDocketLoading] = useState(false);
  const requestRef = useRef(0);
  const activeIdRef = useRef(null);

  const beginDocketOpen = useCallback((caseId) => {
    activeIdRef.current = caseId;
    setActiveDocketId(caseId);
    setIsDocketLoading(true);
  }, []);

  const fetchDocket = useCallback(async (caseId) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    try {
      const response = await caseApi.getCaseById(caseId, {
        commentsPage: 1,
        commentsLimit: 25,
        activityPage: 1,
        activityLimit: 25,
      });
      if (response.notModified && !response.data) return activeDocketData;
      const normalized = normalizeCasePayload(response);

      if (requestId === requestRef.current && normalized && normalized.caseId === activeIdRef.current) {
        setActiveDocketData(normalized);
      }
      return normalized;
    } finally {
      if (requestId === requestRef.current && caseId === activeIdRef.current) {
        setIsDocketLoading(false);
      }
    }
  }, []);

  const openDocket = useCallback(({ caseId, navigate, to, state }) => {
    beginDocketOpen(caseId);
    if (navigate && to) {
      navigate(to, state ? { state } : undefined);
    }
    void fetchDocket(caseId).catch(() => null);
  }, [beginDocketOpen, fetchDocket]);

  const value = useMemo(() => ({
    activeDocketId,
    activeDocketData,
    isDocketLoading,
    setActiveDocketData,
    setIsDocketLoading,
    beginDocketOpen,
    fetchDocket,
    openDocket,
  }), [activeDocketData, activeDocketId, beginDocketOpen, fetchDocket, isDocketLoading, openDocket]);

  return <ActiveDocketContext.Provider value={value}>{children}</ActiveDocketContext.Provider>;
};
