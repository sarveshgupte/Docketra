/**
 * Derive a URL-safe workspace slug preview from a firm name.
 */
export const getWorkspaceSlugPreview = (firmName) => {
  const slug = String(firmName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'your-firm';
};
