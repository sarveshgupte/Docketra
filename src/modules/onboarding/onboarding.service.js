const mongoose = require('mongoose');
const Client = require('../../models/Client.model');
const User = require('../../models/User.model');
const emailService = require('../../services/email.service');
const xIDGenerator = require('../../services/xIDGenerator');
const { slugify } = require('../../utils/slugify');
const { assertFirmPlanCapacity } = require('../../services/user.service');
const { generateNextClientId } = require('../../services/clientIdGenerator');
const { generatePasswordSetupToken } = require('../../services/passwordSetupToken.service');
const { safeQueueEmail } = require('../../services/safeSideEffects.service');
const { ensureTenantKey } = require('../../security/encryption.service');
const config = require('../../config/config');

const RESERVED_SLUGS = [
  'superadmin',
  'api',
  'auth',
  'public',
  'pricing',
  'contact',
  'about',
  'security',
  'app',
];

/**
 * Generate a unique URL-safe slug for the organization.
 * Checks existing default-client slugs to ensure uniqueness.
 */
const generateUniqueSlug = async (companyName, session) => {
  const baseSlug = slugify(companyName);
  if (!baseSlug) {
    const err = new Error('Invalid companyName. Please provide a valid company name.');
    err.statusCode = 400;
    throw err;
  }

  if (RESERVED_SLUGS.includes(baseSlug)) {
    const err = new Error('Invalid company name. Please choose a different name.');
    err.statusCode = 409;
    throw err;
  }

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const existing = await Client.findOne({ firmSlug: candidate, isDefaultClient: true }).session(session);
    if (!existing) {
      // Also check legacy Firm slugs for backward compat
      let Firm;
      try { Firm = require('../../models/Firm.model'); } catch (_) { /* no Firm model */ }
      if (Firm) {
        const existingFirm = await Firm.findOne({ firmSlug: candidate }).session(session);
        if (existingFirm) continue;
      }
      return candidate;
    }
  }

  const err = new Error('Unable to generate a unique workspace slug. Please retry.');
  err.statusCode = 409;
  throw err;
};

const createStarterWorkspace = async (payload = {}) => {
  const {
    fullName,
    email,
    phoneNumber,
    companyName,
    connectGoogleDrive = false,
  } = payload;

  if (!fullName || !email || !phoneNumber || !companyName) {
    const err = new Error('fullName, email, phoneNumber and companyName are required');
    err.statusCode = 400;
    throw err;
  }
  if (config.strictByos && !connectGoogleDrive) {
    const err = new Error('Cloud storage must be connected');
    err.statusCode = 400;
    err.code = 'STORAGE_NOT_CONNECTED';
    throw err;
  }

  console.log('[ONBOARDING] createStarterWorkspace started', { email, companyName });

  const session = await mongoose.startSession();
  try {
    let result;
    let setupToken = null;

    await session.withTransaction(async () => {
      const firmSlug = await generateUniqueSlug(companyName, session);
      const normalizedAdminEmail = email.toLowerCase().trim();

      // ── Pre-generate the default-client ObjectId so we can set firmId=self._id ──
      const defaultClientObjectId = new mongoose.Types.ObjectId();

      // Ensure tenant encryption key exists before creating the client
      await ensureTenantKey(String(defaultClientObjectId), { session });

      const clientId = await generateNextClientId(defaultClientObjectId, session);

      const [defaultClient] = await Client.create([{
        _id: defaultClientObjectId,
        clientId,
        firmId: defaultClientObjectId, // self-referencing: default client IS the org root
        businessName: companyName.trim(),
        businessAddress: 'Default Address',
        primaryContactNumber: '0000000000',
        businessEmail: `${firmSlug}@system.local`,
        firmSlug,
        isDefaultClient: true,
        isSystemClient: true,
        isInternal: true,
        createdBySystem: true,
        status: 'ACTIVE',
        isActive: true,
        createdByXid: 'SYSTEM',
        createdBy: 'system',
      }], { session });

      // Plan capacity check uses firmId (default client _id as tenant scope)
      await assertFirmPlanCapacity({ firmId: defaultClient._id, session });

      const existingAdmin = await User.findOne({ firmId: defaultClient._id, email: normalizedAdminEmail }).session(session);
      if (existingAdmin) {
        const err = new Error('Admin email already exists for this organization.');
        err.statusCode = 409;
        throw err;
      }

      const xID = await xIDGenerator.generateNextXID(defaultClient._id, session);
      const [user] = await User.create([{
        xID,
        name: fullName.trim(),
        email: normalizedAdminEmail,
        phoneNumber: phoneNumber.trim(),
        firmId: defaultClient._id,
        defaultClientId: defaultClient._id,
        role: 'PRIMARY_ADMIN',
        primaryAdminId: null,
        status: 'invited',
        mustSetPassword: false,
        mustChangePassword: true,
        isActive: false,
        isPrimaryAdmin: true,
      }], { session });

      setupToken = generatePasswordSetupToken({ userId: user._id.toString(), firmId: defaultClient._id.toString() });

      result = { defaultClient, admin: user };
    });

    await safeQueueEmail({
      operation: 'EMAIL_QUEUE',
      payload: {
        action: 'PASSWORD_SETUP_EMAIL',
        tenantId: result.defaultClient._id.toString(),
        email: result.admin.email,
      },
      execute: async () => emailService.sendPasswordSetupEmail({
        email: result.admin.email,
        name: result.admin.name,
        token: setupToken,
        xID: result.admin.xID,
        firmSlug: result.defaultClient.firmSlug,
        role: result.admin.role,
      }),
    });

    if (connectGoogleDrive) {
      console.info('[ONBOARDING] awaiting_user_storage_connection', {
        firmId: result.defaultClient._id.toString(),
      });
    }

    console.log('[ONBOARDING] createStarterWorkspace completed', {
      clientId: result.defaultClient._id.toString(),
      adminId: result.admin._id.toString(),
    });
    return result;
  } catch (error) {
    if (error?.code === 11000) {
      const conflict = new Error('Organization or admin already exists.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const createFirmWithAdmin = async (payload = {}) => {
  const { adminName, adminEmail, firmName, phoneNumber = 'NA' } = payload;
  return createStarterWorkspace({
    fullName: adminName,
    email: adminEmail,
    phoneNumber,
    companyName: firmName,
  });
};

module.exports = {
  createStarterWorkspace,
  createFirmWithAdmin,
  RESERVED_SLUGS,
};
