// Load environment variables FIRST (before any other imports)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const config = require('./config/config');
const log = require('./utils/log');
const { runBootstrap } = require('./services/bootstrap.service');
const { maskSensitiveObject, sanitizeErrorForLog } = require('./utils/pii');
const { validateEnv } = require('./config/validateEnv');
const { logBuildMetadata } = require('./services/buildInfo.service');
require('./utils/transactionSessionEnforcer');

// Bootstrap storage worker in-process (non-blocking — failures do not prevent startup)
try {
  require('./workers/storage.worker');
  log.info('STORAGE_WORKER_STARTED');
} catch (err) {
  log.warn('STORAGE_WORKER_START_FAILED', { error: err.message });
}

try {
  require('./workers/inboundEmail.worker');
  log.info('INBOUND_EMAIL_WORKER_STARTED');
} catch (err) {
  log.warn('INBOUND_EMAIL_WORKER_START_FAILED', { error: err.message });
}

try {
  require('./workers/storageIntegrity.worker');
  log.info('STORAGE_INTEGRITY_WORKER_STARTED');
} catch (err) {
  log.warn('STORAGE_INTEGRITY_WORKER_START_FAILED', { error: err.message });
}


try {
  require('./workers/tenantCaseMetrics.worker');
  log.info('TENANT_CASE_METRICS_WORKER_STARTED');
} catch (err) {
  log.warn('TENANT_CASE_METRICS_WORKER_START_FAILED', { error: err.message });
}

try {
  require('./workers/email.worker');
  log.info('EMAIL_WORKER_STARTED');
} catch (err) {
  log.warn('EMAIL_WORKER_START_FAILED', { error: err.message });
}

try {
  require('./workers/audit.worker');
  log.info('AUDIT_WORKER_STARTED');
} catch (err) {
  log.warn('AUDIT_WORKER_START_FAILED', { error: err.message });
}

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
const { noFirmNoTransaction } = require('./middleware/noFirmNoTransaction.middleware');
const optionsPreflight = require('./middleware/optionsPreflight.middleware');
const { authLimiter, loginLimiter, publicLimiter, globalApiLimiter, sensitiveLimiter } = require('./middleware/rateLimiters');
const { tenantThrottle } = require('./middleware/tenantThrottle.middleware');
const { uploadErrorHandler } = require('./middleware/uploadProtection.middleware');

// Routes
const userRoutes = require('./routes/user.routes');
const taskRoutes = require('./routes/task.routes');
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
const inboundRoutes = require('./routes/inbound.routes');  // Inbound email routes
const contactRoutes = require('./routes/contact.routes');  // Public contact form route
const publicRoutes = require('./routes/public.routes');  // Public routes (firm lookup)
const publicSignupRoutes = require('./routes/publicSignup.routes');  // Public self-serve signup routes
const healthRoutes = require('./routes/health.routes');  // Health endpoints
const { apiHealth } = require('./controllers/health.controller');
const storageRoutes = require('./routes/storage.routes');  // Storage BYOS routes
const filesRoutes = require('./routes/files.routes');  // Tenant BYOS signed URL routes
const tenantRoutes = require('./routes/tenant.routes');  // Tenant storage settings routes
const tenantResolver = require('./middleware/tenantResolver');
const { login } = require('./controllers/auth.controller');
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const superadminRouteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.xID || req.user?._id || req.ip || 'unknown',
});
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many contact requests. Please try again later.' },
});
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
log.info('SERVER_ENV', { nodeEnv: process.env.NODE_ENV || 'undefined' });

// Detect production mode
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SUPERADMIN_PASSWORD_HASH) {
  throw new Error('SECURITY: SUPERADMIN_PASSWORD_HASH is required in production');
}

// SECURITY: Metrics endpoint fail-closed enforcement
if (isProduction && !process.env.METRICS_TOKEN) {
  throw new Error('SECURITY: METRICS_TOKEN is required in production');
}
if (isProduction && !process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
  throw new Error('INBOUND_EMAIL_WEBHOOK_SECRET must be configured in production');
}

validateEnv();
logBuildMetadata();

// Environment variable validation
const requiredEnvVars = ['JWT_SECRET', 'NODE_ENV'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  missingEnvVars.push('MONGO_URI or MONGODB_URI');
}
if (missingEnvVars.length > 0) {
  console.error(`❌ Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please ensure these variables are set in your .env file or environment.');
  process.exit(1);
}

// BYOS Google OAuth env validation — warn only, app continues without these vars.
// Validation is enforced at request time inside getStorageOAuthClient().
const requiredStorageOAuthVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'STORAGE_TOKEN_SECRET', 'FRONTEND_URL'];
const missingByosVars = requiredStorageOAuthVars.filter(key => !process.env[key]);
if (missingByosVars.length > 0) {
  console.warn(`⚠️  BYOS Google OAuth variables not set: ${missingByosVars.join(', ')}. Storage connect endpoints will be unavailable until these are configured.`);
}

// Google Drive initialization block removed — legacy service-account storage eliminated.

// SMTP environment variable validation (production only)
if (isProduction) {
  const requiredEmailVars = ['BREVO_API_KEY'];
  const missingEmailVars = requiredEmailVars.filter(key => !process.env[key]);
  
  // Check for sender email (prefer MAIL_FROM, fallback to SMTP_FROM)
  const senderEmail = process.env.MAIL_FROM || process.env.SMTP_FROM;
  if (!senderEmail) {
    missingEmailVars.push('MAIL_FROM or SMTP_FROM');
  } else {
    // Validate MAIL_FROM format
    // Note: Require here (not at top) to ensure env vars are loaded first
    try {
      const { parseSender } = require('./services/email.service');
      const sender = parseSender(senderEmail);
      console.log(`[EMAIL] Using sender: ${sender.name} <${sender.email}>`);
    } catch (error) {
      console.error('❌ Error: Invalid MAIL_FROM format.');
      console.error(error.message);
      console.error('Expected format: "Name <email@domain>" or "email@domain"');
      console.error(`Current value: ${senderEmail}`);
      process.exit(1);
    }
  }
  
  if (missingEmailVars.length > 0) {
    console.error('❌ Error: Production requires Brevo API configuration for email delivery.');
    console.error('Missing email variables:', missingEmailVars.join(', '));
    console.error('Please configure these variables in your production environment:');
    missingEmailVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    process.exit(1);
  }
  console.log('[EMAIL] Brevo API configured for production email delivery.');
} else {
  console.log('[EMAIL] Development mode – emails will be logged to console only.');
}

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
app.use('/api/inbound/email', express.raw({ type: '*/*', limit: '30mb' }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
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
app.get('/metrics', async (req, res) => {
  // SECURITY: Metrics endpoint fail-closed enforcement
  const configuredMetricsToken = process.env.METRICS_TOKEN;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!configuredMetricsToken || !token || token !== configuredMetricsToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  res.json(await metricsService.getSnapshot());
});

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
      inbound: '/api/inbound',
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
app.post('/superadmin/login', ...superadminLoginChain);

// Tenant login must be slug-scoped only
app.get('/:firmSlug/login', loginLimiter, tenantResolver, (req, res) => {
  res.json({ success: true, data: { firmId: req.firmIdString, firmSlug: req.firmSlug, name: req.firmName, status: req.firm.status } });
});
app.post('/:firmSlug/login', loginLimiter, tenantResolver, noFirmNoTransaction, (req, res, next) => { req.loginScope = 'tenant'; next(); }, login);

// Public routes (no authentication required)
app.use('/api/public', publicLimiter, writeGuardChain, publicRoutes);
app.use('/public', publicLimiter, writeGuardChain, publicRoutes);

// Public self-serve signup routes (no authentication required)
app.use('/public', publicLimiter, publicSignupRoutes);

// Contact form route (public, no authentication required)
app.use('/api/contact', contactLimiter, contactRoutes);

// Category routes (public GET for active categories, admin-only for modifications)
app.use('/api/categories', writeGuardChain, categoryRoutes);
app.use('/api/work-types', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, workTypeRoutes);

// Admin routes (firm-scoped) - enforce auth + firm context + admin role boundary
app.use('/api/admin', authenticate, firmContext, requireTenant, tenantThrottle, sensitiveLimiter, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, adminAuditTrail('admin'), adminRoutes);
app.use('/api/dashboard', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, dashboardRoutes);

// Superadmin routes - platform scope only (no firm context)
// Include legacy /superadmin to prevent SPA fallback when UI calls API without /api prefix.
['/api/sa', '/api/superadmin', '/superadmin'].forEach((basePath) => {
  app.use(basePath, authenticate, superadminRouteLimiter, writeGuardChain, adminAuditTrail('superadmin'), superadminRoutes);
});

// SECURITY: Debug routes must never be reachable in production environments.
if (!isProduction) {
  app.use('/api/debug', authenticate, firmContext, requireTenant, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, requireAdmin, debugRoutes);
}

// Inbound email routes (webhook - no authentication required)
app.use('/api/inbound', writeGuardChain, inboundRoutes);

// Protected routes - require authentication
// Firm context must be attached for all tenant-scoped operations
app.use('/api/users', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, userRoutes);
app.use('/api/tasks', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, taskRoutes);
app.use('/api/cases', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, caseRoutes);
app.use('/api/search', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, searchRoutes);
app.use('/api/worklists', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, searchRoutes);
app.use('/api/client-approval', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, clientApprovalRoutes);
app.use('/api/clients', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, clientRoutes);  // Client management (PR #39)
app.use('/api/reports', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, reportsRoutes);  // Reports routes
app.use('/api/firm/:firmId', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, firmMetricsRoutes);
app.use('/api/storage', authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), storageRoutes);  // BYOS storage routes (read-only, no writeGuardChain needed)
app.use('/api/files', authLimiter, authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, filesRoutes);
app.use('/api/tenant', authLimiter, authenticate, firmContext, requireTenant, tenantThrottle, invariantGuard({ requireFirm: true, forbidSuperAdmin: true }), writeGuardChain, tenantRoutes);

// Legacy /f routes removed: tenant login is available only on /:firmSlug/login

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
  const { runStorageHealthCheck } = require('./jobs/storageHealthCheck.job');
  const { enqueueDailyStorageIntegrityJob } = require('./queues/storageIntegrity.queue');
  setInterval(() => {
    runStorageHealthCheck().catch((err) =>
      console.error('[storageHealthCheck] failed', { message: err.message })
    );
  }, 8 * 60 * 60 * 1000); // 8 hours
  enqueueDailyStorageIntegrityJob().catch((err) =>
    console.error('[storageIntegritySchedule] registration failed', { message: err.message })
  );
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
