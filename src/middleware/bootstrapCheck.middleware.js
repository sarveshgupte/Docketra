const log = require('../utils/log');
/**
 * Bootstrap Completion Check Middleware
 * 
 * Enforces that Admin users can only access dashboard and data routes
 * after their organization's bootstrap process is completed.
 * 
 * In the client-centric architecture the "organization" is represented by the
 * default Client (isDefaultClient: true).  For backward compatibility with
 * legacy Firm-based deployments the middleware also accepts a Firm document.
 */

/**
 * Require completed organization bootstrap for Admin users.
 * 
 * Use this middleware on routes that require bootstrap to be completed:
 * - Dashboard routes
 * - Case routes
 * - Client routes
 * - User management routes
 * - Report routes
 * 
 * DO NOT use on:
 * - Authentication routes (login, logout, set-password)
 * - Profile routes
 * - OAuth callbacks
 * - Bootstrap completion routes themselves
 */
const requireCompletedFirm = async (req, res, next) => {
  try {
    // Only check Admin users (SuperAdmin and Employees are exempt)
    if (req.user.role !== 'Admin') {
      return next();
    }
    
    // Admin must have firmId (tenant scope)
    if (!req.user.firmId) {
      log.error(`[BOOTSTRAP] Admin user ${req.user.xID} missing firmId`);
      return res.status(500).json({
        success: false,
        message: 'Account configuration error. Please contact administrator.',
      });
    }

    // ── New architecture: default client ─────────────────────────────────
    const Client = require('../models/Client.model');
    const defaultClient = await Client.findOne({ _id: req.user.firmId, isDefaultClient: true })
      .select('status').lean();

    if (defaultClient) {
      // Default client exists — organization is bootstrapped
      return next();
    }

    // ── Legacy Firm fallback ──────────────────────────────────────────────
    let Firm;
    try { Firm = require('../models/Firm.model'); } catch (_) { /* no Firm model */ }

    if (Firm) {
      const firm = await Firm.findById(req.user.firmId).select('bootstrapStatus').lean();
      if (firm) {
        if (firm.bootstrapStatus !== 'COMPLETED') {
          log.warn(`[BOOTSTRAP] Access blocked for ${req.user.xID} - firm bootstrap not completed (status: ${firm.bootstrapStatus})`);
          return res.status(403).json({
            success: false,
            code: 'FIRM_BOOTSTRAP_INCOMPLETE',
            message: 'Organization setup is incomplete. Please complete the setup process before accessing this feature.',
            bootstrapStatus: firm.bootstrapStatus,
          });
        }
        return next();
      }
    }

    // Neither a default client nor a Firm was found — allow access so the user
    // can trigger the auto-creation of the default client on the first request.
    log.warn(`[BOOTSTRAP] No organization record found for admin ${req.user.xID}, firmId: ${req.user.firmId} — allowing through`);
    return next();
  } catch (error) {
    log.error('[BOOTSTRAP] Error checking organization bootstrap status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking organization setup status',
      error: error.message,
    });
  }
};

module.exports = {
  requireCompletedFirm,
};
