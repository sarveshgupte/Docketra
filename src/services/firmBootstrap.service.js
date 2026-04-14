const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const { ensureTenantKey } = require('../security/encryption.service');
const emailService = require('./email.service');
const { generateNextClientId } = require('./clientIdGenerator');
const { generateNextXID } = require('./xIDGenerator');
const { slugify } = require('../utils/slugify');
const { isFirmCreationDisabled } = require('./featureFlags.service');
const { loadEnv } = require('../config/env');
const { coercePrimaryAdminCreationFields } = require('../utils/hierarchy.utils');
const { setupDefaultFirm } = require('./firmSetup.service');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SYSTEM_EMAIL_DOMAIN = 'system.local';
const DEFAULT_BUSINESS_ADDRESS = 'Default Address';
const DEFAULT_CONTACT_NUMBER = '0000000000';
const PASSWORD_SETUP_TOKEN_EXPIRY = '24h';
const env = loadEnv({ exitOnError: false }) || {};

class FirmBootstrapError extends Error {
  constructor(message, statusCode = 500, meta = {}) {
    super(message);
    this.name = 'FirmBootstrapError';
    this.statusCode = statusCode;
    this.meta = meta;
  }
}

const defaultDeps = {
  // Keep Firm in deps for backward compat with tests that mock it
  get Firm() {
    try { return require('../models/Firm.model'); } catch (_) { return null; }
  },
  Client,
  User,
  ensureTenantKey,
  emailService,
  generateNextClientId,
  generateNextXID,
};

const validatePayload = ({ name, adminName, adminEmail }) => {
  if (!name || !name.trim()) {
    throw new FirmBootstrapError('Organization name is required', 400);
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
  // Check by slug on default clients (new arch) and legacy Firms
  const existingClient = await deps.Client.findOne({
    $or: [{ firmSlug }, { businessName: name.trim() }],
    isDefaultClient: true,
  }).session(session);
  if (existingClient) {
    throw new FirmBootstrapError('Organization already exists', 200, { idempotent: true });
  }
  // Legacy Firm check for backward compat
  if (deps.Firm) {
    const existingFirm = await deps.Firm.findOne({
      $or: [{ firmSlug }, { name: name.trim() }],
    }).session(session);
    if (existingFirm) {
      throw new FirmBootstrapError('Organization already exists', 200, { firm: existingFirm, idempotent: true });
    }
  }
};

const buildSlug = async (deps, session, name) => {
  let firmSlug = slugify(name.trim());
  const originalSlug = firmSlug;

  // Check existing default-client slugs
  const existingSlugs = await deps.Client.find({
    firmSlug: { $regex: new RegExp(`^${originalSlug}(?:-\\d+)?$`) },
    isDefaultClient: true,
  }).session(session).select('firmSlug').lean();

  if (existingSlugs.length > 0) {
    const maxSuffix = existingSlugs.reduce((max, doc) => {
      const match = doc.firmSlug.match(/-(\d+)$/);
      const suffixNumber = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, suffixNumber);
    }, 0);
    firmSlug = `${originalSlug}-${maxSuffix + 1}`;
  }
  return firmSlug;
};

/**
 * Create a complete organization hierarchy with transactional guarantees.
 *
 * In the new client-centric architecture the "organization" is represented by
 * a default Client (isDefaultClient=true).  No separate Firm document is
 * created.  The defaultClient._id is used as the tenant scope (firmId) for
 * all related documents.
 *
 * @param {Object} params - Creation parameters
 * @param {Object} params.payload - Organization creation data (name, adminName, adminEmail)
 * @param {Object} params.performedBy - User performing the action
 * @param {string} params.requestId - Request ID for tracking
 * @param {Object} [params.context] - Request context for side-effect queueing
 * @param {Object} [params.session] - MongoDB session injected by the controller
 * @param {Object} params.deps - Dependencies (for testing)
 * @returns {Promise<Object>} Created entities (defaultClient, adminUser)
 */
const createFirmHierarchy = async ({ payload, performedBy, requestId, context = null, session, deps = defaultDeps }) => {
  console.log('createFirmHierarchy invoked', requestId);
  if (isFirmCreationDisabled()) {
    throw new FirmBootstrapError('Organization creation is temporarily disabled', 503);
  }

  validatePayload(payload);

  // Warn if MongoDB topology may not support transactions
  try {
    const topologyType = mongoose.connection.client?.topology?.description?.type;
    if (topologyType && !topologyType.includes('ReplicaSet')) {
      console.warn('[BOOTSTRAP] MongoDB is not a replica set. Transactions may not work.');
    }
  } catch (_topologyErr) {
    // Never block creation due to topology detection failure
  }

  let createdEntities;

  try {
    const { name, adminName, adminEmail } = payload;
    const normalizedName = name.trim();
    const firmSlug = await buildSlug(deps, session, normalizedName);
    await ensureNotDuplicate({ deps, name: normalizedName, firmSlug, session });

    // Pre-generate the default-client ObjectId so firmId can equal self._id
    const defaultClientObjectId = new mongoose.Types.ObjectId();
    await deps.ensureTenantKey(String(defaultClientObjectId), { session });

    const clientId = await deps.generateNextClientId(defaultClientObjectId, session);
    const [defaultClient] = await deps.Client.create([{
      _id: defaultClientObjectId,
      clientId,
      businessName: normalizedName,
      businessAddress: DEFAULT_BUSINESS_ADDRESS,
      primaryContactNumber: DEFAULT_CONTACT_NUMBER,
      businessEmail: `${firmSlug}@${SYSTEM_EMAIL_DOMAIN}`,
      firmId: defaultClientObjectId, // self-referencing
      firmSlug,
      isDefaultClient: true,
      isSystemClient: true,
      isInternal: true,
      createdBySystem: true,
      isActive: true,
      status: 'ACTIVE',
      createdByXid: 'SUPERADMIN',
      createdBy: env.SUPERADMIN_EMAIL_NORMALIZED,
    }], { session });

    if (!defaultClient || !defaultClient._id) {
      throw new FirmBootstrapError('Default client creation failed - no _id returned', 500);
    }

    console.log('Default client created:', defaultClient._id);

    const adminXID = await deps.generateNextXID(defaultClient._id, session);
    const passwordSetupSecret = process.env.JWT_PASSWORD_SETUP_SECRET;
    if (!passwordSetupSecret) {
      throw new FirmBootstrapError('JWT_PASSWORD_SETUP_SECRET environment variable is not configured', 500);
    }

    const [adminUser] = await deps.User.create([{
      xID: adminXID,
      name: adminName.trim(),
      email: adminEmail.trim().toLowerCase(),
      firmId: defaultClient._id,
      defaultClientId: defaultClient._id,
      ...coercePrimaryAdminCreationFields({ role: 'PRIMARY_ADMIN' }),
      status: 'invited',
      isActive: false,
      isSystem: true,
      passwordSet: false,
      mustSetPassword: false,
      passwordSetAt: null,
      mustChangePassword: true,
      inviteSentAt: new Date(),
    }], { session });

    await setupDefaultFirm(defaultClient._id, adminUser, { session });

    const setupToken = jwt.sign(
      {
        userId: adminUser._id,
        firmId: defaultClient._id,
        type: 'PASSWORD_SETUP',
      },
      passwordSetupSecret,
      { expiresIn: PASSWORD_SETUP_TOKEN_EXPIRY }
    );

    createdEntities = { defaultClient, adminUser, adminXID, setupToken, firmSlug };
  } catch (err) {
    if (err instanceof FirmBootstrapError) {
      throw err;
    }
    throw new FirmBootstrapError(err.message || 'Failed to create organization', 500);
  }

  const { defaultClient, adminUser, adminXID, setupToken, firmSlug } = createdEntities;

  try {
    const superadminEmail = env.SUPERADMIN_EMAIL_NORMALIZED;
    if (superadminEmail) {
      await deps.emailService.sendFirmCreatedEmail(superadminEmail, {
        firmId: defaultClient.clientId,
        firmName: defaultClient.businessName,
        defaultClientId: defaultClient.clientId,
        adminXID,
        adminEmail: adminUser.email,
      }, context);
    }
  } catch (emailError) {
    console.error('[BOOTSTRAP] Failed to send organization created email:', emailError.message);
  }

  try {
    console.log(`[BOOTSTRAP] Sending password setup email to ${adminUser.email} (xID: ${adminXID})`);
    const emailResult = await deps.emailService.sendPasswordSetupEmail({
      email: adminUser.email,
      name: adminUser.name,
      token: setupToken,
      xID: adminXID,
      firmSlug,
      role: adminUser.role,
      context,
    });
    if (!emailResult.success) {
      console.warn('[BOOTSTRAP] Password setup email not sent:', emailResult.error);
    } else {
      console.log('[BOOTSTRAP] Password setup email queued successfully');
    }
  } catch (emailError) {
    console.warn('[BOOTSTRAP] Failed to send admin invite email:', emailError.message);
  }

  return {
    // Keep firm for backward compat with callers that destructure { firm }
    firm: defaultClient,
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
