import { STORAGE_KEYS } from './constants';

/**
 * @deprecated User data is no longer stored in localStorage
 * Always returns null. Use AuthContext to get user data from API.
 */
export const getStoredUser = () => {
  return null;
};

export const isAccessTokenOnlyUser = (user) => {
  if (!user) return false;
  if (user.isSuperAdmin === true) {
    return true;
  }
  if (user.refreshEnabled !== undefined) {
    return user.refreshEnabled === false;
  }
  return false;
};

/**
 * Check if the current session is access-token-only by checking for refresh token
 */
export const isAccessTokenOnlySession = () => {
  return !localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
};
