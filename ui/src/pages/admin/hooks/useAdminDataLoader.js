import { useCallback } from 'react';
import { adminApi } from '../../../api/admin.api';
import { categoryService } from '../../../services/categoryService';
import { toSafeText, normalizeCategory, EMPTY_ADMIN_STATS } from '../adminPageUtils';

export const useAdminDataLoader = ({
  activeTab,
  ensureLoggedInAdminVisible,
  notifyLoadError,
  setLoading,
  setTabError,
  setUsers,
  setCategories,
  setClients,
  setWorkbaskets,
  setAdminStats,
  setStatsEmpty,
  setStatsFailed,
}) => {
  const fetchClients = useCallback(async () => {
    const response = await adminApi.listClients({ activeOnly: false });
    const rawClients = response?.success ? (response.data || []) : [];
    const normalizedClients = Array.isArray(rawClients)
      ? rawClients.map((client) => ({
        ...client,
        businessEmail: toSafeText(client?.businessEmail, ''),
        contactPersonEmailAddress: toSafeText(client?.contactPersonEmailAddress, ''),
      }))
      : [];
    setClients(normalizedClients);
    return response;
  }, [setClients]);

  const fetchWorkbaskets = useCallback(async () => {
    const response = await adminApi.listWorkbaskets({ includeInactive: false });
    setWorkbaskets(response?.success ? (response.data || []) : []);
    return response;
  }, [setWorkbaskets]);

  const loadAdminStats = useCallback(async () => {
    try {
      const response = await adminApi.getAdminStats();
      const data = response?.success ? response.data : null;
      if (data) {
        setAdminStats(data);
        setStatsEmpty(false);
        setStatsFailed(false);
      } else {
        setAdminStats(EMPTY_ADMIN_STATS);
        setStatsEmpty(true);
        setStatsFailed(false);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load admin stats:', error);
      setStatsFailed(true);
      const errorType = notifyLoadError(error, 'admin-load');
      if (errorType === 'empty') {
        setAdminStats(EMPTY_ADMIN_STATS);
        setStatsEmpty(true);
      }
    }
  }, [notifyLoadError, setAdminStats, setStatsEmpty, setStatsFailed]);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setTabError(null);
    try {
      if (activeTab === 'users') {
        const [response] = await Promise.all([adminApi.getUsers(), fetchWorkbaskets()]);
        const apiUsers = response?.success ? (response.data || []) : [];
        const normalizedUsers = Array.isArray(apiUsers)
          ? apiUsers.map((entry) => ({
            ...entry,
            email: toSafeText(entry?.email, ''),
            name: toSafeText(entry?.name, ''),
          }))
          : [];
        setUsers(ensureLoggedInAdminVisible(normalizedUsers));
      } else if (activeTab === 'categories') {
        const [response] = await Promise.all([
          categoryService.getAdminCategories(false),
          fetchWorkbaskets(),
        ]);
        const normalizedCategories = (response?.success ? (response.data || []) : [])
          .map(normalizeCategory)
          .filter(Boolean);
        setCategories(normalizedCategories);
      } else if (activeTab === 'clients') {
        await fetchClients();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load admin data:', error);
      const errorType = notifyLoadError(error, 'admin-load');
      if (activeTab === 'clients' && errorType !== 'empty') {
        setTabError({
          tab: 'clients',
          message: errorType === 'network'
            ? 'Failed to load clients. Check your connection and retry.'
            : 'Failed to load clients.',
        });
      }
      if (errorType === 'empty') {
        if (activeTab === 'users') {
          setUsers([]);
        } else if (activeTab === 'categories') {
          setCategories([]);
        } else if (activeTab === 'clients') {
          setClients([]);
          setTabError(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, ensureLoggedInAdminVisible, fetchClients, fetchWorkbaskets, notifyLoadError, setCategories, setClients, setLoading, setTabError, setUsers]);

  return {
    fetchClients,
    fetchWorkbaskets,
    loadAdminStats,
    loadAdminData,
  };
};
