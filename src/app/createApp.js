const log = require('../utils/log');
// Load environment variables FIRST (before any other imports)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const { validateEnv } = require('../config/validateEnv');
const { loadEnv, maskEnvForLog } = require('../config/env');
const { logBuildMetadata } = require('../services/buildInfo.service');
const authSessionServiceFactory = require('../services/authSession.service');
const { maskSensitiveObject } = require('../utils/pii');
require('../utils/transactionSessionEnforcer');

const env = loadEnv();
log.info('API_RUNTIME_WORKERS_DISABLED');

// Middleware
const requestLogger = require('../middleware/requestLogger');
const requestId = require('../middleware/requestId.middleware');
const requestTiming = require('../middleware/requestTiming.middleware');
const { attachRequestContext } = require('../middleware/attachRequestContext');
const errorHandler = require('../middleware/errorHandler');
const notFound = require('../middleware/notFound');
const { authenticate } = require('../middleware/auth.middleware');
const degradedGuard = require('../middleware/degradedGuard');
const { firmContext } = require('../middleware/firmContext.middleware');
const requireTenant = require('../middleware/requireTenant');
const { requireAdmin } = require('../middleware/permission.middleware');
const responseContract = require('../middleware/responseContract.middleware');
const invariantGuard = require('../middleware/invariantGuard');
const domainInvariantGuard = require('../middleware/domainInvariantGuard');
const { idempotencyMiddleware } = require('../middleware/idempotency.middleware');
const metricsService = require('../services/metrics.service');
const { adminAuditTrail } = require('../middleware/adminAudit.middleware');
const requestLifecycle = require('../middleware/requestLifecycle.middleware');
const { enforceTemporaryIpBlock } = require('../middleware/securityIpBlock.middleware');
const { noFirmNoTransaction } = require('../middleware/noFirmNoTransaction.middleware');
const optionsPreflight = require('../middleware/optionsPreflight.middleware');
const {
  authLimiter,
  loginLimiter,
  publicLimiter,
  globalApiLimiter,
  internalMetricsLimiter,
  contactLimiter,
  superadminLimiter,
} = require('../middleware/rateLimiters');
const { tenantThrottle } = require('../middleware/tenantThrottle.middleware');
const cookieParser = require('../middleware/cookieParser.middleware');
const { enforceSameOriginForMutatingRequests } = require('../middleware/csrfOrigin.middleware');
const { uploadErrorHandler, ensureUploadRoot } = require('../middleware/uploadProtection.middleware');
const { allowInternalTokenOrSuperadmin } = require('../middleware/internalMetricsAccess.middleware');
const { tenantScopedApiAccess, adminTenantScopedApiAccess } = require('../routes/routeGroups');

// Routes
const userRoutes = require('../routes/user.routes');
const selfUserRoutes = require('../routes/selfUser.routes');
const taskRoutes = require('../routes/task.routes');
const complianceCalendarRoutes = require('../routes/complianceCalendar.routes');
const caseRoutes = require('../routes/docket.routes'); // backward-compat alias for /api/cases
const searchRoutes = require('../routes/search.routes');  // Search and worklist routes
const authRoutes = require('../routes/auth.routes');  // Authentication routes
const clientApprovalRoutes = require('../routes/clientApproval.routes');  // Client approval routes
const clientRoutes = require('../routes/client.routes');  // Client management routes (PR #39)
const leadRoutes = require('../routes/lead.routes');
const formRoutes = require('../routes/form.routes');
const landingPageRoutes = require('../routes/landingPage.routes');
const crmClientRoutes = require('../routes/crmClient.routes');
const dealRoutes = require('../routes/deal.routes');
const invoiceRoutes = require('../routes/invoice.routes');
const reportsRoutes = require('../routes/reports.routes');  // Reports routes
const insightsRoutes = require('../routes/insights.routes');
const categoryRoutes = require('../routes/category.routes');  // Category routes
const workTypeRoutes = require('../routes/workType.routes');
const dashboardRoutes = require('../routes/dashboard.routes');
const slaRoutes = require('../routes/sla.routes');
const firmMetricsRoutes = require('../routes/firmMetrics.routes');
const adminRoutes = require('../routes/admin.routes');  // Admin routes (PR #41)
const settingsRoutes = require('../routes/settings.routes');
const superadminRoutes = require('../routes/superadmin.routes');  // Superadmin routes
const contactRoutes = require('../routes/contact.routes');  // Public contact form route
const publicRoutes = require('../routes/public.routes');  // Public routes (firm lookup)
const publicSignupRoutes = require('../routes/publicSignup.routes');  // Public self-serve signup routes
const firmRoutes = require('../routes/firm.routes');
const firmStorageRoutes = require('../routes/firmStorage.routes');
const healthRoutes = require('../routes/health.routes');  // Health endpoints
const { apiHealth } = require('../controllers/health.controller');
const storageRoutes = require('../routes/storage.routes');  // Storage BYOS routes
const aiRoutes = require('../routes/ai.routes');
const filesRoutes = require('../routes/files.routes');  // Tenant BYOS signed URL routes
const securityRoutes = require('../routes/security.routes');
const { getSecurityMetrics } = require('../controllers/security.controller');
const tenantRoutes = require('../routes/tenant.routes');  // Tenant storage settings routes
const docketFileStorageRoutes = require('../routes/docketFileStorage.routes');
const notificationsRoutes = require('../routes/notifications.routes');
const teamRoutes = require('../routes/team.routes');
const bulkUploadRoutes = require('../routes/bulkUpload.routes');
const productUpdateRoutes = require('../routes/productUpdate.routes');
const docketRoutes = require('../routes/docket.routes');
const attachmentRoutes = require('../routes/attachment.routes');
const docketSessionRoutes = require('../routes/docketSession.routes');
const tenantResolver = require('../middleware/tenantResolver');
const { login } = require('../controllers/auth.controller');
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const forceTransactionPaths = ['/google/callback', '/my-pending'];
const writeGuardChain = (req, res, next) => {
  const shouldForceTransaction = forceTransactionPaths.some((path) => req.path && req.path.startsWith(path));
  if (!mutatingMethods.has(req.method) && !shouldForceTransaction) {
    return next();
  }
  if (shouldForceTransaction) {
    req.forceTransaction = true;
  }
  return idempotencyMiddleware(req, res, (idempotencyErr) => {
    if (idempotencyErr) return next(idempotencyErr);
    return domainInvariantGuard(req, res, next);
  });
};

/**
 * Docketra - Task & Case Management System
 * Backend API Server
 */

// Log NODE_ENV for debugging
log.info('SERVER_ENV', { nodeEnv: env.NODE_ENV });

// Detect production mode
const isProduction = env.NODE_ENV === 'production';

validateEnv();
logBuildMetadata();
ensureUploadRoot();

// STARTUP CHECK: Verify every route file has a corresponding schema file.
// This catches schema coverage gaps at startup before any request is served.
(function verifyRouteSchemaCoverage() {
  const fs = require('fs');
  const path = require('path');
    const routesDir = path.join(__dirname, '..', 'routes');
    const schemasDir = path.join(__dirname, '..', 'schemas');

  const routeFiles = fs.readdirSync(routesDir)
    .filter((f) => f.endsWith('.routes.js') && f !== 'routeGroups.js'); // routeGroups.js exports middleware arrays, not an Express router

  const missingSchemas = routeFiles.filter((routeFile) => {
    const base = routeFile.replace('.routes.js', '');
    const schemaFile = `${base}.routes.schema.js`;
    return !fs.existsSync(path.join(schemasDir, schemaFile));
  });

  if (missingSchemas.length > 0) {
    const list = missingSchemas.map((f) => `  - ${f}`).join('\n');
    throw new Error(
      `[Startup] Missing validation schema files for the following route files:\n${list}\n` +
      'Create a corresponding schema file in src/schemas/ for each route file.',
    );
  }

  log.info('ROUTE_SCHEMA_COVERAGE_OK', { routeFiles: routeFiles.length });
}());

log.info('ENV_CONFIG_LOADED', {
  env: env.NODE_ENV,
  superadminXID: env.SUPERADMIN_XID_NORMALIZED,
  snapshot: maskEnvForLog({
    NODE_ENV: env.NODE_ENV,
    MONGODB_URI: env.MONGODB_URI,
    SUPERADMIN_EMAIL: env.SUPERADMIN_EMAIL_NORMALIZED,
    ENCRYPTION_PROVIDER: env.ENCRYPTION_PROVIDER,
  }),
});

const createApp = () => {
    // Initialize Express app
    const app = express();
    app.set('trust proxy', 1);
    app.disable('etag');

  const configuredOrigins = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (isProduction && configuredOrigins.some((origin) => origin === '*')) {
    throw new Error('SECURITY: Wildcard CORS is forbidden in production');
  }
  const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : (!isProduction ? ['http://localhost:5173'] : []);
  const cspReportingEnabled = env.CSP_REPORTING_ENABLED === true;
  log.info('CORS_ALLOWED_ORIGINS', { allowedOrigins });
  const cookieConfig = authSessionServiceFactory.getAuthCookieRuntimeDiagnostics();
  log.info('AUTH_COOKIE_CONFIG_RESOLVED', cookieConfig);

  const apiPublicOriginRaw = String(process.env.API_PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL || '').trim();
  const apiPublicOrigin = apiPublicOriginRaw ? apiPublicOriginRaw.replace(/\/+$/, '') : null;
  if (isProduction && apiPublicOrigin && allowedOrigins.length > 0) {
    const hasCrossOriginFrontend = allowedOrigins.some((origin) => {
      try {
        return new URL(origin).origin !== new URL(apiPublicOrigin).origin;
      } catch (_) {
        return false;
      }
    });
    if (hasCrossOriginFrontend && !cookieConfig.crossSiteEnabled && cookieConfig.sameSite === 'lax') {
      log.warn('AUTH_COOKIE_CROSS_ORIGIN_MISCONFIG', {
        apiPublicOrigin,
        allowedOrigins,
        crossSiteEnabled: cookieConfig.crossSiteEnabled,
        sameSite: cookieConfig.sameSite,
      });
    }
  }

  // SECURITY: Defense-in-depth middleware
  // Security Headers - Helmet
  const toCspSource = (origin) => {
    try {
      const parsed = new URL(origin);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
      log.warn('CSP_ORIGIN_SKIPPED', { origin, error: error.message });
      return null;
    }
  };
  const cspConnectSrc = [
    "'self'",
    ...allowedOrigins.map(toCspSource).filter(Boolean),
    ...(!isProduction ? ['http://localhost:5173', 'ws://localhost:5173'] : []),
  ];

  const cspDirectives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: cspConnectSrc,
  };
  if (cspReportingEnabled) {
    cspDirectives.reportUri = ['/api/csp-violation'];
  }

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    dnsPrefetchControl: { allow: false },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: cspDirectives,
    },
  }));

  // SECURITY: Capture CSP reports without exposing internals to clients.
  if (cspReportingEnabled) {
    app.post('/api/csp-violation', express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'] }), (req, res) => {
      const report = maskSensitiveObject(req.body || {});
      log.warn('CSP_VIOLATION_REPORTED', { report });
      return res.status(204).end();
    });
  }

  const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'X-Correlation-ID'];
  const CORS_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

  // CORS Configuration
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: CORS_ALLOWED_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS
  };

  // Middleware
  // Handle CORS preflight requests before auth/transaction middleware
  app.use(optionsPreflight(allowedOrigins, CORS_ALLOWED_HEADERS, CORS_ALLOWED_METHODS));
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(enforceSameOriginForMutatingRequests);
  app.use(requestId);
  app.use(attachRequestContext);
  app.use(enforceTemporaryIpBlock);
  app.use(requestLifecycle);
  app.use(requestLogger);
  app.use(requestTiming);
  app.use(responseContract);
  app.use(degradedGuard);
  app.use('/api', globalApiLimiter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'docketra-api',
      timestamp: new Date().toISOString(),
    });
  });
  app.use('/health', healthRoutes);
  app.get('/api/health', apiHealth);
  app.get('/api/system/health', apiHealth);
  app.get('/metrics', async (req, res) => {
    // SECURITY: Metrics endpoint fail-closed enforcement
    const configuredMetricsToken = process.env.METRICS_TOKEN;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    let authorized = false;
    if (configuredMetricsToken && typeof token === 'string') {
      if (configuredMetricsToken.length === token.length) {
        let mismatch = 0;
        for (let i = 0; i < configuredMetricsToken.length; i++) {
          mismatch |= configuredMetricsToken.charCodeAt(i) ^ token.charCodeAt(i);
        }
        if (mismatch === 0) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if ((req.headers.accept || '').includes('application/json')) {
      return res.json(await metricsService.getSnapshot());
    }
    res.type('text/plain; version=0.0.4; charset=utf-8');
    return res.send(await metricsService.renderPrometheusMetrics());
  });
  app.get('/api/metrics/security', allowInternalTokenOrSuperadmin, internalMetricsLimiter, getSecurityMetrics);

  // API routes
  app.get('/api', (req, res) => {
    const endpoints = {
      health: '/health',
      apiHealth: '/api/health',
      users: '/api/users',
      tasks: '/api/tasks',
      cases: '/api/cases',
      search: '/api/search',
      worklists: '/api/worklists',
      auth: '/api/auth',
      authPublic: '/auth',
      clientApproval: '/api/client-approval',
      clients: '/api/clients',
      reports: '/api/reports',
      insights: '/api/insights',
      categories: '/api/categories',
      admin: '/api/admin',
      dashboard: '/api/dashboard',
      superadmin: '/api/superadmin',
      superadminLegacy: '/superadmin',
    };

    if (!isProduction) {
      endpoints.debug = '/api/debug';
    }

    res.json({
      success: true,
      message: 'Welcome to Docketra API',
      version: '1.0.0',
      endpoints,
    });
  });


  // Explicitly reject removed legacy auth login endpoint
  app.all('/auth/login', (_req, res) => {
    return res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND', message: 'Route not found' });
  });

  // Legacy tenant login redirect
  app.get('/f/:firmSlug/login', (req, res) => {
    return res.redirect(301, `/${req.params.firmSlug}/login`);
  });

  // Auth routes (excluding login endpoints)
  ['/api/auth', '/auth'].forEach((basePath) => {
    app.use(basePath, writeGuardChain, authRoutes);
  });

  // Isolated superadmin login (platform only)
  const superadminLoginChain = [loginLimiter, noFirmNoTransaction, (req, _res, next) => { req.loginScope = 'superadmin'; next(); }, login];
  app.post('/api/superadmin/login', ...superadminLoginChain);
  app.post('/superadmin/login', ...superadminLoginChain);

  // Tenant login must be slug-scoped only
  app.get('/:firmSlug/login', publicLimiter, tenantResolver, (req, res) => {
    res.json({ success: true, data: { firmId: req.firmIdString, firmSlug: req.firmSlug, name: req.firmName, status: req.firm.status } });
  });
  app.post('/:firmSlug/login', loginLimiter, tenantResolver, noFirmNoTransaction, (req, res, next) => { req.loginScope = 'tenant'; next(); }, login);

  // Public routes (no authentication required)
  app.use('/api/public', publicLimiter, writeGuardChain, publicRoutes);
  app.use('/public', publicLimiter, writeGuardChain, publicRoutes);

  // Public self-serve signup routes (no authentication required)
  app.use('/api/public', publicLimiter, publicSignupRoutes);
  app.use('/public', publicLimiter, publicSignupRoutes);

  // Contact form route (public, no authentication required)
  app.use('/api/contact', contactLimiter, contactRoutes);
  app.post('/api/cms/submit', contactLimiter, (_req, res) => {
    return res.status(410).json({
      success: false,
      code: 'ROUTE_DEPRECATED',
      message: 'Legacy endpoint removed. Use POST /api/public/cms/:firmSlug/intake.',
    });
  });

  // Category routes (user-facing reads; admin management is also available under /api/admin/categories)
  app.use('/api/categories', writeGuardChain, categoryRoutes);
  app.use('/api/work-types', ...tenantScopedApiAccess, writeGuardChain, workTypeRoutes);

  // Admin routes (firm-scoped) - enforce auth + firm context + admin role boundary
  app.use('/api/admin', ...adminTenantScopedApiAccess, writeGuardChain, adminAuditTrail('admin'), adminRoutes);
  app.use('/api/dashboard', ...tenantScopedApiAccess, writeGuardChain, dashboardRoutes);
  app.use('/api/sla', ...tenantScopedApiAccess, writeGuardChain, slaRoutes);

  // Superadmin routes - platform scope only (no firm context)
  // Include legacy /superadmin to prevent SPA fallback when UI calls API without /api prefix.
  ['/api/sa', '/api/superadmin', '/superadmin'].forEach((basePath) => {
    app.use(basePath, superadminLimiter, authenticate, writeGuardChain, adminAuditTrail('superadmin'), superadminRoutes);
  });
  app.use('/api/security', authenticate, securityRoutes);

  // SECURITY: Debug routes must never be reachable in production environments.
  if (!isProduction) {
    const debugRoutes = require('../routes/debug.routes');  // Debug routes (PR #43)
    app.use('/api/debug', authenticate, firmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, debugRoutes);
  }

  // Protected routes - require authentication
  // Firm context must be attached for all tenant-scoped operations
  app.use('/api/users', ...tenantScopedApiAccess, writeGuardChain, userRoutes);
  app.use('/api/user', authenticate, selfUserRoutes);
  app.use('/api/tasks', ...tenantScopedApiAccess, writeGuardChain, taskRoutes);
  app.use('/api/compliance-calendar', ...tenantScopedApiAccess, writeGuardChain, complianceCalendarRoutes);
  app.use('/api/cases', ...tenantScopedApiAccess, writeGuardChain, caseRoutes);  // backward-compat alias for /api/dockets
  app.use('/api/dockets', ...tenantScopedApiAccess, writeGuardChain, docketRoutes);  // canonical docket API
  app.use('/api', ...tenantScopedApiAccess, writeGuardChain, docketSessionRoutes);
  app.use('/api/attachments', ...tenantScopedApiAccess, writeGuardChain, attachmentRoutes);
  app.use('/api/search', ...tenantScopedApiAccess, writeGuardChain, searchRoutes);
  app.use('/api/worklists', ...tenantScopedApiAccess, writeGuardChain, searchRoutes);
  app.use('/api/client-approval', ...tenantScopedApiAccess, writeGuardChain, clientApprovalRoutes);
  app.use('/api/clients', ...tenantScopedApiAccess, writeGuardChain, clientRoutes);  // Client management (PR #39)
  app.use('/api/crm/clients', ...tenantScopedApiAccess, writeGuardChain, crmClientRoutes);
  app.use('/api/leads', ...tenantScopedApiAccess, writeGuardChain, leadRoutes);
  app.use('/api/forms', ...tenantScopedApiAccess, writeGuardChain, formRoutes);
  app.use('/api/landing-pages', ...tenantScopedApiAccess, writeGuardChain, landingPageRoutes);
  app.use('/api/deals', ...tenantScopedApiAccess, writeGuardChain, dealRoutes);
  app.use('/api/invoices', ...tenantScopedApiAccess, writeGuardChain, invoiceRoutes);
  app.use('/api/reports', ...tenantScopedApiAccess, writeGuardChain, reportsRoutes);  // Reports routes
  app.use('/api/insights', ...tenantScopedApiAccess, writeGuardChain, insightsRoutes);
  app.use('/api/firm/:firmId', ...tenantScopedApiAccess, writeGuardChain, firmMetricsRoutes);
  app.use('/api/storage', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), storageRoutes);  // BYOS storage routes (read-only, no writeGuardChain needed)
  app.use('/api/ai', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), aiRoutes);
  app.use('/api/firm', ...tenantScopedApiAccess, writeGuardChain, firmStorageRoutes);
  app.use('/api/files', authLimiter, ...tenantScopedApiAccess, writeGuardChain, filesRoutes);
  app.use('/api/tenant', authLimiter, ...tenantScopedApiAccess, writeGuardChain, tenantRoutes);
  app.use('/api/docket-storage', authLimiter, ...tenantScopedApiAccess, writeGuardChain, docketFileStorageRoutes);
  // Firm-scoped API auth routes for tenant login and OTP verification.
  // IMPORTANT: Register before generic '/api' mounts so '/api/:firmSlug/*'
  // requests are not intercepted by tenant-authenticated API middleware.
  app.use('/api/notifications', ...tenantScopedApiAccess, writeGuardChain, notificationsRoutes);
  app.use('/api/teams', ...tenantScopedApiAccess, writeGuardChain, teamRoutes);
  app.use('/api/bulk-upload', ...adminTenantScopedApiAccess, writeGuardChain, adminAuditTrail('admin'), bulkUploadRoutes);
  app.use('/api/product-updates', authenticate, writeGuardChain, productUpdateRoutes);
  app.use('/api/settings', ...tenantScopedApiAccess, writeGuardChain, settingsRoutes);
  app.use('/api/:firmSlug', firmRoutes);
  app.use('/api', authLimiter, ...tenantScopedApiAccess, writeGuardChain, docketFileStorageRoutes);

  // Legacy /f routes removed: tenant login is available only on /:firmSlug/login and /api/:firmSlug/login

  // Root route - API status
  app.get('/', (req, res) => {
    res.json({ status: 'Docketra API running' });
  });

  // Error handling
  app.use(notFound);
  app.use(uploadErrorHandler);
  app.use(errorHandler);

  app.locals.allowedOrigins = allowedOrigins;
  return app;
};

module.exports = { createApp };
