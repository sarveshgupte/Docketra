const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const { ensureTenantKey } = require('../security/encryption.service');
const emailService = require('./email.service');
const { generateNextClientId } = require('./clientIdGenerator');
const { generateNextXID } = require('./xIDGenerator');
const { slugify } = require('../utils/slugify');
const { isFirmCreationDisabled } = require('./featureFlags.service');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SYSTEM_EMAIL_DOMAIN = 'system.local';
const DEFAULT_BUSINESS_ADDRESS = 'Default Address';
const DEFAULT_CONTACT_NUMBER = '0000000000';
const PASSWORD_SETUP_TOKEN_EXPIRY = '24h';

class FirmBootstrapError extends Error {
  constructor(message, statusCode = 500, meta = {}) {
    super(message);
    this.name = 'FirmBootstrapError';
    this.statusCode = statusCode;
    this.meta = meta;
  }
}

const defaultDeps = {
  Firm,
  Client,
  User,
  ensureTenantKey,
  emailService,
  generateNextClientId,
  generateNextXID,
};

const validatePayload = ({ name, adminName, adminEmail }) => {
  if (!name || !name.trim()) {
    throw new FirmBootstrapError('Firm name is required', 400);
  }
  if (!adminName || !adminName.trim()) {
    throw new FirmBootstrapError('Admin name is required', 400);
  }
  if (!adminEmail || !adminEmail.trim()) {
    throw new FirmBootstrapError('Admin email is required', 400);
  }
  if (!EMAIL_REGEX.test(adminEmail)) {
    throw new FirmBootstrapError('Invalid admin email format', 400);
  }
};

const ensureNotDuplicate = async ({ deps, name, firmSlug, session }) => {
  // IMPORTANT: This function must use the provided session for transaction safety.
  const existingFirm = await deps.Firm.findOne({
    $or: [{ firmSlug }, { name: name.trim() }],
  }).session(session);
  if (existingFirm) {
    throw new FirmBootstrapError('Firm already exists', 200, { firm: existingFirm, idempotent: true });
  }
};

const buildIds = async (deps, session, name) => {
  // IMPORTANT: This function must use the provided session for transaction safety.
  const lastFirm = await deps.Firm.findOne({}, {}, { session }).sort({ createdAt: -1 });
  let firmNumber = 1;
  if (lastFirm && lastFirm.firmId) {
    const match = lastFirm.firmId.match(/FIRM(\d+)/);
    if (match) {
      firmNumber = parseInt(match[1], 10) + 1;
    }
  }
  let firmSlug = slugify(name.trim());
  const originalSlug = firmSlug;
  const existingSlugs = await deps.Firm.find({
    firmSlug: { $regex: new RegExp(`^${originalSlug}(?:-\\d+)?$`) },
  }).session(session).select('firmSlug');
  if (existingSlugs.length > 0) {
    const maxSuffix = existingSlugs.reduce((max, doc) => {
      const match = doc.firmSlug.match(/-(\d+)$/);
      const suffixNumber = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, suffixNumber);
    }, 0);
    firmSlug = `${originalSlug}-${maxSuffix + 1}`;
  }
  return { firmId: `FIRM${firmNumber.toString().padStart(3, '0')}`, firmSlug };
};

/**
 * Create a complete firm hierarchy with transactional guarantees
 * @param {Object} params - Creation parameters
 * @param {Object} params.payload - Firm creation data (name, adminName, adminEmail)
 * @param {Object} params.performedBy - User performing the action
 * @param {string} params.requestId - Request ID for tracking
 * @param {Object} [params.context] - Request context for side-effect queueing (optional):
 *   - requestId: string (for logging)
 *   - _pendingSideEffects: Array (required for email queueing)
 *   - transactionActive: boolean (optional, default false)
 *   - transactionCommitted: boolean (optional, default false)
 *   If null, emails will be enqueued immediately without waiting for transaction commit
 * @param {Object} [params.session] - MongoDB session injected by the controller (via executeWrite)
 * @param {Object} params.deps - Dependencies (for testing)
 * @returns {Promise<Object>} Created entities (firm, defaultClient, adminUser)
 */
const createFirmHierarchy = async ({ payload, performedBy, requestId, context = null, session, deps = defaultDeps }) => {
  console.log('createFirmHierarchy invoked', requestId);
  if (isFirmCreationDisabled()) {
    throw new FirmBootstrapError('Firm creation is temporarily disabled', 503);
  }

  validatePayload(payload);

  // Warn if MongoDB topology may not support transactions (item 4: safe wrapper)
  try {
    const topologyType = mongoose.connection.client?.topology?.description?.type;
    if (topologyType && !topologyType.includes('ReplicaSet')) {
      console.warn('[FIRM_BOOTSTRAP] MongoDB is not a replica set. Transactions may not work.');
    }
  } catch (_topologyErr) {
    // Never block firm creation due to topology detection failure
  }

  // session is injected by the controller via executeWrite / wrapWriteHandler.
  // No session lifecycle management here — that is owned by executeWrite.

  let createdEntities;

  try {
    // CRITICAL: All DB operations below must use the same Mongo session.
    // Any missing session usage will break atomicity guarantees.
    const { name, adminName, adminEmail } = payload;
    const normalizedName = name.trim();
    const { firmId, firmSlug } = await buildIds(deps, session, normalizedName);
    await ensureNotDuplicate({ deps, name: normalizedName, firmSlug, session });

    const [firm] = await deps.Firm.create([{
      firmId,
      name: normalizedName,
      firmSlug,
      status: 'active',
      bootstrapStatus: 'PENDING',
    }], { session });

    if (!firm || !firm._id) {
      throw new FirmBootstrapError('Firm creation failed - no _id returned', 500);
    }

    // TODO: replace console logs with structured logger
    console.log('Firm created:', firm?._id);

    await deps.ensureTenantKey(String(firm._id), { session });

    // TODO: replace console logs with structured logger
    console.log('TenantKey ensured');

    // IMPORTANT: generateNextClientId must use the provided session for transaction safety.
    const clientId = await deps.generateNextClientId(firm._id, session);
    const [defaultClient] = await deps.Client.create([{
      clientId,
      businessName: normalizedName,
      businessAddress: DEFAULT_BUSINESS_ADDRESS,
      primaryContactNumber: DEFAULT_CONTACT_NUMBER,
      businessEmail: `${firmId.toLowerCase()}@${SYSTEM_EMAIL_DOMAIN}`,
      firmId: firm._id,
      isSystemClient: true,
      isInternal: true,
      createdBySystem: true,
      isActive: true,
      status: 'active',
      createdByXid: 'SUPERADMIN',
      createdBy: process.env.SUPERADMIN_EMAIL || `superadmin@${SYSTEM_EMAIL_DOMAIN}`,
    }], { session });

    firm.defaultClientId = defaultClient._id;
    await firm.save({ session });

    // IMPORTANT: generateNextXID must use the provided session for transaction safety.
    const adminXID = await deps.generateNextXID(firm._id, session);
    const passwordSetupSecret = process.env.JWT_PASSWORD_SETUP_SECRET;
    if (!passwordSetupSecret) {
      throw new FirmBootstrapError('JWT_PASSWORD_SETUP_SECRET environment variable is not configured', 500);
    }

    const [adminUser] = await deps.User.create([{
      xID: adminXID,
      name: adminName.trim(),
      email: adminEmail.trim().toLowerCase(),
      firmId: firm._id,
      defaultClientId: defaultClient._id,
      role: 'Admin',
      // Admin onboarding state: INVITED (equivalent to PENDING_SETUP)
      // User cannot login until they set password via email link
      // Status will transition to ACTIVE after password is set
      status: 'invited',
      isActive: false,
      isSystem: true,
      isPrimaryAdmin: true,
      passwordSet: false,
      mustSetPassword: false,
      passwordSetAt: null,
      mustChangePassword: true,
      inviteSentAt: new Date(),
    }], { session });

    const setupToken = jwt.sign(
      {
        userId: adminUser._id,
        firmId: firm._id,
        type: 'PASSWORD_SETUP',
      },
      passwordSetupSecret,
      { expiresIn: PASSWORD_SETUP_TOKEN_EXPIRY }
    );

    firm.bootstrapStatus = 'COMPLETED';
    await firm.save({ session });

    // Transaction commit is handled by executeWrite / withTransaction.
    createdEntities = { firm, defaultClient, adminUser, adminXID, setupToken, firmSlug };
  } catch (err) {
    if (err instanceof FirmBootstrapError) {
      throw err;
    }
    throw new FirmBootstrapError(err.message || 'Failed to create firm', 500);
  }

  const { firm, defaultClient, adminUser, adminXID, setupToken, firmSlug } = createdEntities;

  try {
    const superadminEmail = process.env.SUPERADMIN_EMAIL;
    if (superadminEmail) {
      await deps.emailService.sendFirmCreatedEmail(superadminEmail, {
        firmId: firm.firmId,
        firmName: firm.name,
        defaultClientId: defaultClient.clientId,
        adminXID,
        adminEmail: adminUser.email,
      }, context);
    }
  } catch (emailError) {
    console.error('[FIRM_BOOTSTRAP] Failed to send firm created email:', emailError.message);
  }

  try {
    console.log(`[FIRM_BOOTSTRAP] Sending password setup email to ${adminUser.email} (xID: ${adminXID})`);
    const emailResult = await deps.emailService.sendPasswordSetupEmail({
      email: adminUser.email,
      name: adminUser.name,
      token: setupToken,
      xID: adminXID,
      firmSlug,
      context,
    });
    if (!emailResult.success) {
      console.warn('[FIRM_BOOTSTRAP] Password setup email not sent:', emailResult.error);
    } else {
      console.log('[FIRM_BOOTSTRAP] Password setup email queued successfully');
    }
  } catch (emailError) {
    console.warn('[FIRM_BOOTSTRAP] Failed to send admin invite email:', emailError.message);
    // Email issues are logged but don't block firm creation - admin can be invited manually if needed
  }

  return {
    firm,
    defaultClient,
    adminUser,
    requestId,
  };
};

module.exports = {
  FirmBootstrapError,
  createFirmHierarchy,
  defaultDeps,
};
