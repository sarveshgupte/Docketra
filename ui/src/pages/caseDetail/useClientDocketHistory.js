import { useEffect, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { CASE_DETAIL_TABS } from '../../utils/constants';

export const useClientDocketHistory = ({ activeTab, clientId, caseId }) => {
  const [loadingClientDockets, setLoadingClientDockets] = useState(false);
  const [clientDockets, setClientDockets] = useState([]);

  useEffect(() => {
    if (!clientId) return;
    if (![CASE_DETAIL_TABS.OVERVIEW, CASE_DETAIL_TABS.HISTORY].includes(activeTab)) return;
    const loadClientDockets = async () => {
      setLoadingClientDockets(true);
      try {
        const response = await caseApi.getClientDockets(clientId);
        const rows = response.data || response.dockets || [];
        setClientDockets(rows.filter((row) => row.caseId !== caseId));
      } catch (_error) {
        setClientDockets([]);
      } finally {
        setLoadingClientDockets(false);
      }
    };
    loadClientDockets();
  }, [activeTab, caseId, clientId]);

  return {
    loadingClientDockets,
    clientDockets,
  };
};

