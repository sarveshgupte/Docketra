// Load environment variables FIRST (before any other imports)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const connectDB = require('./config/database');
const config = require('./config/config');
const log = require('./utils/log');
const { runBootstrap } = require('./services/bootstrap.service');
const { maskSensitiveObject, sanitizeErrorForLog } = require('./utils/pii');
const { validateEnv } = require('./config/validateEnv');
const { loadEnv, maskEnvForLog } = require('./config/env');
const { logBuildMetadata } = require('./services/buildInfo.service');
require('./utils/transactionSessionEnforcer');

const env = loadEnv();
log.info('API_RUNTIME_WORKERS_DISABLED');

// Global error log sanitizer: ensure every console.error invocation masks PII (tokens, emails, phone numbers, auth headers).
// This preserves existing logging behavior/verbosity while enforcing centralized masking via maskSensitiveObject.
// The original logger is retained at console.error.original for debugging tools that need raw access.
let piiSafeErrorApplied = false;
const applyPIISafeConsoleError = () => {
  if (piiSafeErrorApplied) return;
  const originalConsoleError = console.error;
  const maskLogArg = (arg, seen) => {
    if (arg instanceof Error) {
      return sanitizeErrorForLog(arg);
    }
    if (Array.isArray(arg)) {
      return maskSensitiveObject(arg, seen);
    }
    if (arg && typeof arg === 'object') {
      return maskSensitiveObject(arg, seen);
    }
    return arg;
  };
  const piiSafeError = (...args) => {
    const seen = new WeakSet();
    const maskedArgs = args.map((arg) => maskLogArg(arg, seen));
    originalConsoleError(...maskedArgs);
  };
  piiSafeError.original = originalConsoleError;
  console.error = piiSafeError;
  piiSafeErrorApplied = true;
};

applyPIISafeConsoleError();

// Middleware
const requestLogger = require('./middleware/requestLogger');
const requestId = require('./middleware/requestId.middleware');
const { attachRequestContext } = require('./middleware/attachRequestContext');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { authenticate } = require('./middleware/auth.middleware');
const degradedGuard = require('./middleware/degradedGuard');
const { firmContext } = require('./middleware/firmContext.middleware');
const requireTenant = require('./middleware/requireTenant');
const { requireAdmin, requireSuperadmin } = require('./middleware/permission.middleware');
const responseContract = require('./middleware/responseContract.middleware');
const invariantGuard = require('./middleware/invariantGuard');
const domainInvariantGuard = require('./middleware/domainInvariantGuard');
const { idempotencyMiddleware } = require('./middleware/idempotency.middleware');
const metricsService = require('./services/metrics.service');
const { adminAuditTrail } = require('./middleware/adminAudit.middleware');
const requestLifecycle = require('./middleware/requestLifecycle.middleware');
const { enforceTemporaryIpBlock } = require('./middleware/securityIpBlock.middleware');
const { noFirmNoTransaction } = require('./middleware/noFirmNoTransaction.middleware');
const optionsPreflight = require('./middleware/optionsPreflight.middleware');
const {
  authLimiter,
  loginLimiter,
  publicLimiter,
  globalApiLimiter,
  internalMetricsLimiter,
  contactLimiter,
  superadminLimiter,
} = require('./middleware/rateLimiters');
const { tenantThrottle } = require('./middleware/tenantThrottle.middleware');
const cookieParser = require('./middleware/cookieParser.middleware');
const { uploadErrorHandler, ensureUploadRoot } = require('./middleware/uploadProtection.middleware');
const { allowInternalTokenOrSuperadmin } = require('./middleware/internalMetricsAccess.middleware');
const { tenantScopedApiAccess, adminTenantScopedApiAccess } = require('./routes/routeGroups');

// Routes
const userRoutes = require('./routes/user.routes');
const selfUserRoutes = require('./routes/selfUser.routes');
const taskRoutes = require('./routes/task.routes');
const complianceCalendarRoutes = require('./routes/complianceCalendar.routes');
const caseRoutes = require('./routes/case.routes');
const searchRoutes = require('./routes/search.routes');  // Search and worklist routes
const authRoutes = require('./routes/auth.routes');  // Authentication routes
const clientApprovalRoutes = require('./routes/clientApproval.routes');  // Client approval routes
const clientRoutes = require('./routes/client.routes');  // Client management routes (PR #39)
const reportsRoutes = require('./routes/reports.routes');  // Reports routes
const categoryRoutes = require('./routes/category.routes');  // Category routes
const workTypeRoutes = require('./routes/workType.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const firmMetricsRoutes = require('./routes/firmMetrics.routes');
const adminRoutes = require('./routes/admin.routes');  // Admin routes (PR #41)
const superadminRoutes = require('./routes/superadmin.routes');  // Superadmin routes
const debugRoutes = require('./routes/debug.routes');  // Debug routes (PR #43)
const contactRoutes = require('./routes/contact.routes');  // Public contact form route
const publicRoutes = require('./routes/public.routes');  // Public routes (firm lookup)
const publicSignupRoutes = require('./routes/publicSignup.routes');  // Public self-serve signup routes
const firmRoutes = require('./routes/firm.routes');
const firmStorageRoutes = require('./routes/firmStorage.routes');
const healthRoutes = require('./routes/health.routes');  // Health endpoints
const { apiHealth } = require('./controllers/health.controller');
const storageRoutes = require('./routes/storage.routes');  // Storage BYOS routes
const filesRoutes = require('./routes/files.routes');  // Tenant BYOS signed URL routes
const securityRoutes = require('./routes/security.routes');
const { getSecurityMetrics } = require('./controllers/security.controller');
const tenantRoutes = require('./routes/tenant.routes');  // Tenant storage settings routes
const docketFileStorageRoutes = require('./routes/docketFileStorage.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const bulkUploadRoutes = require('./routes/bulkUpload.routes');
const tenantResolver = require('./middleware/tenantResolver');
const { login } = require('./controllers/auth.controller');
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

// Initialize Express app
const app = express();
app.set('trust proxy', 1);

const configuredOrigins = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (isProduction && configuredOrigins.some((origin) => origin === '*')) {
  throw new Error('SECURITY: Wildcard CORS is forbidden in production');
}
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : (!isProduction ? ['http://localhost:5173'] : []);
log.info('CORS_ALLOWED_ORIGINS', { allowedOrigins });

// Connect to MongoDB and run bootstrap
connectDB()
  .then(() => runBootstrap())
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

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

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  dnsPrefetchControl: { allow: false },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: cspConnectSrc,
      reportUri: ['/api/csp-violation'],
    },
  },
}));

// SECURITY: Capture CSP reports without exposing internals to clients.
app.post('/api/csp-violation', express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'] }), (req, res) => {
  const report = maskSensitiveObject(req.body || {});
  log.warn('CSP_VIOLATION_REPORTED', { report });
  return res.status(204).end();
});

const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'];
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
app.use(requestId);
app.use(attachRequestContext);
app.use(enforceTemporaryIpBlock);
app.use(requestLifecycle);
app.use(requestLogger);
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

  if (!configuredMetricsToken || !token || token !== configuredMetricsToken) {
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
  res.json({
    success: true,
    message: 'Welcome to Docketra API',
    version: '1.0.0',
    endpoints: {
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
      categories: '/api/categories',
      admin: '/api/admin',
      dashboard: '/api/dashboard',
      superadmin: '/api/superadmin',
      superadminLegacy: '/superadmin',
      debug: '/api/debug',
    },
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

// Category routes (user-facing reads; admin management is also available under /api/admin/categories)
app.use('/api/categories', writeGuardChain, categoryRoutes);
app.use('/api/work-types', ...tenantScopedApiAccess, writeGuardChain, workTypeRoutes);

// Admin routes (firm-scoped) - enforce auth + firm context + admin role boundary
app.use('/api/admin', ...adminTenantScopedApiAccess, writeGuardChain, adminAuditTrail('admin'), adminRoutes);
app.use('/api/dashboard', ...adminTenantScopedApiAccess, writeGuardChain, dashboardRoutes);

// Superadmin routes - platform scope only (no firm context)
// Include legacy /superadmin to prevent SPA fallback when UI calls API without /api prefix.
['/api/sa', '/api/superadmin', '/superadmin'].forEach((basePath) => {
  app.use(basePath, superadminLimiter, authenticate, writeGuardChain, adminAuditTrail('superadmin'), superadminRoutes);
});
app.use('/api/security', authenticate, securityRoutes);

// SECURITY: Debug routes must never be reachable in production environments.
if (!isProduction) {
  app.use('/api/debug', authenticate, firmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, debugRoutes);
}

// Protected routes - require authentication
// Firm context must be attached for all tenant-scoped operations
app.use('/api/users', ...tenantScopedApiAccess, writeGuardChain, userRoutes);
app.use('/api/user', authenticate, selfUserRoutes);
app.use('/api/tasks', ...tenantScopedApiAccess, writeGuardChain, taskRoutes);
app.use('/api/compliance-calendar', ...tenantScopedApiAccess, writeGuardChain, complianceCalendarRoutes);
app.use('/api/cases', ...tenantScopedApiAccess, writeGuardChain, caseRoutes);
app.use('/api/search', ...tenantScopedApiAccess, writeGuardChain, searchRoutes);
app.use('/api/worklists', ...tenantScopedApiAccess, writeGuardChain, searchRoutes);
app.use('/api/client-approval', ...tenantScopedApiAccess, writeGuardChain, clientApprovalRoutes);
app.use('/api/clients', ...tenantScopedApiAccess, writeGuardChain, clientRoutes);  // Client management (PR #39)
app.use('/api/reports', ...tenantScopedApiAccess, writeGuardChain, reportsRoutes);  // Reports routes
app.use('/api/firm/:firmId', ...tenantScopedApiAccess, writeGuardChain, firmMetricsRoutes);
app.use('/api/storage', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), storageRoutes);  // BYOS storage routes (read-only, no writeGuardChain needed)
app.use('/api/firm', ...tenantScopedApiAccess, writeGuardChain, firmStorageRoutes);
app.use('/api/files', authLimiter, ...tenantScopedApiAccess, writeGuardChain, filesRoutes);
app.use('/api/tenant', authLimiter, ...tenantScopedApiAccess, writeGuardChain, tenantRoutes);
app.use('/api/docket-storage', authLimiter, ...tenantScopedApiAccess, writeGuardChain, docketFileStorageRoutes);
app.use('/api/notifications', ...tenantScopedApiAccess, writeGuardChain, notificationsRoutes);
app.use('/api/bulk-upload', ...adminTenantScopedApiAccess, writeGuardChain, adminAuditTrail('admin'), bulkUploadRoutes);

// Firm-scoped API auth routes for tenant login and OTP verification
app.use('/api/:firmSlug', firmRoutes);

// Legacy /f routes removed: tenant login is available only on /:firmSlug/login and /api/:firmSlug/login

// Root route - API status
app.get('/', (req, res) => {
  res.json({ status: 'Docketra API running' });
});

// Error handling
app.use(notFound);
app.use(uploadErrorHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  // Schedule stale temp-upload cleanup every 6 hours (no external cron dependency)
  const { cleanupStaleTmpUploads } = require('./utils/cleanupTmpUploads');
  setInterval(() => {
    cleanupStaleTmpUploads().catch(err =>
      console.error('[cleanupTmpUploads] failed', { message: err.message })
    );
  }, 6 * 60 * 60 * 1000); // 6 hours
  console.log(`
╔════════════════════════════════════════════╗
║         Docketra API Server                ║
║                                            ║
║  Status: Running                           ║
║  Port: ${PORT}                              ║
║  Environment: ${config.env}                ║
║  URL: http://localhost:${PORT}             ║
║                                            ║
║  API Documentation: /api                   ║
║  Health Check: /health                     ║
╚════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections (mask to prevent PII leakage in logs)
process.on('unhandledRejection', (err) => {
  const sanitizedError = sanitizeErrorForLog(err);
  console.error('Unhandled Promise Rejection:', sanitizedError);
  server.close(() => process.exit(1));
});

module.exports = app;
