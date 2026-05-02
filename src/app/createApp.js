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
const knowledgeItemRoutes = require('../routes/knowledgeItem.routes');
const docketRoutes = require('../routes/docket.routes');
const attachmentRoutes = require('../routes/attachment.routes');
const docketSessionRoutes = require('../routes/docketSession.routes');
const tenantResolver = require('../middleware/tenantResolver');
const { RESERVED_FIRM_SLUGS, firmSlugGuard } = require('../middleware/firmSlugGuard.middleware');
const { login } = require('../controllers/auth.controller');
const { mountHealthRoutes } = require('./routes/mountHealthRoutes');
const { mountPlatformRoutes } = require('./routes/mountPlatformRoutes');
const { mountTenantRoutes } = require('./routes/mountTenantRoutes');
const { mountFallbackRoutes } = require('./routes/mountFallbackRoutes');
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

  const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'X-Correlation-ID', 'X-Impersonated-Firm-Id', 'X-Impersonation-Session-Id', 'X-Impersonation-Mode'];
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

  mountHealthRoutes(app, {
    healthRoutes,
    apiHealth,
    metricsService,
    allowInternalTokenOrSuperadmin,
    internalMetricsLimiter,
    getSecurityMetrics,
  });

  mountPlatformRoutes(app, {
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
  });


  if (!isProduction) {
    const debugRoutes = require('../routes/debug.routes');  // Debug routes (PR #43)
    app.use('/api/debug', authenticate, firmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, debugRoutes);
  }

  app.use('/api/:firmSlug', firmSlugGuard, firmRoutes);

  mountTenantRoutes(app, {
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
  });

  // Legacy /f routes removed: tenant login is available only on /:firmSlug/login and /api/:firmSlug/login

  mountFallbackRoutes(app, { notFound, uploadErrorHandler, errorHandler });

  app.locals.allowedOrigins = allowedOrigins;
  return app;
};

module.exports = { createApp };
