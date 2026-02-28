const mongoose = require('mongoose');
const crypto = require('crypto');
const Plan = require('../../models/Plan.model');
const Firm = require('../../models/Firm.model');
const User = require('../../models/User.model');
const emailService = require('../../services/email.service');
const xIDGenerator = require('../../services/xIDGenerator');
const { slugify } = require('../../utils/slugify');
const { assertFirmPlanCapacity } = require('../../services/user.service');

const SETUP_EXPIRY_HOURS = 48;
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

const createFirmWithAdmin = async (payload = {}) => {
  const { adminName, adminEmail, firmName, planId } = payload;
  if (!adminName || !adminEmail || !firmName || !planId) {
    throw new Error('adminName, adminEmail, firmName and planId are required');
  }

  console.log('[ONBOARDING] createFirmWithAdmin started', { adminEmail, firmName });

  const session = await mongoose.startSession();
  try {
    let result;
    let setupToken;
    await session.withTransaction(async () => {
      const plan = await Plan.findById(planId).session(session);
      if (!plan) {
        const err = new Error('Plan not found');
        err.statusCode = 404;
        throw err;
      }

      const firmSlug = slugify(firmName);
      if (RESERVED_SLUGS.includes(firmSlug)) {
        const err = new Error('Invalid firm name. Please choose a different name.');
        err.statusCode = 400;
        throw err;
      }

      const existingFirm = await Firm.findOne({ firmSlug }).session(session);
      if (existingFirm) {
        const err = new Error('Firm already exists with this name. Please choose a different name.');
        err.statusCode = 409;
        throw err;
      }

      const firm = await Firm.create([{
        firmId: `FIRM${Date.now()}`,
        name: firmName,
        firmSlug,
        status: 'pending_setup',
        planId: plan._id,
      }], { session }).then((docs) => docs[0]);

      setupToken = crypto.randomBytes(32).toString('hex');
      const setupTokenHash = emailService.hashToken(setupToken);
      const setupTokenExpiresAt = new Date(Date.now() + SETUP_EXPIRY_HOURS * 60 * 60 * 1000);

      await assertFirmPlanCapacity({ firmId: firm._id, session });

      const xID = await xIDGenerator.generateNextXID(firm._id, session);
      const user = await User.create([{
        xID,
        name: adminName,
        email: adminEmail.toLowerCase().trim(),
        firmId: firm._id,
        role: 'Admin',
        status: 'invited',
        setupTokenHash,
        setupTokenExpiresAt,
        isActive: false,
      }], { session }).then((docs) => docs[0]);

      result = { firm, admin: user };
    });

    await emailService.sendPasswordSetupEmail({
      email: result.admin.email,
      name: result.admin.name,
      token: setupToken,
      xID: result.admin.xID,
      firmSlug: result.firm.firmSlug,
    });

    console.log('[ONBOARDING] createFirmWithAdmin completed', { firmId: result.firm._id.toString(), adminId: result.admin._id.toString() });
    return result;
  } finally {
    session.endSession();
  }
};

module.exports = {
  createFirmWithAdmin,
  RESERVED_SLUGS,
};
