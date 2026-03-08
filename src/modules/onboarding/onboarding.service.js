const mongoose = require('mongoose');
const Firm = require('../../models/Firm.model');
const User = require('../../models/User.model');
const emailService = require('../../services/email.service');
const xIDGenerator = require('../../services/xIDGenerator');
const { slugify } = require('../../utils/slugify');
const { assertFirmPlanCapacity } = require('../../services/user.service');
const { ensureDefaultClientForFirm } = require('../../services/defaultClient.service');
const { generatePasswordSetupToken } = require('../../services/passwordSetupToken.service');
const { safeQueueEmail } = require('../../services/safeSideEffects.service');

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

const generateUniqueFirmSlug = async (companyName, session) => {
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
    const existingFirm = await Firm.findOne({ firmSlug: candidate }).session(session);
    if (!existingFirm) {
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
  } = payload;

  if (!fullName || !email || !phoneNumber || !companyName) {
    const err = new Error('fullName, email, phoneNumber and companyName are required');
    err.statusCode = 400;
    throw err;
  }

  console.log('[ONBOARDING] createStarterWorkspace started', { email, companyName });

  const session = await mongoose.startSession();
  try {
    let result;
    let setupToken = null;

    await session.withTransaction(async () => {
      const firmSlug = await generateUniqueFirmSlug(companyName, session);

      const firm = await Firm.create([{
        firmId: `FIRM${Date.now()}`,
        name: companyName.trim(),
        firmSlug,
        status: 'active',
        plan: 'starter',
        maxUsers: 2,
        billingStatus: null,
        bootstrapStatus: 'COMPLETED',
      }], { session }).then((docs) => docs[0]);

      await ensureDefaultClientForFirm(firm, session);

      await assertFirmPlanCapacity({ firmId: firm._id, session });

      const normalizedAdminEmail = email.toLowerCase().trim();
      const existingAdmin = await User.findOne({ firmId: firm._id, email: normalizedAdminEmail }).session(session);
      if (existingAdmin) {
        const err = new Error('Admin email already exists for this firm.');
        err.statusCode = 409;
        throw err;
      }

      const xID = await xIDGenerator.generateNextXID(firm._id, session);
      const inheritedDefaultClientId = (
        firm.defaultClientId
        && mongoose.Types.ObjectId.isValid(firm.defaultClientId)
      ) ? firm.defaultClientId : null;
      const user = await User.create([{
        xID,
        name: fullName.trim(),
        email: normalizedAdminEmail,
        phoneNumber: phoneNumber.trim(),
        firmId: firm._id,
        ...(inheritedDefaultClientId ? { defaultClientId: inheritedDefaultClientId } : {}),
        role: 'Admin',
        status: 'invited',
        mustSetPassword: false,
        mustChangePassword: true,
        isActive: false,
      }], { session }).then((docs) => docs[0]);

      setupToken = generatePasswordSetupToken({ userId: user._id.toString(), firmId: firm._id.toString() });

      result = { firm, admin: user };
    });

    await safeQueueEmail({
      operation: 'EMAIL_QUEUE',
      payload: {
        action: 'PASSWORD_SETUP_EMAIL',
        tenantId: result.firm._id.toString(),
        email: result.admin.email,
      },
      execute: async () => emailService.sendPasswordSetupEmail({
        email: result.admin.email,
        name: result.admin.name,
        token: setupToken,
        xID: result.admin.xID,
        firmSlug: result.firm.firmSlug,
      }),
    });

    console.log('[ONBOARDING] createStarterWorkspace completed', { firmId: result.firm._id.toString(), adminId: result.admin._id.toString() });
    return result;
  } catch (error) {
    if (error?.code === 11000) {
      const conflict = new Error('Firm or admin already exists.');
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
