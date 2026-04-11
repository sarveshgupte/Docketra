/**
 * Bootstrap Service for Docketra
 * 
 * Performs startup validation and integrity checks.
 * 
 * IMPORTANT: This service does NOT auto-create firms or users.
 * - Firms are created by SuperAdmin via POST /api/superadmin/firms
 *   OR by public self-serve signup flows
 * - Empty database is a valid and supported state
 * - SuperAdmin is NOT stored in MongoDB - exists ONLY in .env
 * 
 * Features:
 * - Runs automatically on server startup (after MongoDB connection)
 * - Validates data integrity for existing firms
 * - Logs warnings for inconsistencies (does not auto-heal)
 * - NEVER crashes the application
 * 
 * Hierarchy validated (not enforced through auto-creation):
 * Firm → Default Client (isSystemClient=true) → Admin Users
 */

const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const Plan = require('../models/Plan.model');
const mongoose = require('mongoose');
const { runAdminHierarchyBackfill } = require('../scripts/fixAdminHierarchy');
const { loadEnv } = require('../config/env');

/**
 * REMOVED: seedSystemAdmin
 * 
 * This function previously auto-created FIRM001, a default client, and system admin.
 * 
 * NEW BEHAVIOR:
 * - Firms are created by SuperAdmin via POST /api/superadmin/firms
 *   OR by public self-serve signup flows
 * - Empty database is a valid and supported state
 * - Bootstrap does NOT auto-create any firms or users
 */

/**
 * REMOVED: seedDefaultClient
 * 
 * This function is no longer needed as firms are created by SuperAdmin and signup flows.
 */

/**
 * Run preflight data validation checks
 * 
 * Logs warnings for data inconsistencies that violate the hierarchy:
 * - Firms without defaultClientId
 * - Clients without firmId
 * - Admins without firmId or defaultClientId
 * 
 * Sends ONE email to SuperAdmin if violations exist (rate-limited per process start).
 * Does NOT block startup, only logs warnings.
 * Does NOT auto-heal or mutate data.
 * 
 * EMPTY DATABASE HANDLING:
 * - If no firms exist, logs informational message (not a warning)
 * - Empty database is a valid and supported state
 * - Does NOT send email for empty database
 */
let adminBackfillRan = false;
const env = loadEnv({ exitOnError: false }) || {};

const seedPlans = async ({ session } = {}) => {
  const seedData = [
    { name: 'Free', maxUsers: 2, billingType: 'FREE', pricePerUser: null, isEnterprise: false },
    { name: 'Growth', maxUsers: null, billingType: 'PER_USER', pricePerUser: 199, isEnterprise: false },
    { name: 'Enterprise', maxUsers: null, billingType: 'ENTERPRISE', pricePerUser: null, isEnterprise: true },
  ];

  for (const plan of seedData) {
    await Plan.updateOne({ name: plan.name }, { $set: plan }, { upsert: true, session });
  }
};

const runPreflightChecks = async ({ session } = {}) => {
  try {
    console.log('\n🔍 Running preflight data validation checks...');
    
    const violations = {};
    const info = {};
    let hasViolations = false;
    const autoRunBackfill = process.env.RUN_ADMIN_HIERARCHY_MIGRATION_ON_START === 'true';
    
    // Check if any firms exist
    const totalFirms = await Firm.countDocuments();
    
    if (totalFirms === 0) {
      console.log('ℹ️  No firms exist yet. Firms can be created by SuperAdmin or during user signup.');
      console.log('✓ All preflight checks passed (empty database is valid)');
      return { hasViolations: false, violations: {}, info: {} };
    }
    
    console.log(`ℹ️  Found ${totalFirms} firm(s) in database. Validating integrity...`);
    
    // Optional: auto-run admin hierarchy backfill before validation (one-time per process)
    if (autoRunBackfill && !adminBackfillRan) {
      adminBackfillRan = true;
      console.log('🔧 RUN_ADMIN_HIERARCHY_MIGRATION_ON_START=true detected. Running backfill...');
      const backfillTimeoutMs = parseInt(process.env.ADMIN_BACKFILL_TIMEOUT_MS, 10) || 30000;
      try {
        await Promise.race([
          runAdminHierarchyBackfill({ useExistingConnection: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Admin backfill exceeded ${backfillTimeoutMs}ms`)), backfillTimeoutMs))
        ]);
        console.log('🔧 Admin hierarchy backfill completed');
      } catch (backfillError) {
        console.error('⚠️  Admin hierarchy backfill failed or timed out:', backfillError.message);
      }
    }
    
    // PR-2: Backward compatibility - Set bootstrapStatus for existing firms
    const firmsWithoutBootstrapStatus = await Firm.find({ 
      $or: [
        { bootstrapStatus: { $exists: false } },
        { bootstrapStatus: null }
      ]
    }).select('firmId name defaultClientId');
    
    if (firmsWithoutBootstrapStatus.length > 0) {
      console.log(`ℹ️  Found ${firmsWithoutBootstrapStatus.length} firm(s) without bootstrapStatus - applying backward compatibility...`);
      
      const bulkOps = firmsWithoutBootstrapStatus.map(firm => {
        const status = firm.defaultClientId ? 'COMPLETED' : 'PENDING';
        console.log(`   ✓ Set ${firm.firmId} bootstrapStatus to ${status}`);
        return {
          updateOne: {
            filter: { _id: firm._id },
            update: { $set: { bootstrapStatus: status } }
          }
        };
      });

      if (bulkOps.length > 0) {
        await Firm.bulkWrite(bulkOps, { session });
      }
    }
    
    // PR-2: Check for firms with incomplete bootstrap
    const pendingFirms = await Firm.find({ 
      bootstrapStatus: 'PENDING' 
    }).select('firmId name bootstrapStatus');
    
    if (pendingFirms.length > 0) {
      hasViolations = true;
      violations.pendingBootstrapFirms = pendingFirms.map(f => ({
        firmId: f.firmId,
        name: f.name,
        bootstrapStatus: f.bootstrapStatus
      }));
      console.warn(`⚠️  WARNING: Found ${pendingFirms.length} firm(s) with incomplete bootstrap:`);
      pendingFirms.forEach(firm => {
        console.warn(`   - Firm: ${firm.firmId} (${firm.name}) - Status: ${firm.bootstrapStatus}`);
      });
      console.warn(`   → These firms may need manual recovery via recoverFirmBootstrap()`);
    }
    
    // Check for firms without defaultClientId (excluding PENDING firms)
    const firmsWithoutDefaultClient = await Firm.find({ 
      bootstrapStatus: { $ne: 'PENDING' }, // Exclude PENDING firms
      $or: [
        { defaultClientId: { $exists: false } },
        { defaultClientId: null }
      ]
    }).select('firmId name bootstrapStatus');
    
    if (firmsWithoutDefaultClient.length > 0) {
      hasViolations = true;
      violations.firmsWithoutDefaultClient = firmsWithoutDefaultClient.map(f => ({
        firmId: f.firmId,
        name: f.name,
        bootstrapStatus: f.bootstrapStatus
      }));
      console.warn(`⚠️  WARNING: Found ${firmsWithoutDefaultClient.length} firm(s) without defaultClientId:`);
      firmsWithoutDefaultClient.forEach(firm => {
        console.warn(`   - Firm: ${firm.firmId} (${firm.name}) - Status: ${firm.bootstrapStatus || 'N/A'}`);
      });
    }
    
    // Check for clients without firmId
    const clientsWithoutFirm = await Client.find({ 
      $or: [
        { firmId: { $exists: false } },
        { firmId: null }
      ]
    }).select('clientId businessName');
    
    if (clientsWithoutFirm.length > 0) {
      hasViolations = true;
      violations.clientsWithoutFirm = clientsWithoutFirm.map(c => ({
        clientId: c.clientId,
        businessName: c.businessName
      }));
      console.warn(`⚠️  WARNING: Found ${clientsWithoutFirm.length} client(s) without firmId:`);
      clientsWithoutFirm.forEach(client => {
        console.warn(`   - Client: ${client.clientId} (${client.businessName})`);
      });
    }
    
    // Info-only: SUPER_ADMINs may not have firm/default client
    const superAdminsMissingContext = await User.find({
      role: 'SUPER_ADMIN',
      $or: [
        { firmId: { $exists: false } },
        { firmId: null },
        { defaultClientId: { $exists: false } },
        { defaultClientId: null }
      ]
    }).select('xID name firmId defaultClientId role');

    if (superAdminsMissingContext.length > 0) {
      info.superAdminsMissingContext = superAdminsMissingContext.map(sa => ({
        xID: sa.xID,
        name: sa.name,
        missing: [
          !sa.firmId ? 'firmId' : null,
          !sa.defaultClientId ? 'defaultClientId' : null,
        ].filter(Boolean),
      }));
      violations.superAdminsMissingContext = info.superAdminsMissingContext;
      violations.byRole = violations.byRole || {};
      violations.byRole.SUPER_ADMIN = info.superAdminsMissingContext;
      console.info(`ℹ️  ${superAdminsMissingContext.length} SUPER_ADMIN account(s) without firm/defaultClient detected (allowed):`);
      superAdminsMissingContext.forEach(sa => {
        if (!sa.firmId) console.info(`   - ${sa.xID}: missing firmId (allowed for SUPER_ADMIN)`);
        if (!sa.defaultClientId) console.info(`   - ${sa.xID}: missing defaultClientId (allowed for SUPER_ADMIN)`);
      });
    }

    // Check for Admin/Employee without firmId or defaultClientId
    const adminScopeRoles = ['Admin', 'Employee'];
    const adminsWithoutFirm = await User.find({ 
      role: { $in: adminScopeRoles },
      $or: [
        { firmId: { $exists: false } },
        { firmId: null },
        { defaultClientId: { $exists: false } },
        { defaultClientId: null }
      ]
    }).select('xID name firmId defaultClientId role');
    
    if (adminsWithoutFirm.length > 0) {
      hasViolations = true;
      violations.adminsWithoutFirmOrClient = adminsWithoutFirm.map(a => {
        const missing = [];
        if (!a.firmId) missing.push('firmId');
        if (!a.defaultClientId) missing.push('defaultClientId');
        return {
          xID: a.xID,
          name: a.name,
          role: a.role,
          missing
        };
      });
      violations.byRole = violations.byRole || {};
      violations.byRole.ADMIN = violations.adminsWithoutFirmOrClient;

      console.error(`❌  ERROR: Found ${adminsWithoutFirm.length} admin/employee account(s) missing firm/defaultClient context:`);
      adminsWithoutFirm.forEach(admin => {
        console.error(`   - ${admin.role}: ${admin.xID} (${admin.name})`);
        if (!admin.firmId) console.error(`     Missing: firmId`);
        if (!admin.defaultClientId) console.error(`     Missing: defaultClientId`);
      });
      console.error('   ↳ Remediation: run "node src/scripts/fixAdminHierarchy.js" after taking a backup.');
    }

    // Send email if violations exist
    if (hasViolations) {
      console.warn('⚠️  Preflight checks found data inconsistencies (see warnings above)');
      console.warn('⚠️  These issues should be resolved through data migration');
      
      // Send Tier-1 email: System Integrity Warning (rate-limited per process start)
      const superadminEmail = process.env.SUPERADMIN_EMAIL;
      if (superadminEmail) {
        try {
          const emailService = require('./email.service');
          await emailService.sendSystemIntegrityEmail(superadminEmail, violations);
          console.log('✓ System integrity warning email sent to SuperAdmin');
        } catch (emailError) {
          console.error('✗ Failed to send integrity warning email:', emailError.message);
          // Don't throw - email failure should not block startup
        }
      } else {
        console.warn('⚠️  SUPERADMIN_EMAIL not configured - cannot send integrity warning email');
      }
    } else {
      console.log('✓ All preflight checks passed - data hierarchy is consistent');
    }

    return { hasViolations, violations, info };
  } catch (error) {
    console.error('✗ Error running preflight checks:', error.message);
    // Don't throw - preflight checks should never block startup
    return { hasViolations: true, violations: { error: error.message } };
  }
};

/**
 * Recover firm bootstrap for a specific firm
 * 
 * PR-2: Bootstrap Atomicity & Identity Decoupling
 * 
 * This function attempts to recover a firm that may have incomplete bootstrap:
 * - Detects missing admin
 * - Detects missing default client
 * - Re-creates missing pieces (in a transaction)
 * - Finalizes bootstrap by setting bootstrapStatus = COMPLETED
 * 
 * This allows manual recovery via SuperAdmin tools or automated cron recovery.
 * 
 * @param {string|ObjectId} firmId - Firm MongoDB _id or firmId string
 * @returns {Object} Recovery result with status and details
 */
const recoverFirmBootstrap = async (firmId) => {
  const mongoose = require('mongoose');
  const { generateNextClientId } = require('./clientIdGenerator');
  const { generateNextXID } = require('./xIDGenerator');
  
  try {
    console.log(`[BOOTSTRAP_RECOVERY] Starting recovery for firm: ${firmId}`);
    
    // Find firm (by _id or firmId string)
    let firm;
    if (mongoose.Types.ObjectId.isValid(firmId)) {
      firm = await Firm.findById(firmId);
    } else {
      firm = await Firm.findOne({ firmId: firmId });
    }
    
    if (!firm) {
      return {
        success: false,
        message: 'Firm not found',
      };
    }
    
    // Check if already completed
    if (firm.bootstrapStatus === 'COMPLETED') {
      console.log(`[BOOTSTRAP_RECOVERY] Firm ${firm.firmId} already completed`);
      return {
        success: true,
        message: 'Firm bootstrap already completed',
        firmId: firm.firmId,
      };
    }
    
    // Start recovery transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const recoveryActions = [];
      
      // Check 1: Does firm have a default client?
      let defaultClient = null;
      if (!firm.defaultClientId) {
        console.log(`[BOOTSTRAP_RECOVERY] Missing default client for firm ${firm.firmId}`);
        
        // Check if a client exists but isn't linked
        defaultClient = await Client.findOne({ 
          firmId: firm._id, 
          isInternal: true 
        }).session(session);
        
        if (!defaultClient) {
          // Create default client
          const clientId = await generateNextClientId(firm._id, session);
          defaultClient = new Client({
            clientId,
            businessName: firm.name,
            businessAddress: 'Default Address',
            primaryContactNumber: '0000000000',
            businessEmail: `${firm.firmId.toLowerCase()}@system.local`,
            firmId: firm._id,
            isSystemClient: true,
            isInternal: true,
            createdBySystem: true,
            isActive: true,
            status: 'ACTIVE',
            createdByXid: 'SUPERADMIN',
            createdBy: env.SUPERADMIN_EMAIL_NORMALIZED || process.env.SUPERADMIN_EMAIL || 'superadmin@system.local',
          });
          await defaultClient.save({ session });
          console.log(`[BOOTSTRAP_RECOVERY] Created default client: ${clientId}`);
          recoveryActions.push(`Created default client ${clientId}`);
        }
        
        // Link firm to default client
        firm.defaultClientId = defaultClient._id;
        await firm.save({ session });
        console.log(`[BOOTSTRAP_RECOVERY] Linked firm to default client`);
        recoveryActions.push('Linked firm to default client');
      } else {
        defaultClient = await Client.findById(firm.defaultClientId).session(session);
        if (!defaultClient) {
          throw new Error('Firm has defaultClientId reference but client does not exist');
        }
      }
      
      // Check 2: Does firm have at least one admin?
      const adminCount = await User.countDocuments({ 
        firmId: firm._id, 
        role: 'Admin',
        isSystem: true 
      }).session(session);
      
      if (adminCount === 0) {
        console.log(`[BOOTSTRAP_RECOVERY] Missing system admin for firm ${firm.firmId}`);
        throw new Error('Missing system admin - manual intervention required (cannot auto-create without email)');
      }
      
      // Check 3: Do all admins have defaultClientId set?
      const adminsWithoutClient = await User.find({
        firmId: firm._id,
        role: 'Admin',
        $or: [
          { defaultClientId: { $exists: false } },
          { defaultClientId: null }
        ]
      }).session(session);
      
      if (adminsWithoutClient.length > 0) {
        console.log(`[BOOTSTRAP_RECOVERY] Found ${adminsWithoutClient.length} admin(s) without defaultClientId`);
        
        // Optimization: bulk update to link admins to default client
        const adminIds = adminsWithoutClient.map(admin => admin._id);
        await User.updateMany(
          { _id: { $in: adminIds } },
          { $set: { defaultClientId: defaultClient._id } },
          { session }
        );

        // Keep logging and tracking exact actions for backwards compatibility
        for (const admin of adminsWithoutClient) {
          console.log(`[BOOTSTRAP_RECOVERY] Linked admin ${admin.xID} to default client`);
          recoveryActions.push(`Linked admin ${admin.xID} to default client`);
        }
      }
      
      // Mark bootstrap as completed
      firm.bootstrapStatus = 'COMPLETED';
      await firm.save({ session });
      console.log(`[BOOTSTRAP_RECOVERY] Marked firm ${firm.firmId} as COMPLETED`);
      recoveryActions.push('Marked bootstrap as COMPLETED');
      
      // Commit transaction
      await session.commitTransaction();
      session?.endSession();
      
      console.log(`[BOOTSTRAP_RECOVERY] ✓ Recovery successful for firm ${firm.firmId}`);
      
      return {
        success: true,
        message: 'Firm bootstrap recovered successfully',
        firmId: firm.firmId,
        recoveryActions,
      };
      
    } catch (error) {
      if (session?.inTransaction()) {
      await session.abortTransaction();
    }
      session?.endSession();
      throw error;
    }
    
  } catch (error) {
    console.error(`[BOOTSTRAP_RECOVERY] ✗ Recovery failed for firm ${firmId}:`, error.message);
    return {
      success: false,
      message: 'Recovery failed',
      error: error.message,
    };
  }
};

/**
 * Run all bootstrap operations
 * 
 * This function is called on server startup after MongoDB connection.
 * It validates data integrity but does NOT auto-create firms or users.
 * 
 * IMPORTANT CHANGES (This PR):
 * - Does NOT seed System Admin
 * - Does NOT create FIRM001
 * - Empty database is a valid and supported state
 * - Firms are created ONLY by SuperAdmin via POST /api/superadmin/firms
 * 
 * Operations:
 * 1. Preflight checks (validates data consistency for existing firms)
 * 
 * NOTE: SuperAdmin is NOT seeded in MongoDB - it exists ONLY in .env
 * 
 * Bootstrap NEVER crashes the application - all errors are caught and logged.
 */
const runBootstrap = async () => {
  let session = null;

  try {
    session = await mongoose.startSession();
    console.log('BOOTSTRAP_STARTED');
    console.log('🔧 Running system bootstrap...');
    session.startTransaction();

    // Run preflight data validation checks
    // Validates existing firms for integrity violations
    // Does NOT auto-create firms or auto-heal data
    // Supports empty database (no firms) as a valid state
    await runPreflightChecks({ session });
    await seedPlans({ session });

    await session.commitTransaction();

    console.log('BOOTSTRAP_COMPLETED');
    console.log('✓ Bootstrap completed successfully');
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('BOOTSTRAP_FAILED', { message: error.message });
    console.error('✗ Bootstrap failed:', error.message);
    // Don't exit process - let server continue but log the error
    // This allows investigation without blocking startup
    console.error('⚠ Server will continue to run but system may be partially initialized');
  } finally {
    session?.endSession();
  }
};

module.exports = {
  runBootstrap,
  recoverFirmBootstrap,
  runPreflightChecks,
};
