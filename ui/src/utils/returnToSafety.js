export const isSafeReturnToPath = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(trimmed)) return false;
  return trimmed === '/app' || trimmed.startsWith('/app/');
};

export const isRoleCompatibleRoute = (candidatePath, { isSuperAdminUser, firmSlug }) => {
  if (!isSafeReturnToPath(candidatePath)) return false;
  if (isSuperAdminUser) return candidatePath.startsWith('/app/superadmin');
  const normalizedFirmSlug = String(firmSlug || '').trim();
  if (!normalizedFirmSlug) return false;
  return candidatePath.startsWith(`/app/firm/${normalizedFirmSlug}`);
};
