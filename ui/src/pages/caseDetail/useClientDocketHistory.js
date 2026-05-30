import { useEffect, useState } from 'react';
import { caseApi } from '../../api/case.api';
import { CASE_DETAIL_TABS } from '../../utils/constants';

const resolveDocketId = (row) => row?.caseId || row?.docketId || row?._id || '';

export const useClientDocketHistory = ({ activeTab, clientId, caseId }) => {
  const [loadingClientDockets, setLoadingClientDockets] = useState(false);
  const [clientDockets, setClientDockets] = useState([]);
  const [clientDocketsError, setClientDocketsError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const loadClientDockets = async () => {
      setLoadingClientDockets(true);
      setClientDocketsError(false);
      try {
        const response = await caseApi.getClientDockets(clientId);
        const rows = response.data || response.dockets || [];
        const currentDocketId = String(caseId || '');
        setClientDockets(
          rows.filter((row) => String(resolveDocketId(row) || '') !== currentDocketId),
        );
      } catch (_error) {
        setClientDockets([]);
        setClientDocketsError(true);
      } finally {
        setLoadingClientDockets(false);
      }
    };
    loadClientDockets();
  }, [activeTab, caseId, clientId]);

  return {
    loadingClientDockets,
    clientDockets,
    clientDocketsError,
  };
};
