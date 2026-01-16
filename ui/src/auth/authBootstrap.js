import { STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlySession } from '../utils/authUtils';

let bootstrapPromise = null;

export function bootstrapAuth(fetchProfile) {
  if (!bootstrapPromise) {
    if (isAccessTokenOnlySession()) {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
    bootstrapPromise = fetchProfile();
  }
  return bootstrapPromise;
}
