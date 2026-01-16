import { STORAGE_KEYS } from '../utils/constants';

let bootstrapPromise = null;

const shouldDisableRefresh = () => {
  const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
  if (!storedUser) return false;
  try {
    const parsedUser = JSON.parse(storedUser);
    return parsedUser?.refreshEnabled === false
      || parsedUser?.isSuperAdmin === true
      || parsedUser?.role === 'SUPERADMIN'
      || parsedUser?.role === 'SuperAdmin';
  } catch (error) {
    return false;
  }
};

export function bootstrapAuth(fetchProfile) {
  if (!bootstrapPromise) {
    if (shouldDisableRefresh()) {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
    bootstrapPromise = fetchProfile();
  }
  return bootstrapPromise;
}
