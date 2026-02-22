const mongoose = require('mongoose');
const crypto = require('crypto');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const TenantKey = require('../security/tenantKey.model');
const { generateEncryptedDek } = require('../security/encryption.service');
const { looksEncrypted } = require('../security/encryption.utils');
const emailService = require('./email.service');
const { generateNextClientId } = require('./clientIdGenerator');
const { generateNextXID } = require('./xIDGenerator');
const { slugify } = require('../utils/slugify');
const { isFirmCreationDisabled } = require('./featureFlags.service');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SYSTEM_EMAIL_DOMAIN = 'system.local';
const SETUP_TOKEN_EXPIRY_HOURS = 48;
const DEFAULT_BUSINESS_ADDRESS = 'Default Address';
const DEFAULT_CONTACT_NUMBER = '0000000000';

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
  TenantKey,
  generateEncryptedDek,
  emailService,
  generateNextClientId,
  generateNextXID,
  startSession: () => mongoose.startSession(),
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
 * @param {Object} params.deps - Dependencies (for testing)
 * @returns {Promise<Object>} Created entities (firm, defaultClient, adminUser)
 */
const createFirmHierarchy = async ({ payload, performedBy, requestId, context = null, deps = defaultDeps }) => {
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

  // Fail fast: validate encryption provider before starting the transaction
  const encryptedDek = await deps.generateEncryptedDek().catch((err) => {
    throw new FirmBootstrapError(`Encryption provider error: ${err.message}`, 500);
  });

  if (!encryptedDek) {
    throw new FirmBootstrapError('Failed to generate encrypted DEK', 500);
  }

  // Validate DEK format: must be iv:authTag:ciphertext (three base64 segments)
  if (!looksEncrypted(encryptedDek)) {
    throw new FirmBootstrapError('Invalid encrypted DEK format', 500);
  }

  const session = await deps.startSession();
  session.startTransaction();

  let createdEntities = null;

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
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING',
    }], { session });

    if (!firm || !firm._id) {
      throw new FirmBootstrapError('Firm creation failed — no _id returned', 500);
    }

    // TODO: replace console logs with structured logger
    console.log('Firm created:', firm?._id);

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
      status: 'ACTIVE',
      createdByXid: 'SUPERADMIN',
      createdBy: process.env.SUPERADMIN_EMAIL || `superadmin@${SYSTEM_EMAIL_DOMAIN}`,
    }], { session });

    firm.defaultClientId = defaultClient._id;
    await firm.save({ session });

    // Race condition safety: check for existing TenantKey even though unique index exists
    const existingKey = await deps.TenantKey.findOne({ tenantId: firm._id.toString() }).session(session);
    if (existingKey) {
      throw new FirmBootstrapError('Tenant key already exists for this firm', 409);
    }

    if (!encryptedDek) {
      throw new FirmBootstrapError('Encryption provider returned invalid DEK', 500);
    }

    try {
      await deps.TenantKey.create([{
        tenantId: firm._id.toString(),
        encryptedDek,
      }], { session });
    } catch (tenantKeyErr) {
      // Handle duplicate key errors from the unique index
      if (tenantKeyErr.code === 11000) {
        throw new FirmBootstrapError('Tenant key already exists for this firm', 409);
      }
      throw tenantKeyErr;
    }

    // TODO: replace console logs with structured logger
    console.log('TenantKey created');

    // IMPORTANT: generateNextXID must use the provided session for transaction safety.
    const adminXID = await deps.generateNextXID(firm._id, session);
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
    const setupExpires = new Date(Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

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
      status: 'INVITED',
      isActive: true,
      isSystem: true,
      passwordSet: false,
      mustSetPassword: false,
      passwordSetAt: null,
      mustChangePassword: true,
      passwordSetupTokenHash: setupTokenHash,
      passwordSetupExpires: setupExpires,
      inviteSentAt: new Date(),
    }], { session });

    firm.bootstrapStatus = 'COMPLETED';
    await firm.save({ session });

    createdEntities = { firm, defaultClient, adminUser, adminXID, setupToken, firmSlug };

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    if (err instanceof FirmBootstrapError) {
      throw err;
    }
    throw new FirmBootstrapError(err.message || 'Failed to create firm', 500);
  } finally {
    await session.endSession();
  }

  if (!createdEntities) {
    throw new FirmBootstrapError('Transaction aborted', 500);
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
