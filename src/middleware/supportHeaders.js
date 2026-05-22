const SUPPORT_IMPERSONATION_HEADERS = Object.freeze({
  firmId: 'x-impersonated-firm-id',
  sessionId: 'x-impersonation-session-id',
  mode: 'x-impersonation-mode',
});

const ALLOWED_IMPERSONATION_MODES = Object.freeze(['READ_ONLY', 'FULL_ACCESS']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

  if (!impersonatedFirmId || !impersonationSessionId) {
    req.context = {
      ...(req.context || {}),
      impersonationDenied: true,
      impersonationDeniedReason: 'missing_required_headers',
    };
    return;
  }

  const normalizedMode = String(impersonationMode || 'READ_ONLY').toUpperCase();
  if (!ALLOWED_IMPERSONATION_MODES.includes(normalizedMode)) {
    req.context = {
      ...(req.context || {}),
      impersonationDenied: true,
      impersonationDeniedReason: 'invalid_impersonation_mode',
      requestedImpersonationMode: impersonationMode || null,
    };
    return;
  }

  if (normalizedMode === 'READ_ONLY' && MUTATING_METHODS.has(String(req.method || '').toUpperCase())) {
    req.context = {
      ...(req.context || {}),
      impersonationDenied: true,
      impersonationDeniedReason: 'read_only_mutation_blocked',
      impersonationMode: normalizedMode,
    };
    return;
  }

  req.context = {
    ...(req.context || {}),
    impersonatedFirmId: impersonatedFirmId || req.context?.impersonatedFirmId || null,
    impersonationSessionId: impersonationSessionId || req.context?.impersonationSessionId || null,
    impersonationMode: normalizedMode,
    impersonationDenied: false,
    impersonationDeniedReason: null,
  };
};

module.exports = {
  SUPPORT_IMPERSONATION_HEADERS,
  applySupportHeadersToContext,
};
