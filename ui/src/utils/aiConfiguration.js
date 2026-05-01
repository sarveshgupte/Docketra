const DISABLED_PROVIDER_VALUES = new Set(['', 'disabled', 'none', 'null']);
const ROLE_KEYS = ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER', 'USER'];

export const isProviderDisabled = (value) => DISABLED_PROVIDER_VALUES.has(String(value || '').trim().toLowerCase());

const normalizeRoleAccess = (selectedRoles = []) => ROLE_KEYS.reduce((acc, role) => ({
  ...acc,
  [role]: selectedRoles.includes(role),
}), {});

export function buildAiConfigurationPayload(formState) {
  const provider = String(formState?.provider || '').trim();
  const providerIsDisabled = isProviderDisabled(provider);
  const credentialMode = String(formState?.credentialMode || 'none').trim() || 'none';

  const payload = {
    enabled: providerIsDisabled ? false : Boolean(formState?.enabled),
    provider: providerIsDisabled ? null : provider,
    model: String(formState?.model || '').trim() || null,
    credentialMode: providerIsDisabled ? 'none' : credentialMode,
    features: { ...(formState?.features || {}) },
    roleAccess: normalizeRoleAccess(formState?.allowedRoles || []),
    retention: {
      zeroRetention: Boolean(formState?.retention?.zeroRetention),
      savePrompts: Boolean(formState?.retention?.savePrompts),
      saveOutputs: Boolean(formState?.retention?.saveOutputs),
    },
    privacy: {
      redactErrors: Boolean(formState?.privacy?.redactErrors),
      verboseLogging: Boolean(formState?.privacy?.verboseLogging),
    },
  };

  const encryptedKey = String(formState?.encryptedKey || '').trim();
  if (encryptedKey) payload.encryptedKey = encryptedKey;

  const credentialRef = String(formState?.credentialRef || '').trim();
  if (credentialRef) payload.credentialRef = credentialRef;

  return payload;
}
