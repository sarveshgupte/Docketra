/**
 * Generate a URL-safe firm slug from a firm name.
 * Rules:
 * 1) lowercase
 * 2) replace spaces with '-'
 * 3) remove special characters
 * 4) trim
 *
 * @param {string} name
 * @returns {string}
 */
function generateFirmSlug(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  generateFirmSlug,
};

