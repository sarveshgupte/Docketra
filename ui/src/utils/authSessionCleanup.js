import { SESSION_KEYS, STORAGE_KEYS } from './constants.js';

export const clearPendingLoginSessionState = (session = sessionStorage) => {
  session.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);
  session.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);
  session.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);
};

export const clearSuperadminRoutingHints = (storage = localStorage) => {
  storage.removeItem(STORAGE_KEYS.FIRM_SLUG);
  storage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);
};
