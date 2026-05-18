const mountTenantRoutes = (app, deps) => {
  const {
    writeGuardChain,
    authenticate,
    firmContext,
    requireTenant,
    tenantThrottle,
    invariantGuard,
    authLimiter,
    tenantScopedApiAccess,
    adminTenantScopedApiAccess,
    adminAuditTrail,
    userRoutes,
    selfUserRoutes,
    taskRoutes,
    complianceCalendarRoutes,
    caseRoutes,
    docketRoutes,
    docketSessionRoutes,
    attachmentRoutes,
    searchRoutes,
    worklistRoutes,
    clientApprovalRoutes,
    clientRoutes,
    crmClientRoutes,
    leadRoutes,
    formRoutes,
    landingPageRoutes,
    dealRoutes,
    invoiceRoutes,
    reportsRoutes,
    insightsRoutes,
    firmMetricsRoutes,
    storageRoutes,
    aiRoutes,
    firmStorageRoutes,
    filesRoutes,
    tenantRoutes,
    docketFileStorageRoutes,
    notificationsRoutes,
    teamRoutes,
    bulkUploadRoutes,
    productUpdateRoutes,
    settingsRoutes,
    knowledgeItemRoutes,
  } = deps;

  app.use('/api/users', ...tenantScopedApiAccess, writeGuardChain, userRoutes);
  app.use('/api/user', authenticate, selfUserRoutes);
  app.use('/api/tasks', ...tenantScopedApiAccess, writeGuardChain, taskRoutes);
  app.use('/api/compliance-calendar', ...tenantScopedApiAccess, writeGuardChain, complianceCalendarRoutes);
  app.use('/api/cases', ...tenantScopedApiAccess, writeGuardChain, caseRoutes);
  app.use('/api/dockets', ...tenantScopedApiAccess, writeGuardChain, docketRoutes);
  app.use('/api', ...tenantScopedApiAccess, writeGuardChain, docketSessionRoutes);
  app.use('/api/attachments', ...tenantScopedApiAccess, writeGuardChain, attachmentRoutes);
  app.use('/api/search', ...tenantScopedApiAccess, writeGuardChain, searchRoutes);
  app.use('/api/worklists', ...tenantScopedApiAccess, writeGuardChain, worklistRoutes);
  app.use('/api/client-approval', ...tenantScopedApiAccess, writeGuardChain, clientApprovalRoutes);
  app.use('/api/crm/clients', ...tenantScopedApiAccess, writeGuardChain, crmClientRoutes);
  app.use('/api/landing-pages', ...tenantScopedApiAccess, writeGuardChain, landingPageRoutes);
  app.use('/api/deals', ...tenantScopedApiAccess, writeGuardChain, dealRoutes);
  app.use('/api/invoices', ...tenantScopedApiAccess, writeGuardChain, invoiceRoutes);
  app.use('/api/reports', ...tenantScopedApiAccess, writeGuardChain, reportsRoutes);
  app.use('/api/insights', ...tenantScopedApiAccess, writeGuardChain, insightsRoutes);
  app.use('/api/firm/:firmId', ...tenantScopedApiAccess, writeGuardChain, firmMetricsRoutes);
  app.use('/api/storage', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), storageRoutes);
  app.use('/api/ai', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), aiRoutes);
  app.use('/api/firm', ...tenantScopedApiAccess, writeGuardChain, firmStorageRoutes);
  app.use('/api/files', authLimiter, ...tenantScopedApiAccess, writeGuardChain, filesRoutes);
  app.use('/api/tenant', authLimiter, ...tenantScopedApiAccess, writeGuardChain, tenantRoutes);
  app.use('/api/docket-storage', authLimiter, ...tenantScopedApiAccess, writeGuardChain, docketFileStorageRoutes);
  app.use('/api/notifications', ...tenantScopedApiAccess, writeGuardChain, notificationsRoutes);
  app.use('/api/teams', ...tenantScopedApiAccess, writeGuardChain, teamRoutes);
  app.use('/api/bulk-upload', ...adminTenantScopedApiAccess, writeGuardChain, adminAuditTrail('admin'), bulkUploadRoutes);
  app.use('/api/product-updates', authenticate, writeGuardChain, productUpdateRoutes);
  app.use('/api/settings', ...tenantScopedApiAccess, writeGuardChain, settingsRoutes);
  app.use('/api/knowledge-items', ...tenantScopedApiAccess, writeGuardChain, knowledgeItemRoutes);
  app.use('/api', authLimiter, ...tenantScopedApiAccess, writeGuardChain, docketFileStorageRoutes);
};

module.exports = { mountTenantRoutes };
