const RESERVED_FIRM_SLUGS = [
  'auth',
  'public',
  'superadmin',
  'users',
  'admin',
  'dashboard',
  'dockets',
  'clients',
  'settings',
  'reports',
  'security',
  'tenant',
  'files',
  'storage',
  'ai',
  'notifications',
  'teams',
  'bulk-upload',
  'product-updates',
  'cases',
  'tasks',
  'search',
  'worklists',
  'attachments',
  'firm',
];

const FIRM_SLUG_PATTERN = /^[a-z0-9-]+$/;
const RESERVED_FIRM_SLUG_SET = new Set(RESERVED_FIRM_SLUGS);

const firmSlugGuard = (req, _res, next) => {
  const firmSlug = String(req.params?.firmSlug || '').trim().toLowerCase();
  if (!FIRM_SLUG_PATTERN.test(firmSlug)) {
    return next('router');
  }

  if (RESERVED_FIRM_SLUG_SET.has(firmSlug)) {
    return next('router');
  }

  req.params.firmSlug = firmSlug;
  return next();
};

module.exports = {
  RESERVED_FIRM_SLUGS,
  FIRM_SLUG_PATTERN,
  firmSlugGuard,
};
