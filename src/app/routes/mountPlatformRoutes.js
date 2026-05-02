const mountPlatformRoutes = (app, deps) => {
  const {
    isProduction,
    writeGuardChain,
    authRoutes,
    publicRoutes,
    publicSignupRoutes,
    contactRoutes,
    categoryRoutes,
    workTypeRoutes,
    adminRoutes,
    dashboardRoutes,
    slaRoutes,
    superadminRoutes,
    firmRoutes,
    securityRoutes,
    tenantScopedApiAccess,
    adminTenantScopedApiAccess,
    loginLimiter,
    publicLimiter,
    contactLimiter,
    superadminLimiter,
    authenticate,
    noFirmNoTransaction,
    tenantResolver,
    login,
    firmSlugGuard,
    adminAuditTrail,
    log,
    RESERVED_FIRM_SLUGS,
    requireTenant,
    invariantGuard,
    requireAdmin,
    firmContext,
  } = deps;

  app.get('/api', (req, res) => {
    const endpoints = { health: '/health', apiHealth: '/api/health', users: '/api/users', tasks: '/api/tasks', cases: '/api/cases', search: '/api/search', worklists: '/api/worklists', auth: '/api/auth', authPublic: '/auth', clientApproval: '/api/client-approval', clients: '/api/clients', reports: '/api/reports', insights: '/api/insights', categories: '/api/categories', admin: '/api/admin', dashboard: '/api/dashboard', superadmin: '/api/superadmin', superadminLegacy: '/superadmin' };
    if (!isProduction) endpoints.debug = '/api/debug';
    res.json({ success: true, message: 'Welcome to Docketra API', version: '1.0.0', endpoints });
  });

  app.all('/auth/login', (_req, res) => res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND', message: 'Route not found' }));
  app.get('/f/:firmSlug/login', (req, res) => res.redirect(301, `/${req.params.firmSlug}/login`));

  ['/api/auth', '/auth'].forEach((basePath) => app.use(basePath, writeGuardChain, authRoutes));

  const superadminLoginChain = [loginLimiter, noFirmNoTransaction, (req, _res, next) => { req.loginScope = 'superadmin'; next(); }, login];
  app.post('/api/superadmin/login', ...superadminLoginChain);
  app.post('/superadmin/login', ...superadminLoginChain);

  const firmLoginHandler = (req, res) => {
    res.json({ success: true, data: { firmId: req.firmIdString, firmSlug: req.firmSlug, name: req.firmName, status: req.firm.status } });
  };
  app.get('/api/:firmSlug/login', publicLimiter, firmSlugGuard, tenantResolver, firmLoginHandler);
  app.get('/:firmSlug/login', publicLimiter, tenantResolver, firmLoginHandler);
  app.post('/:firmSlug/login', loginLimiter, tenantResolver, noFirmNoTransaction, (req, res, next) => { req.loginScope = 'tenant'; next(); }, login);

  app.use('/api/public', publicLimiter, writeGuardChain, publicRoutes);
  app.use('/public', publicLimiter, writeGuardChain, publicRoutes);
  app.use('/api/public', publicLimiter, publicSignupRoutes);
  app.use('/public', publicLimiter, publicSignupRoutes);
  app.use('/api/contact', contactLimiter, contactRoutes);
  app.post('/api/cms/submit', contactLimiter, (_req, res) => res.status(410).json({ success: false, code: 'ROUTE_DEPRECATED', message: 'Legacy endpoint removed. Use POST /api/public/cms/:firmSlug/intake.' }));

  app.use('/api/categories', writeGuardChain, categoryRoutes);
  app.use('/api/work-types', ...tenantScopedApiAccess, writeGuardChain, workTypeRoutes);
  app.use('/api/admin', ...adminTenantScopedApiAccess, writeGuardChain, adminAuditTrail('admin'), adminRoutes);
  app.use('/api/dashboard', ...tenantScopedApiAccess, writeGuardChain, dashboardRoutes);
  app.use('/api/sla', ...tenantScopedApiAccess, writeGuardChain, slaRoutes);

  ['/api/sa', '/api/superadmin', '/superadmin'].forEach((basePath) => app.use(basePath, superadminLimiter, authenticate, writeGuardChain, adminAuditTrail('superadmin'), superadminRoutes));

  if (!isProduction) {
    log.info('AUTH_ROUTE_MOUNTS', { authProfile: ['GET /api/auth/profile', 'GET /auth/profile'], authLogout: ['POST /api/auth/logout', 'POST /auth/logout'], superadminLogin: ['POST /api/superadmin/login', 'POST /superadmin/login'], superadminProtectedBasePaths: ['/api/sa', '/api/superadmin', '/superadmin'], reservedFirmNamespaces: RESERVED_FIRM_SLUGS });
  }

  app.use('/api/security', authenticate, securityRoutes);
};

module.exports = { mountPlatformRoutes };
