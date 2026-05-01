const DISABLED_PROVIDER_VALUES = new Set(['', 'disabled', 'none', 'null']);

export const isProviderDisabled = (value) => DISABLED_PROVIDER_VALUES.has(String(value || '').trim().toLowerCase());

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
    allowedRoles: Array.isArray(formState?.allowedRoles) ? formState.allowedRoles : [],
    retention: { ...(formState?.retention || {}) },
  };

  const encryptedKey = String(formState?.encryptedKey || '').trim();
  if (encryptedKey) payload.encryptedKey = encryptedKey;

  const credentialRef = String(formState?.credentialRef || '').trim();
  if (credentialRef) payload.credentialRef = credentialRef;

  return payload;
}
