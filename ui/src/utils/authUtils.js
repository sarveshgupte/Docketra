import { STORAGE_KEYS } from './constants';

export const getStoredUser = () => {
  const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser);
  } catch (error) {
    return null;
  }
};

export const isAccessTokenOnlyUser = (user) => {
  if (!user) return false;
  return user.refreshEnabled === false
    || user.isSuperAdmin === true
    || user.role === 'SUPERADMIN'
    || user.role === 'SuperAdmin';
};

export const isAccessTokenOnlySession = () => isAccessTokenOnlyUser(getStoredUser());
