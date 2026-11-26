export const WORKBASKET_NAME_MAX_LENGTH = 80;
export const RESERVED_QC_SUFFIX_REGEX = /\s*[-—–]\s*qc$/i;

export const normalizeWorkbasketName = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export const validateWorkbasketDraft = (rawName, existingWorkbaskets = [], excludeId = null) => {
  const normalized = normalizeWorkbasketName(rawName);
  if (!normalized) {
    return { valid: false, normalized: '', error: 'Workbasket name is required and must be valid.' };
  }
  if (normalized.length > WORKBASKET_NAME_MAX_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `Workbasket name must be ${WORKBASKET_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (RESERVED_QC_SUFFIX_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Workbasket name cannot end with "- QC"; linked QC workbaskets are created automatically.',
    };
  }
  const candidateLower = normalized.toLowerCase();
  const conflict = (existingWorkbaskets || []).some((entry) => {
    if (excludeId && String(entry?._id) === String(excludeId)) return false;
    return normalizeWorkbasketName(entry?.name).toLowerCase() === candidateLower;
  });
  if (conflict) {
    return {
      valid: false,
      normalized,
      error: `Workbasket "${normalized}" already exists for this firm.`,
    };
  }
  return { valid: true, normalized, error: '' };
};

export const resolveWorkSettingsError = (
  error,
  statusMessagesMap = {},
  fallbackMessage = 'Operation failed. Please retry.',
) => {
  const serverMessage = error?.data?.message || error?.message;
  if (error?.status && statusMessagesMap[error.status]) {
    return serverMessage || statusMessagesMap[error.status];
  }
  return serverMessage || fallbackMessage;
};
