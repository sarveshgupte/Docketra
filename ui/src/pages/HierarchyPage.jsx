import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Loading } from '../components/common/Loading';
import { adminApi } from '../api/admin.api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants/routes';

const EMPTY_TREE = {
  primaryAdmin: null,
  admins: [],
  unassignedUsers: [],
  stats: {
    totalMembers: 0,
    adminsCount: 0,
    managersCount: 0,
    usersCount: 0,
    unassignedCount: 0,
  },
};

const normalizeTree = (tree) => ({
  primaryAdmin: tree?.primaryAdmin || null,
  admins: Array.isArray(tree?.admins) ? tree.admins : [],
  unassignedUsers: Array.isArray(tree?.unassignedUsers) ? tree.unassignedUsers : [],
  stats: {
    totalMembers: Number(tree?.stats?.totalMembers || 0),
    adminsCount: Number(tree?.stats?.adminsCount || 0),
    managersCount: Number(tree?.stats?.managersCount || 0),
    usersCount: Number(tree?.stats?.usersCount || 0),
    unassignedCount: Number(tree?.stats?.unassignedCount || 0),
  },
});

const getInitials = (name = '') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getRolePresentation = (role = '') => {
  const r = String(role || '').toUpperCase();
  switch (r) {
    case 'PRIMARY_ADMIN':
      return {
        label: 'Primary Admin',
        tag: 'Primary Admin',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        ringClass: 'ring-2 ring-amber-500/50',
        avatarBg: 'bg-gradient-to-br from-amber-500 to-amber-700 text-white',
        borderClass: 'border-amber-300 dark:border-amber-800/80',
        accentBg: 'bg-amber-50/70 dark:bg-amber-950/20',
      };
    case 'ADMIN':
      return {
        label: 'Partner / Admin',
        tag: 'Admin',
        badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        ringClass: 'ring-2 ring-indigo-500/40',
        avatarBg: 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white',
        borderClass: 'border-indigo-200 dark:border-indigo-800/60',
        accentBg: 'bg-indigo-50/50 dark:bg-indigo-950/15',
      };
    case 'MANAGER':
      return {
        label: 'Manager / Lead',
        tag: 'Manager',
        badgeClass: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
        ringClass: 'ring-2 ring-teal-500/40',
        avatarBg: 'bg-gradient-to-br from-teal-600 to-emerald-800 text-white',
        borderClass: 'border-teal-200 dark:border-teal-800/60',
        accentBg: 'bg-teal-50/40 dark:bg-teal-950/15',
      };
    default:
      return {
        label: 'Associate / Staff',
        tag: 'Employee',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
        ringClass: 'ring-1 ring-slate-300 dark:ring-slate-700',
        avatarBg: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
        borderClass: 'border-slate-200 dark:border-slate-800',
        accentBg: 'bg-white dark:bg-slate-900',
      };
  }
};

export const HierarchyPage = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user: loggedInUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [tree, setTree] = useState(EMPTY_TREE);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [collapsedAdmins, setCollapsedAdmins] = useState(new Set());
  const [collapsedManagers, setCollapsedManagers] = useState(new Set());

  // Edit state in Profile Drawer
  const [editAdminId, setEditAdminId] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [savingHierarchy, setSavingHierarchy] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const isPrimaryAdmin = useMemo(() => {
    const role = String(loggedInUser?.role || '').toUpperCase();
    return role === 'PRIMARY_ADMIN' || Boolean(loggedInUser?.isPrimaryAdmin);
  }, [loggedInUser]);

  const showToastRef = React.useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const loadHierarchy = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setLoadError(null);
    try {
      const response = await adminApi.getHierarchy();
      if (response?.success) {
        const normalized = normalizeTree(response.data);
        setTree(normalized);
      } else {
        setTree(EMPTY_TREE);
      }
    } catch (error) {
      setTree(EMPTY_TREE);
      const errorMessage = error?.data?.message || error?.response?.data?.message || error?.message || 'Failed to load organization hierarchy';
      setLoadError(errorMessage);
      showToastRef.current(errorMessage, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  // When drawer user changes, initialize edit form values
  useEffect(() => {
    if (selectedUser) {
      setEditAdminId(selectedUser.adminId || '');
      setEditManagerId(selectedUser.managerId || '');
    }
  }, [selectedUser]);

  // All known users in a flat lookup map for quick referencing
  const allUsersMap = useMemo(() => {
    const map = new Map();
    if (tree.primaryAdmin) {
      map.set(String(tree.primaryAdmin.id), tree.primaryAdmin);
    }
    tree.admins.forEach((admin) => {
      map.set(String(admin.id), admin);
      (admin.managers || []).forEach((mgr) => {
        map.set(String(mgr.id), mgr);
        (mgr.users || []).forEach((u) => map.set(String(u.id), u));
      });
      (admin.users || []).forEach((u) => map.set(String(u.id), u));
    });
    tree.unassignedUsers.forEach((u) => map.set(String(u.id), u));
    return map;
  }, [tree]);

  // Admin options for edit dropdown
  const adminOptions = useMemo(() => {
    const options = [{ value: '', label: 'Unassigned (No Admin / Partner)' }];
    tree.admins.forEach((admin) => {
      options.push({
        value: String(admin.id),
        label: `${admin.name || admin.email || 'Admin'} (${admin.xID || 'No xID'})`,
      });
    });
    return options;
  }, [tree.admins]);

  // Manager options based on currently selected editAdminId
  const managerOptions = useMemo(() => {
    const options = [{ value: '', label: 'Direct under Admin (No Manager)' }];
    if (!editAdminId) return options;

    const currentAdmin = tree.admins.find((a) => String(a.id) === String(editAdminId));
    if (currentAdmin && Array.isArray(currentAdmin.managers)) {
      currentAdmin.managers.forEach((mgr) => {
        // Prevent setting self as manager
        if (selectedUser && String(mgr.id) === String(selectedUser.id)) return;
        options.push({
          value: String(mgr.id),
          label: `${mgr.name || mgr.email || 'Manager'} (${mgr.xID || 'No xID'})`,
        });
      });
    }
    return options;
  }, [tree.admins, editAdminId, selectedUser]);

  // Upward reporting chain calculation for the selected user
  const reportingChain = useMemo(() => {
    if (!selectedUser) return [];
    const chain = [];
    const role = String(selectedUser.role || '').toUpperCase();

    if (role === 'PRIMARY_ADMIN') {
      chain.push({ ...selectedUser, levelLabel: 'Top of Organization' });
      return chain;
    }

    if (tree.primaryAdmin) {
      chain.push({ ...tree.primaryAdmin, levelLabel: 'Firm Primary Admin' });
    }

    if (role === 'ADMIN') {
      chain.push({ ...selectedUser, levelLabel: 'Admin / Partner' });
      return chain;
    }

    // For Manager or User, find their Admin
    if (selectedUser.adminId) {
      const admin = allUsersMap.get(String(selectedUser.adminId));
      if (admin) {
        chain.push({ ...admin, levelLabel: 'Direct Partner / Admin' });
      }
    }

    // For User, check if they have a Manager
    if (role === 'USER' && selectedUser.managerId) {
      const mgr = allUsersMap.get(String(selectedUser.managerId));
      if (mgr) {
        chain.push({ ...mgr, levelLabel: 'Direct Reporting Manager' });
      }
    }

    // Finally add the user themselves
    chain.push({ ...selectedUser, levelLabel: 'Selected Member', isCurrent: true });
    return chain;
  }, [selectedUser, tree.primaryAdmin, allUsersMap]);

  // Downward direct reports calculation for selected user
  const directReports = useMemo(() => {
    if (!selectedUser) return [];
    const role = String(selectedUser.role || '').toUpperCase();

    if (role === 'PRIMARY_ADMIN') {
      return tree.admins;
    }

    if (role === 'ADMIN') {
      const liveAdmin = tree.admins.find((a) => String(a.id) === String(selectedUser.id));
      if (!liveAdmin) return [];
      const mgrs = (liveAdmin.managers || []).map((m) => ({ ...m, roleType: 'MANAGER' }));
      const directUsers = (liveAdmin.users || []).map((u) => ({ ...u, roleType: 'USER' }));
      return [...mgrs, ...directUsers];
    }

    if (role === 'MANAGER') {
      // Find this manager in any admin
      for (const admin of tree.admins) {
        const found = (admin.managers || []).find((m) => String(m.id) === String(selectedUser.id));
        if (found) return found.users || [];
      }
      return [];
    }

    return [];
  }, [selectedUser, tree.admins]);

  // Toggle admin collapse
  const toggleAdminCollapse = (adminId, e) => {
    if (e) e.stopPropagation();
    setCollapsedAdmins((prev) => {
      const next = new Set(prev);
      if (next.has(adminId)) next.delete(adminId);
      else next.add(adminId);
      return next;
    });
  };

  // Toggle manager collapse
  const toggleManagerCollapse = (managerId, e) => {
    if (e) e.stopPropagation();
    setCollapsedManagers((prev) => {
      const next = new Set(prev);
      if (next.has(managerId)) next.delete(managerId);
      else next.add(managerId);
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedAdmins(new Set());
    setCollapsedManagers(new Set());
  };

  const collapseAll = () => {
    const adminIds = new Set(tree.admins.map((a) => a.id));
    const managerIds = new Set();
    tree.admins.forEach((a) => {
      (a.managers || []).forEach((m) => managerIds.add(m.id));
    });
    setCollapsedAdmins(adminIds);
    setCollapsedManagers(managerIds);
  };

  // Copy xID handler
  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`Copied ${text} to clipboard`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Save Reporting Line (Primary Admin Only)
  const handleSaveReportingLine = async () => {
    if (!isPrimaryAdmin) {
      showToast('Only Primary Admin can alter organization reporting lines', 'error');
      return;
    }
    if (!selectedUser) return;

    setSavingHierarchy(true);
    try {
      const response = await adminApi.updateUserHierarchy(selectedUser.id, {
        adminId: editAdminId || null,
        managerId: editManagerId || null,
      });

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to update reporting line');
      }

      showToast(`Updated reporting line for ${selectedUser.name || 'user'}`, 'success');
      await loadHierarchy(true);

      // Refresh drawer selected user reference
      setSelectedUser((prev) => prev ? {
        ...prev,
        adminId: editAdminId || null,
        managerId: editManagerId || null,
      } : null);
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Failed to update hierarchy', 'error');
    } finally {
      setSavingHierarchy(false);
    }
  };

  // Filter check
  const matchesSearch = useCallback((user) => {
    if (!user) return false;
    if (roleFilter !== 'ALL') {
      const r = String(user.role || '').toUpperCase();
      if (roleFilter === 'ADMIN' && r !== 'ADMIN') return false;
      if (roleFilter === 'MANAGER' && r !== 'MANAGER') return false;
      if (roleFilter === 'USER' && r !== 'USER') return false;
    }
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase().trim();
    const nameMatch = String(user.name || '').toLowerCase().includes(term);
    const emailMatch = String(user.email || '').toLowerCase().includes(term);
    const xidMatch = String(user.xID || '').toLowerCase().includes(term);
    const deptMatch = String(user.department || '').toLowerCase().includes(term);
    const roleMatch = String(user.role || '').toLowerCase().includes(term);

    return nameMatch || emailMatch || xidMatch || deptMatch || roleMatch;
  }, [searchTerm, roleFilter]);

  // Count total matches
  const matchCount = useMemo(() => {
    if (!searchTerm.trim() && roleFilter === 'ALL') return null;
    let count = 0;
    allUsersMap.forEach((u) => {
      if (matchesSearch(u)) count += 1;
    });
    return count;
  }, [searchTerm, roleFilter, allUsersMap, matchesSearch]);

  // Render Member Card
  const renderMemberCard = (user, options = {}) => {
    if (!user) return null;
    const isMatched = (searchTerm.trim() || roleFilter !== 'ALL') && matchesSearch(user);
    const isSelected = selectedUser && String(selectedUser.id) === String(user.id);
    const pres = getRolePresentation(user.role);
    const isInactive = user.status === 'inactive' || user.isActive === false;

    return (
      <div
        key={user.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedUser(user)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedUser(user);
          }
        }}
        className={`group relative rounded-xl border p-4 transition-all duration-200 text-left bg-white dark:bg-slate-900 ${pres.borderClass} ${
          isSelected
            ? 'ring-2 ring-indigo-500 shadow-md border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/30'
            : isMatched
              ? 'ring-2 ring-emerald-500 shadow-md border-emerald-400 bg-emerald-50/20'
              : 'hover:border-indigo-400 hover:shadow-md'
        } ${options.className || ''}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar with role ring */}
          <div className={`relative flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm shadow-sm ${pres.avatarBg} ${pres.ringClass}`}>
            {getInitials(user.name || user.email)}
            {/* Status dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                isInactive ? 'bg-slate-400' : 'bg-emerald-500'
              }`}
              title={isInactive ? 'Inactive account' : 'Active account'}
            />
          </div>

          {/* User Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {user.name || user.email || 'Unnamed'}
              </h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${pres.badgeClass}`}>
                {pres.tag}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              {user.xID && (
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 font-medium">
                  {user.xID}
                </span>
              )}
              {user.department && (
                <span className="truncate max-w-[140px] text-slate-600 dark:text-slate-300">
                  {user.department}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {user.email}
            </p>

            {/* Team metrics & expand toggle */}
            {options.headcount && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {options.headcount}
                </span>

                {options.onToggleCollapse && (
                  <button
                    type="button"
                    onClick={options.onToggleCollapse}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                  >
                    {options.isCollapsed ? (
                      <>
                        <span>Expand</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    ) : (
                      <>
                        <span>Collapse</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <PlatformShell
      moduleLabel="Organization"
      title="Organization Structure"
      subtitle="Interactive firm reporting lines, direct reports, and team hierarchy."
      actions={(
        <div className="flex items-center gap-2">
          {isPrimaryAdmin ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
              <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v4a1 1 0 102 0V7z" clipRule="evenodd" />
              </svg>
              Primary Admin • Edit Mode
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              👁️ Team View (Read-Only)
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(ROUTES.ADMIN(firmSlug))}
            title="Switch to Users & Team table view"
          >
            <span className="mr-1">☵</span> Table View
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadHierarchy(true)}
            disabled={refreshing}
            title="Reload organization structure"
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </Button>
        </div>
      )}
    >
      <div className="space-y-6 pb-16">
        {/* Top Summary Metrics Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Headcount</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '--' : tree.stats.totalMembers}
            </p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 shadow-sm dark:border-indigo-950 dark:bg-indigo-950/20">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Partners / Admins</p>
            <p className="mt-1 text-2xl font-bold text-indigo-950 dark:text-indigo-100">
              {loading ? '--' : tree.stats.adminsCount}
            </p>
          </div>

          <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3.5 shadow-sm dark:border-teal-950 dark:bg-teal-950/20">
            <p className="text-xs font-medium uppercase tracking-wider text-teal-700 dark:text-teal-300">Team Leads / Mgrs</p>
            <p className="mt-1 text-2xl font-bold text-teal-950 dark:text-teal-100">
              {loading ? '--' : tree.stats.managersCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Associates / Staff</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '--' : tree.stats.usersCount}
            </p>
          </div>

          <div className={`rounded-xl border p-3.5 shadow-sm col-span-2 sm:col-span-1 ${
            tree.stats.unassignedCount > 0
              ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}>
            <p className={`text-xs font-medium uppercase tracking-wider ${
              tree.stats.unassignedCount > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
            }`}>
              Unassigned
            </p>
            <p className={`mt-1 text-2xl font-bold ${
              tree.stats.unassignedCount > 0 ? 'text-amber-900 dark:text-amber-200' : 'text-slate-900 dark:text-white'
            }`}>
              {loading ? '--' : tree.stats.unassignedCount}
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <Card>
          <div className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search colleague by name, email, or xID..."
                className="w-full pl-10 pr-9 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
              {[
                { id: 'ALL', label: 'All Roles' },
                { id: 'ADMIN', label: 'Admins' },
                { id: 'MANAGER', label: 'Managers' },
                { id: 'USER', label: 'Associates' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setRoleFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                    roleFilter === pill.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {pill.label}
                </button>
              ))}

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={expandAll} title="Expand all nodes">
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} title="Collapse all nodes">
                  Collapse All
                </Button>
              </div>
            </div>
          </div>

          {/* Search match counter feedback */}
          {matchCount !== null && (
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>
                Found <strong>{matchCount}</strong> {matchCount === 1 ? 'member' : 'members'} matching criteria.
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('ALL');
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear filter
              </button>
            </div>
          )}
        </Card>

        {/* Tree Container */}
        {loading ? (
          <Loading message="Loading organization structure..." />
        ) : loadError ? (
          <Card>
            <div className="py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-200">Failed to load organization structure</p>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{loadError}</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button onClick={() => loadHierarchy()} variant="outline">
                  Retry
                </Button>
                <Button variant="primary" onClick={() => navigate(ROUTES.ADMIN(firmSlug))}>
                  Go to Users & Team
                </Button>
              </div>
            </div>
          </Card>
        ) : !tree.primaryAdmin && !tree.admins.length && !tree.unassignedUsers.length ? (
          <Card>
            <div className="py-12 text-center">
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No team members found</p>
              <p className="mt-1 text-sm text-slate-500">Add users in User Management to establish firm reporting lines.</p>
              <div className="mt-4">
                <Button variant="primary" onClick={() => navigate(ROUTES.ADMIN(firmSlug))}>
                  Go to Users & Team
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* LEVEL 0: ROOT - PRIMARY ADMIN */}
            {tree.primaryAdmin && (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-md">
                  {renderMemberCard(tree.primaryAdmin, {
                    className: 'border-2 shadow-sm',
                    headcount: `${tree.admins.length} Partner${tree.admins.length === 1 ? '' : 's'} • ${tree.stats.totalMembers} Total Firm Headcount`,
                  })}
                </div>

                {/* Vertical tree trunk connector line */}
                {tree.admins.length > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700" />
                    <div className="w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-950" />
                    <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700" />
                  </div>
                )}
              </div>
            )}

            {/* LEVEL 1: ADMINS / PARTNERS */}
            {tree.admins.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Practice Partners & Admins ({tree.admins.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">Reporting directly to Primary Admin</span>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {tree.admins.map((admin) => {
                    const isCollapsed = collapsedAdmins.has(admin.id);
                    const managerCount = (admin.managers || []).length;
                    const directUserCount = (admin.users || []).length;
                    const totalReports = admin.totalReportsCount || (managerCount + directUserCount);

                    return (
                      <div
                        key={admin.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50 flex flex-col justify-between"
                      >
                        {/* Admin Card */}
                        <div>
                          {renderMemberCard(admin, {
                            headcount: `${managerCount} Leads • ${directUserCount} Direct Staff (${totalReports} Total)`,
                            isCollapsed,
                            onToggleCollapse: (e) => toggleAdminCollapse(admin.id, e),
                          })}

                          {/* Subtree: Managers & Direct Staff */}
                          {!isCollapsed && (
                            <div className="mt-4 pl-3 border-l-2 border-indigo-200 dark:border-indigo-900/80 space-y-4">
                              {/* Managers */}
                              {managerCount > 0 && (
                                <div className="space-y-3">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                                    Team Leads / Managers ({managerCount})
                                  </p>

                                  {admin.managers.map((mgr) => {
                                    const isMgrCollapsed = collapsedManagers.has(mgr.id);
                                    const staffCount = (mgr.users || []).length;

                                    return (
                                      <div key={mgr.id} className="space-y-2">
                                        {renderMemberCard(mgr, {
                                          headcount: `${staffCount} Associate${staffCount === 1 ? '' : 's'}`,
                                          isCollapsed: isMgrCollapsed,
                                          onToggleCollapse: (e) => toggleManagerCollapse(mgr.id, e),
                                        })}

                                        {/* Direct Associates under this manager */}
                                        {!isMgrCollapsed && staffCount > 0 && (
                                          <div className="ml-4 pl-3 border-l-2 border-teal-200 dark:border-teal-900/80 space-y-2">
                                            {mgr.users.map((staff) => renderMemberCard(staff))}
                                          </div>
                                        )}

                                        {!isMgrCollapsed && staffCount === 0 && (
                                          <p className="ml-4 text-xs italic text-slate-400">No associates currently assigned.</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Direct staff under Admin (no manager) */}
                              {directUserCount > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Direct Associates ({directUserCount})
                                  </p>
                                  <div className="space-y-2">
                                    {admin.users.map((staff) => renderMemberCard(staff))}
                                  </div>
                                </div>
                              )}

                              {managerCount === 0 && directUserCount === 0 && (
                                <p className="text-xs italic text-slate-400 py-1">No direct team members under this partner.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UNASSIGNED MEMBERS SECTION */}
            {tree.unassignedUsers.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex items-center justify-between pb-3 border-b border-amber-200/80 dark:border-amber-900/80">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-xs font-bold">!</span>
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      Unassigned Team Members ({tree.unassignedUsers.length})
                    </h3>
                  </div>
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    {isPrimaryAdmin ? 'Click any card to assign reporting line' : 'Awaiting reporting assignment by Primary Admin'}
                  </span>
                </div>

                <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/80">
                  These team members do not currently report to a designated Partner or Manager.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tree.unassignedUsers.map((u) => renderMemberCard(u))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SLIDE-OVER PERSON PROFILE DRAWER */}
        {selectedUser && (
          <div
            className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedUser(null)}
          >
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div
                className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col transform transition-transform"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/80">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Team Member Profile
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Member Overview Card */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-800/30 flex items-start gap-4">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${getRolePresentation(selectedUser.role).avatarBg} ${getRolePresentation(selectedUser.role).ringClass}`}>
                      {getInitials(selectedUser.name || selectedUser.email)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                        {selectedUser.name || selectedUser.email || 'Unnamed'}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getRolePresentation(selectedUser.role).badgeClass}`}>
                          {getRolePresentation(selectedUser.role).tag}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${
                          selectedUser.status === 'inactive' || selectedUser.isActive === false
                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${selectedUser.status === 'inactive' ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                          {selectedUser.status === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attributes & Contact */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    <div className="p-3 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Employee ID (xID)</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {selectedUser.xID || 'Unassigned'}
                        </span>
                        {selectedUser.xID && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedUser.xID, selectedUser.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Copy xID"
                          >
                            {copiedId === selectedUser.id ? (
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Email Address</span>
                      <a
                        href={`mailto:${selectedUser.email}`}
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[200px]"
                      >
                        {selectedUser.email || '—'}
                      </a>
                    </div>

                    {selectedUser.phoneNumber && (
                      <div className="p-3 flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Phone Number</span>
                        <a
                          href={`tel:${selectedUser.phoneNumber}`}
                          className="font-medium text-slate-800 dark:text-slate-200 hover:underline"
                        >
                          {selectedUser.phoneNumber}
                        </a>
                      </div>
                    )}

                    <div className="p-3 flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Department</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedUser.department || 'General Practice'}
                      </span>
                    </div>
                  </div>

                  {/* Upward Reporting Line (Breadcrumb Chain) */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                      Reporting Line (Upward)
                    </h4>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/20 space-y-2">
                      {reportingChain.map((step, idx) => (
                        <div key={step.id || idx} className="flex items-start gap-3 relative">
                          {/* Chain connector line */}
                          {idx < reportingChain.length - 1 && (
                            <div className="absolute left-3.5 top-7 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 -mb-2" />
                          )}

                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shadow-xs z-10 ${getRolePresentation(step.role).avatarBg}`}>
                            {getInitials(step.name || step.email)}
                          </div>

                          <div className="flex-1 pb-2">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  const targetNode = allUsersMap.get(String(step.id));
                                  if (targetNode) setSelectedUser(targetNode);
                                }}
                                className={`text-xs font-bold text-left hover:text-indigo-600 transition-colors ${
                                  step.isCurrent ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {step.name || step.email || 'Unnamed'} {step.xID ? `(${step.xID})` : ''}
                              </button>
                              <span className="text-[10px] text-slate-400">
                                {step.levelLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Downward Direct Reports (If any) */}
                  {directReports.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        </svg>
                        Direct Reports ({directReports.length})
                      </h4>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                        {directReports.map((report) => (
                          <div
                            key={report.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              const targetNode = allUsersMap.get(String(report.id));
                              if (targetNode) setSelectedUser(targetNode);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const targetNode = allUsersMap.get(String(report.id));
                                if (targetNode) setSelectedUser(targetNode);
                              }
                            }}
                            className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${getRolePresentation(report.role).avatarBg}`}>
                                {getInitials(report.name || report.email)}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {report.name || report.email}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  {report.xID || report.role}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Inspect →</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary Admin Edit Hierarchy Form */}
                  {isPrimaryAdmin && selectedUser.role !== 'PRIMARY_ADMIN' && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-indigo-800 text-xs font-bold">⚙</span>
                        <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                          Reorganize Reporting Line
                        </h4>
                      </div>

                      <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80">
                        Primary Admin privilege: reassign which Partner and Manager this team member reports to.
                      </p>

                      <div className="space-y-3">
                        <Select
                          label="Reporting Partner / Admin"
                          value={editAdminId}
                          options={adminOptions}
                          disabled={savingHierarchy}
                          onChange={(e) => {
                            setEditAdminId(e.target.value);
                            setEditManagerId(''); // Reset manager when admin changes
                          }}
                        />

                        {selectedUser.role === 'USER' && (
                          <Select
                            label="Reporting Manager / Lead"
                            value={editManagerId}
                            options={managerOptions}
                            disabled={savingHierarchy || !editAdminId}
                            onChange={(e) => setEditManagerId(e.target.value)}
                          />
                        )}

                        <div className="pt-2">
                          <Button
                            variant="primary"
                            className="w-full justify-center"
                            onClick={handleSaveReportingLine}
                            disabled={savingHierarchy}
                          >
                            {savingHierarchy ? 'Saving Changes...' : 'Save Reporting Line'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isPrimaryAdmin && selectedUser.role !== 'PRIMARY_ADMIN' && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 flex items-center gap-2">
                      <span className="text-base">🔒</span>
                      <span>Reporting managers can only be reassigned by the firm's Primary Admin.</span>
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Docketra Governance Engine</span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PlatformShell>
  );
};

export default HierarchyPage;
