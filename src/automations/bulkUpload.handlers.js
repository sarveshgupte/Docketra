const Case = require('../models/Case.model');
const slaService = require('../services/sla.service');
const Category = require('../models/Category.model');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const { eventBus } = require('../events/eventBus');
const { AUTOMATION_RULES } = require('./rules');
const emailService = require('../services/email.service');
const log = require('../utils/log');
const { getFirmSlaCalendarConfig } = require('../services/firmCalendar.service');

const AUTOMATION_EMAIL_RATE_LIMIT_MS = Number(process.env.AUTOMATION_EMAIL_RATE_LIMIT_MS || 250);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isAutomationsEnabled = () => {
  const value = String(process.env.ENABLE_AUTOMATIONS || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
};

const handleTeamInvite = async ({ user, createdUsers = [] }) => {
  if (!createdUsers.length) return;

  const firm = await Firm.findOne({ firmId: user.firmId }).select('name firmSlug').lean();

  const processInvite = async (createdUser, index) => {
    if (AUTOMATION_EMAIL_RATE_LIMIT_MS > 0 && index > 0) {
      await sleep(index * AUTOMATION_EMAIL_RATE_LIMIT_MS);
    }

    try {
      const freshUser = await User.findOne({
        _id: createdUser._id,
        firmId: user.firmId,
        status: 'invited',
      }).select('email name xID role inviteSentAt').lean();

      if (!freshUser || freshUser.inviteSentAt) {
        return;
      }

      const token = emailService.generateSecureToken();
      const tokenHash = emailService.hashToken(token);
      const tokenExpiry = new Date(Date.now() + (48 * 60 * 60 * 1000));
      const inviteSentAt = new Date();

      const updateResult = await User.updateOne(
        {
          _id: freshUser._id,
          firmId: user.firmId,
          status: 'invited',
          inviteSentAt: null,
        },
        {
          $set: {
            inviteTokenHash: tokenHash,
            inviteTokenExpiry: tokenExpiry,
            setupTokenHash: tokenHash,
            setupTokenExpiresAt: tokenExpiry,
            inviteSentAt,
          },
        },
      );

      if (!updateResult.modifiedCount) {
        return;
      }

      const result = await emailService.sendPasswordSetupEmail({
        email: freshUser.email,
        name: freshUser.name,
        token,
        xID: freshUser.xID,
        firmSlug: firm?.firmSlug || null,
        role: freshUser.role,
        firmName: firm?.name || null,
        invitedBy: user.email || user.xID || 'System',
      });

      if (!result?.success) {
        log.warn('[AUTOMATION] Invite email returned unsuccessful result', {
          firmId: user.firmId,
          email: freshUser.email,
          error: result?.error || 'unknown_error',
        });
      }
    } catch (error) {
      log.error('[AUTOMATION] Failed to process team invite automation', {
        firmId: user.firmId,
        userId: createdUser._id,
        error: error.message,
      });
    }
  };

  // Process all invites in parallel with staggered starts
  // We await all promises to ensure the handler doesn't return before all work is done
  await Promise.all(createdUsers.map((createdUser, index) => processInvite(createdUser, index)));
};

const selectDefaultCategoryAndSubcategory = async (firmId) => {
  const category = await Category.findOne({
    firmId,
    isActive: true,
    subcategories: { $exists: true, $ne: [] },
  }).lean();

  if (!category) return null;

  const activeSubcategory = (category.subcategories || []).find((entry) => entry?.isActive !== false);
  if (!activeSubcategory) return null;

  return {
    category,
    subcategory: activeSubcategory,
  };
};

const handleClientPostCreate = async ({ type, user, createdClients = [] }) => {
  if (type !== 'clients' || !createdClients || !createdClients.length) return;

  const categoryBundle = await selectDefaultCategoryAndSubcategory(user.firmId);
  if (!categoryBundle) {
    log.warn('[AUTOMATION] Skipping default docket creation: no active category/subcategory found', {
      firmId: user.firmId,
    });
    return;
  }

  const { category, subcategory } = categoryBundle;

  // 💡 What: Lifted loop-invariant date calculations and SLA fetches out of the per-client iteration loop.
  // 🎯 Why: Calculating the exact same dueDate based on the category/subcategory for hundreds of clients creates redundant processing and CPU usage.
  const createdAt = new Date();
  const calendarConfig = await getFirmSlaCalendarConfig(user.firmId);
  const fallbackDueDate = slaService.calculateFallbackDueDateFromDays(
    createdAt,
    Math.max(0, Number(subcategory.defaultSlaDays || category.defaultSlaDays || 3)),
    { calendarConfig },
  );

  const sharedDueDate = await slaService.calculateSlaDueDate({
    firmId: user.firmId,
    category: category.name,
    subcategory: subcategory.name,
    workbasketId: subcategory.workbasketId || null,
    createdAt,
  }, { calendarConfig }) || fallbackDueDate;

  const idempotencyKeys = createdClients.map(client => `automation:bulk-upload:default-docket:${user.firmId}:${client.clientId}`);

  // 💡 What: Replaced individual findOne queries inside the loop with a single $in query.
  // 🎯 Why: This prevents N+1 query performance degradation during bulk client uploads by fetching all existing case idempotency keys at once.
  const existingCases = await Case.find({
    firmId: user.firmId,
    idempotencyKey: { $in: idempotencyKeys },
  }).select('idempotencyKey').lean();

  const existingKeysSet = new Set(existingCases.map(c => c.idempotencyKey));
  const newCasesToInsert = [];

  for (const createdClient of createdClients) {
    const idempotencyKey = `automation:bulk-upload:default-docket:${user.firmId}:${createdClient.clientId}`;

    if (existingKeysSet.has(idempotencyKey)) continue;
    existingKeysSet.add(idempotencyKey); // Update cache to prevent duplicates within the same batch

    newCasesToInsert.push({
      title: 'Initial Setup',
      description: 'Auto-created by bulk upload automation',
      categoryId: category._id,
      subcategoryId: String(subcategory.id),
      category: category.name,
      caseCategory: category.name,
      caseSubCategory: subcategory.name,
      subcategory: subcategory.name,
      clientId: createdClient.clientId,
      firmId: user.firmId,
      createdByXID: user.xID || 'SYSTEM',
      createdBy: user.email || user.xID || 'system',
      priority: 'medium',
      status: 'UNASSIGNED',
      lifecycle: 'CREATED',
      queueType: 'GLOBAL',
      slaDueAt: sharedDueDate,
      dueDate: sharedDueDate,
      idempotencyKey,
    });
  }

  if (newCasesToInsert.length > 0) {
    try {
      // 💡 What: Replaced individual sequential save/create operations with bulk insertMany.
      // 🎯 Why: This dramatically reduces network roundtrips from O(N) to O(1) during bulk docket generation, improving DB throughput.
      await Case.insertMany(newCasesToInsert, { ordered: false });
    } catch (error) {
      log.error('[AUTOMATION] Batch insert failed for default dockets', {
        firmId: user.firmId,
        error: error.message,
      });
    }
  }
};

const handleCategorySetup = async ({ user }) => {
  log.info('[AUTOMATION] Category post-import setup placeholder executed', {
    firmId: user?.firmId,
  });
};

const runAutomations = async (type, payload) => {
  const rules = AUTOMATION_RULES[type] || [];

  for (const rule of rules) {
    if (rule === 'SEND_INVITE_EMAIL') {
      await handleTeamInvite(payload);
    }

    if (rule === 'CREATE_DEFAULT_DOCKET') {
      await handleClientPostCreate(payload);
    }

    if (rule === 'PRELOAD_CATEGORY_WORKFLOWS') {
      await handleCategorySetup(payload);
    }
  }
};

eventBus.on('bulkUpload.completed', (payload) => {
  if (!isAutomationsEnabled()) return;

  Promise.resolve()
    .then(() => runAutomations(payload?.type, payload))
    .catch((error) => {
      log.error('[AUTOMATION] Bulk upload automation failed', {
        type: payload?.type,
        firmId: payload?.user?.firmId,
        error: error.message,
      });
    });
});

module.exports = {
  runAutomations,
  handleTeamInvite,
  handleClientPostCreate,
  handleCategorySetup,
};
