const SUPPORT_IMPERSONATION_HEADERS = Object.freeze({
  firmId: 'x-impersonated-firm-id',
  sessionId: 'x-impersonation-session-id',
  mode: 'x-impersonation-mode',
});

const applySupportHeadersToContext = (req) => {
  const headers = req.headers || {};
  const isSuperadminContext = Boolean(req.isSuperAdmin || req.context?.isSuperAdmin);

  if (!isSuperadminContext) {
    return;
  }

  const impersonatedFirmId = headers[SUPPORT_IMPERSONATION_HEADERS.firmId];
  const impersonationSessionId = headers[SUPPORT_IMPERSONATION_HEADERS.sessionId];
  const impersonationMode = headers[SUPPORT_IMPERSONATION_HEADERS.mode];

  if (!impersonatedFirmId && !impersonationSessionId && !impersonationMode) return;

  req.context = {
    ...(req.context || {}),
    impersonationDenied: true,
    impersonationDeniedReason: 'impersonation_disabled_no_session_store',
    requestedImpersonatedFirmId: impersonatedFirmId || null,
    requestedImpersonationSessionId: impersonationSessionId || null,
    requestedImpersonationMode: impersonationMode || null,
  };
};

module.exports = {
  SUPPORT_IMPERSONATION_HEADERS,
  applySupportHeadersToContext,
};
