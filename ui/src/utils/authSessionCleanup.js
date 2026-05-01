const SESSION_KEYS = {
  PENDING_LOGIN_TOKEN: 'PENDING_LOGIN_TOKEN',
  PENDING_LOGIN_FIRM: 'PENDING_LOGIN_FIRM',
  POST_LOGIN_RETURN_TO: 'POST_LOGIN_RETURN_TO',
};

const STORAGE_KEYS = {
  FIRM_SLUG: 'firmSlug',
  IMPERSONATED_FIRM: 'impersonatedFirm',
};

export const clearPendingLoginSessionState = (session = sessionStorage) => {
  session.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);
  session.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);
  session.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);
};

export const clearSuperadminRoutingHints = (storage = localStorage) => {
  storage.removeItem(STORAGE_KEYS.FIRM_SLUG);
  storage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);
};
