const mongoose = require('mongoose');
const crypto = require('crypto');
const Plan = require('../../models/Plan.model');
const Firm = require('../../models/Firm.model');
const User = require('../../models/User.model');
const emailService = require('../../services/email.service');
const xIDGenerator = require('../../services/xIDGenerator');
const { slugify } = require('../../utils/slugify');

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
];

const createFirmWithAdmin = async (payload = {}) => {
  const { adminName, adminEmail, firmName, planId } = payload;
  if (!adminName || !adminEmail || !firmName || !planId) {
    throw new Error('adminName, adminEmail, firmName and planId are required');
  }

  const session = await mongoose.startSession();
  try {
    let result;
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

      const setupToken = crypto.randomBytes(32).toString('hex');
      const setupTokenHash = emailService.hashToken(setupToken);
      const setupTokenExpiresAt = new Date(Date.now() + SETUP_EXPIRY_HOURS * 60 * 60 * 1000);

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

      await emailService.sendPasswordSetupEmail({
        email: user.email,
        name: user.name,
        token: setupToken,
        xID: user.xID,
        firmSlug: firm.firmSlug,
      });

      result = { firm, admin: user };
    });
    return result;
  } finally {
    session.endSession();
  }
};

module.exports = {
  createFirmWithAdmin,
  RESERVED_SLUGS,
};
