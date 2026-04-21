export const EMPTY_ADMIN_STATS = {
  totalUsers: 0,
  totalClients: 0,
  totalCategories: 0,
  pendingApprovals: 0,
};

export const TOAST_DEDUPLICATION_WINDOW_MS = 1500;
export const EMPTY_FIELD_PLACEHOLDER = '—';

export const looksEncryptedToken = (value) => (
  typeof value === 'string' && value.includes(':')
);

export const toSafeText = (value, fallback = '') => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
};

export const normalizeSubcategory = (subcategory) => {
  if (!subcategory || typeof subcategory !== 'object') return null;
  return {
    ...subcategory,
    id: subcategory.id || subcategory._id || null,
    name: typeof subcategory.name === 'string' ? subcategory.name : '',
    isActive: Boolean(subcategory.isActive),
  };
};

export const normalizeCategory = (category) => {
  if (!category || typeof category !== 'object') return null;
  const rawSubcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
  return {
    ...category,
    _id: category._id || category.id || null,
    name: typeof category.name === 'string' ? category.name : '',
    isActive: Boolean(category.isActive),
    subcategories: rawSubcategories.map(normalizeSubcategory).filter(Boolean),
  };
};

export const parseDelimitedLine = (line = '') => {
  if (line.includes('\t')) {
    return line.split('\t').map((value) => value.trim());
  }
  return line.split(',').map((value) => value.trim());
};

export const getApiErrorType = (error) => {
  if (!error?.response) return 'network';
  const status = error.response.status;
  if (status === 404) return 'empty';
  if (status === 401 || status === 403) return 'permission';
  if (status >= 500) return 'server';
  return 'unknown';
};

export const getUserStatusBadge = (user) => {
  const status = String(user?.status || '').toLowerCase();
  if (status === 'invited') return { tone: 'Pending', label: 'Invited' };
  if (status === 'active' || user?.isActive) return { tone: 'Approved', label: 'Active' };
  if (status === 'disabled') return { tone: 'Rejected', label: 'Cancelled' };
  return { tone: 'Rejected', label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Inactive' };
};

export const getNormalizedUserStatus = (user) => String(user?.status || '').toLowerCase();

export const isPrimaryAdminUser = (user) => {
  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isFirmDefaultAdmin = ['ADMIN', 'PRIMARY_ADMIN'].includes(normalizedRole)
    && user?.defaultClientId
    && user?.firmId
    && String(user.defaultClientId) === String(user.firmId);

  return Boolean(
    user?.isPrimaryAdmin
    || user?.isSystem
    || normalizedRole === 'PRIMARY_ADMIN'
    || isFirmDefaultAdmin
  );
};

export const getRoleBadgePresentation = (user) => {
  const normalizedRole = String(user?.role || '').trim().toUpperCase();
  const isPrimaryOrSystemAdmin = user?.isPrimaryAdmin || user?.isSystem;

  if (normalizedRole === 'SUPERADMIN') {
    return { tone: 'InProgress', label: 'SuperAdmin' };
  }

  if (isPrimaryOrSystemAdmin || normalizedRole === 'PRIMARY_ADMIN' || normalizedRole === 'ADMIN') {
    return { tone: 'InProgress', label: (isPrimaryOrSystemAdmin || normalizedRole === 'PRIMARY_ADMIN') ? 'Primary Admin' : 'Admin' };
  }

  if (normalizedRole === 'MANAGER') {
    return { tone: 'Pending', label: 'Manager' };
  }

  if (normalizedRole === 'PARTNER') {
    return { tone: 'Pending', label: 'Partner' };
  }

  if (['STAFF', 'EMPLOYEE', 'USER'].includes(normalizedRole)) {
    return { tone: 'Pending', label: 'Employee' };
  }

  return { tone: 'Pending', label: normalizedRole ? normalizedRole.charAt(0) + normalizedRole.slice(1).toLowerCase() : 'Employee' };
};
