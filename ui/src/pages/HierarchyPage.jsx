import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Loading } from '../components/common/Loading';
import { adminApi } from '../api/admin.api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

const EMPTY_TREE = {
  primaryAdmin: null,
  admins: [],
  unassignedUsers: [],
};

const labelForUser = (user) => {
  if (!user) return 'Unknown';
  const xid = user.xID ? ` (${user.xID})` : '';
  return `${user.name || user.email || 'Unnamed'}${xid}`;
};

const normalizeTree = (tree) => ({
  primaryAdmin: tree?.primaryAdmin || null,
  admins: Array.isArray(tree?.admins) ? tree.admins : [],
  unassignedUsers: Array.isArray(tree?.unassignedUsers) ? tree.unassignedUsers : [],
});

export const HierarchyPage = () => {
  const { firmSlug } = useParams();
  const { showToast } = useToast();
  const { user: loggedInUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [tree, setTree] = useState(EMPTY_TREE);

  const isPrimaryAdmin = useMemo(() => {
    const role = String(loggedInUser?.role || '').toUpperCase();
    return role === 'PRIMARY_ADMIN' || Boolean(loggedInUser?.isPrimaryAdmin);
  }, [loggedInUser]);

  const loadHierarchy = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getHierarchy();
      if (response?.success) {
        setTree(normalizeTree(response.data));
      } else {
        setTree(EMPTY_TREE);
      }
    } catch (error) {
      setTree(EMPTY_TREE);
      showToast(error?.response?.data?.message || 'Failed to load hierarchy', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, []);

  const adminOptions = useMemo(() => (
    [{ value: '', label: 'Unassigned (no admin)' }].concat(
      tree.admins.map((admin) => ({ value: admin.id, label: labelForUser(admin) }))
    )
  ), [tree.admins]);

  const managerOptionsByAdmin = useMemo(() => {
    const options = new Map();
    tree.admins.forEach((admin) => {
      options.set(
        admin.id,
        [{ value: '', label: 'Unassigned (no manager)' }].concat(
          (admin.managers || []).map((manager) => ({ value: manager.id, label: labelForUser(manager) }))
        )
      );
    });
    return options;
  }, [tree.admins]);

  const handleMoveUser = async (user, nextAdminId, nextManagerId) => {
    if (!isPrimaryAdmin) {
      showToast('Only Primary Admin can manage hierarchy', 'error');
      return;
    }
    setSavingUserId(user.id);
    try {
      const response = await adminApi.updateUserHierarchy(user.id, {
        adminId: nextAdminId || null,
        managerId: nextManagerId || null,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to move user');
      }
      showToast('Hierarchy updated', 'success');
      await loadHierarchy();
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Failed to move user', 'error');
    } finally {
      setSavingUserId(null);
    }
  };

  const renderUserRow = (user, defaultAdminId = '', defaultManagerId = '') => {
    const managerOptions = managerOptionsByAdmin.get(defaultAdminId) || [{ value: '', label: 'Unassigned (no manager)' }];

    return (
      <li key={user.id} className="rounded border border-slate-200 p-3">
        <div className="mb-2 text-sm font-medium text-slate-800">{labelForUser(user)}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Admin"
            value={defaultAdminId || ''}
            disabled={!isPrimaryAdmin || savingUserId === user.id}
            options={adminOptions}
            onChange={(event) => {
              const nextAdminId = event.target.value;
              handleMoveUser(user, nextAdminId, '');
            }}
          />
          <Select
            label="Manager"
            value={defaultManagerId || ''}
            disabled={!isPrimaryAdmin || savingUserId === user.id || !defaultAdminId}
            options={managerOptions}
            onChange={(event) => {
              handleMoveUser(user, defaultAdminId, event.target.value);
            }}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              disabled
              title="Hierarchy updates are applied immediately when dropdowns change"
            >
              Move user
            </Button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <PlatformShell moduleLabel="Operations" title="Hierarchy management" subtitle="Manage Admin → Manager → User reporting lines across the firm.">
      <div className="space-y-4">
        <Card>
          <div className="space-y-2 p-2">
            <h1 className="text-xl font-semibold text-slate-900">Hierarchy Management</h1>
            <p className="text-sm text-slate-600">Primary Admin can view and manage Admin → Manager → User reporting lines.</p>
            {!isPrimaryAdmin && (
              <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">Only Primary Admin can manage hierarchy</p>
            )}
          </div>
        </Card>

        {loading ? (
          <Loading message="Loading hierarchy" />
        ) : (
          <Card>
            <div className="space-y-4 p-2">
              <div>
                <h2 className="text-sm font-semibold uppercase text-slate-500">Primary Admin</h2>
                <p className="text-base text-slate-900">{labelForUser(tree.primaryAdmin)}</p>
              </div>

              {tree.admins.map((admin) => (
                <div key={admin.id} className="rounded border border-slate-200 p-3">
                  <h3 className="font-semibold text-slate-900">Admin: {labelForUser(admin)}</h3>

                  {(admin.managers || []).map((manager) => (
                    <div key={manager.id} className="mt-3 rounded border border-slate-100 p-3">
                      <h4 className="text-sm font-semibold text-slate-700">Manager: {labelForUser(manager)}</h4>
                      {(manager.users || []).length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {manager.users.map((user) => renderUserRow(user, admin.id, manager.id))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">No users assigned.</p>
                      )}
                    </div>
                  ))}

                  <div className="mt-3 rounded border border-slate-100 p-3">
                    <h4 className="text-sm font-semibold text-slate-700">Users (no manager)</h4>
                    {(admin.users || []).length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {admin.users.map((user) => renderUserRow(user, admin.id, ''))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No direct users under this admin.</p>
                    )}
                  </div>
                </div>
              ))}

              <div className="rounded border border-slate-200 p-3">
                <h3 className="font-semibold text-slate-900">Unassigned Users</h3>
                {tree.unassignedUsers.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {tree.unassignedUsers.map((user) => renderUserRow(user, '', ''))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No unassigned users.</p>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </PlatformShell>
  );
};

export default HierarchyPage;
