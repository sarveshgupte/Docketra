const mongoose = require('mongoose');
const Category = require('../models/Category.model');
const Team = require('../models/Team.model');
const FirmSetupTemplate = require('../models/FirmSetupTemplate.model');
const Firm = require('../models/Firm.model');
const { logAuthEvent } = require('./audit.service');
const log = require('../utils/log');

const DEFAULT_FIRM_SETUP_TEMPLATE_KEY = 'SYSTEM_DEFAULT';

const SYSTEM_DEFAULT_TEMPLATE = {
  key: DEFAULT_FIRM_SETUP_TEMPLATE_KEY,
  name: 'Default Firm Setup',
  workbaskets: [
    { name: 'Corporate Law & ROC', type: 'PRIMARY' },
    { name: 'Taxation & Audit', type: 'PRIMARY' },
    { name: 'Corporate Compliance & SEBI', type: 'PRIMARY' },
    { name: 'HR', type: 'PRIMARY' },
    { name: 'Finance', type: 'PRIMARY' },
    { name: 'Accounts', type: 'PRIMARY' },
    { name: 'Operations', type: 'PRIMARY' },
  ],
  categories: [
    {
      name: 'Companies Act & ROC',
      subcategories: [
        { name: 'Annual ROC Filing (AOC-4 / MGT-7)', workbasket: 'Corporate Law & ROC', employeeContextEnabled: false },
        { name: 'Director KYC & DIN (DIR-3 KYC)', workbasket: 'Corporate Law & ROC', employeeContextEnabled: false },
        { name: 'Secretarial Audit & Resolutions', workbasket: 'Corporate Law & ROC', employeeContextEnabled: false },
        { name: 'Company Incorporation & Filings', workbasket: 'Corporate Law & ROC', employeeContextEnabled: false },
      ],
    },
    {
      name: 'SEBI & Capital Markets',
      subcategories: [
        { name: 'LODR Disclosures (Reg 30 / Reg 33)', workbasket: 'Corporate Compliance & SEBI', employeeContextEnabled: false },
        { name: 'PIT & Structured Digital Database (SDD)', workbasket: 'Corporate Compliance & SEBI', employeeContextEnabled: false },
        { name: 'Secretarial Compliance Report (ASCR)', workbasket: 'Corporate Compliance & SEBI', employeeContextEnabled: false },
      ],
    },
    {
      name: 'GST & Indirect Tax',
      subcategories: [
        { name: 'Monthly GSTR-1 & GSTR-3B', workbasket: 'Taxation & Audit', employeeContextEnabled: false },
        { name: 'Annual GSTR-9 / 9C Reconciliation', workbasket: 'Taxation & Audit', employeeContextEnabled: false },
        { name: 'GST Notice & Audit Response', workbasket: 'Taxation & Audit', employeeContextEnabled: false },
      ],
    },
    {
      name: 'Income Tax & Audit',
      subcategories: [
        { name: 'Tax Audit Form 3CD (44 Clauses)', workbasket: 'Taxation & Audit', employeeContextEnabled: false },
        { name: 'TDS / TCS Quarterly Filing (24Q/26Q)', workbasket: 'Taxation & Audit', employeeContextEnabled: false },
        { name: 'Advance Tax & Annual ITR', workbasket: 'Taxation & Audit', employeeContextEnabled: false },
      ],
    },
    {
      name: 'FEMA & RBI',
      subcategories: [
        { name: 'FDI / FC-GPR & FC-TRS Filings', workbasket: 'Corporate Compliance & SEBI', employeeContextEnabled: false },
        { name: 'Foreign Liabilities & Assets (FLA Return)', workbasket: 'Corporate Compliance & SEBI', employeeContextEnabled: false },
        { name: 'ECB & Overseas Direct Investment', workbasket: 'Corporate Compliance & SEBI', employeeContextEnabled: false },
      ],
    },
    {
      name: 'HR',
      subcategories: [
        { name: 'Employee Query', workbasket: 'HR', employeeContextEnabled: true },
        { name: 'Policy & Planning', workbasket: 'HR', employeeContextEnabled: true },
      ],
    },
    {
      name: 'Finance',
      subcategories: [
        { name: 'Finance Review', workbasket: 'Finance', employeeContextEnabled: false },
      ],
    },
    {
      name: 'Accounts',
      subcategories: [
        { name: 'Accounts Task', workbasket: 'Accounts', employeeContextEnabled: false },
      ],
    },
    {
      name: 'Operations',
      subcategories: [
        { name: 'Operations Task', workbasket: 'Operations', employeeContextEnabled: false },
      ],
    },
  ],
};

const mapSubcategoriesToWorkbaskets = (template = SYSTEM_DEFAULT_TEMPLATE) => {
  return template.categories.reduce((acc, category) => {
    for (const subcategory of category.subcategories || []) {
      acc[subcategory.name] = subcategory.workbasket;
    }
    return acc;
  }, {});
};

const normalizeTemplate = (template = SYSTEM_DEFAULT_TEMPLATE) => {
  const normalized = template && typeof template === 'object' ? template : SYSTEM_DEFAULT_TEMPLATE;
  return {
    key: String(normalized.key || DEFAULT_FIRM_SETUP_TEMPLATE_KEY).trim(),
    name: String(normalized.name || 'Default Firm Setup').trim(),
    workbaskets: (normalized.workbaskets || []).map((workbasket) => ({
      name: String(workbasket.name || '').trim(),
      type: String(workbasket.type || 'PRIMARY').trim().toUpperCase() || 'PRIMARY',
    })).filter((workbasket) => workbasket.name),
    categories: (normalized.categories || []).map((category) => ({
      name: String(category.name || '').trim(),
      subcategories: (category.subcategories || []).map((subcategory) => ({
        name: String(subcategory.name || '').trim(),
        workbasket: String(subcategory.workbasket || '').trim(),
        employeeContextEnabled: subcategory.employeeContextEnabled === true,
      })).filter((subcategory) => subcategory.name && subcategory.workbasket),
    })).filter((category) => category.name),
  };
};

const getFirmSetupTemplate = async (key = DEFAULT_FIRM_SETUP_TEMPLATE_KEY, { session } = {}) => {
  const normalizedKey = String(key || DEFAULT_FIRM_SETUP_TEMPLATE_KEY).trim();
  const templateDoc = await FirmSetupTemplate.findOne({ key: normalizedKey, isActive: true })
    .session(session || null)
    .lean();

  if (!templateDoc) return normalizeTemplate(SYSTEM_DEFAULT_TEMPLATE);
  return normalizeTemplate(templateDoc.template || SYSTEM_DEFAULT_TEMPLATE);
};

const upsertFirmSetupTemplate = async ({
  key = DEFAULT_FIRM_SETUP_TEMPLATE_KEY,
  template,
  performedBy = null,
  session,
} = {}) => {
  const normalizedKey = String(key || DEFAULT_FIRM_SETUP_TEMPLATE_KEY).trim();
  const normalizedTemplate = normalizeTemplate(template || SYSTEM_DEFAULT_TEMPLATE);

  return FirmSetupTemplate.findOneAndUpdate(
    { key: normalizedKey },
    {
      $set: {
        key: normalizedKey,
        name: normalizedTemplate.name,
        template: normalizedTemplate,
        isActive: true,
        updatedBy: performedBy,
      },
      $setOnInsert: {
        createdBy: performedBy,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, session: session || undefined },
  );
};

const createDefaultWorkbaskets = async (firmId, adminUserId, { session, template = SYSTEM_DEFAULT_TEMPLATE } = {}) => {
  if (!firmId) return new Map();

  const normalizedTemplate = normalizeTemplate(template);
  const workbasketMap = new Map();

  for (const workbasket of normalizedTemplate.workbaskets) {
    const resolvedType = workbasket.type === 'QC' ? 'QC' : 'PRIMARY';
    const resolved = await Team.findOneAndUpdate(
      { firmId, name: workbasket.name },
      {
        $set: {
          isActive: true,
          managerId: adminUserId || null,
          type: resolvedType,
        },
        $setOnInsert: {
          firmId,
          parentWorkbasketId: null,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session: session || undefined,
      },
    );

    workbasketMap.set(workbasket.name, resolved);
  }

  return workbasketMap;
};

const createDefaultCategories = async (firmId, { session, workbasketMap, template = SYSTEM_DEFAULT_TEMPLATE } = {}) => {
  if (!firmId) return [];

  const normalizedTemplate = normalizeTemplate(template);
  const categories = [];

  for (const categoryTemplate of normalizedTemplate.categories) {
    let category = await Category.findOne({ firmId, name: categoryTemplate.name }).session(session || null);

    if (!category) {
      category = new Category({
        firmId,
        name: categoryTemplate.name,
        isActive: true,
        subcategories: [],
      });
    }

    category.isActive = true;

    const existingNameSet = new Set((category.subcategories || []).map((subcategory) => String(subcategory.name || '').trim().toLowerCase()));

    for (const subcategoryTemplate of categoryTemplate.subcategories) {
      const lookupKey = String(subcategoryTemplate.name || '').trim().toLowerCase();
      const mappedWorkbasket = workbasketMap.get(subcategoryTemplate.workbasket);
      if (!mappedWorkbasket?._id || existingNameSet.has(lookupKey)) {
        if (existingNameSet.has(lookupKey)) {
          const existing = category.subcategories.find((entry) => String(entry.name || '').trim().toLowerCase() === lookupKey);
          if (existing) {
            existing.isActive = true;
            existing.workbasketId = existing.workbasketId || mappedWorkbasket?._id || null;
            if (typeof existing.employeeContextEnabled === 'undefined') existing.employeeContextEnabled = subcategoryTemplate.employeeContextEnabled === true;
          }
        }
        continue;
      }

      category.subcategories.push({
        id: new mongoose.Types.ObjectId().toString(),
        name: subcategoryTemplate.name,
        workbasketId: mappedWorkbasket._id,
        employeeContextEnabled: subcategoryTemplate.employeeContextEnabled === true,
        isActive: true,
      });
      existingNameSet.add(lookupKey);
    }

    await category.save({ session: session || undefined });
    categories.push(category);
  }

  return categories;
};

const runSetup = async ({ firmId, primaryAdminUser, session, template }) => {
  const adminUserId = primaryAdminUser?._id || primaryAdminUser || null;
  const workbasketMap = await createDefaultWorkbaskets(firmId, adminUserId, { session, template });
  const categories = await createDefaultCategories(firmId, { session, workbasketMap, template });
  return { workbasketMap, categories };
};

const setupDefaultFirm = async (firmId, primaryAdminUser, {
  session,
  force = false,
  templateKey = DEFAULT_FIRM_SETUP_TEMPLATE_KEY,
  template,
} = {}) => {
  if (!firmId) return { skipped: true, reason: 'MISSING_FIRM_ID' };

  if (!mongoose.Types.ObjectId.isValid(firmId)) {
    return { skipped: true, reason: 'INVALID_FIRM_ID' };
  }

  const actorXid = primaryAdminUser?.xID || primaryAdminUser?.xid || 'SYSTEM';

  const execute = async (activeSession) => {
    const [categoryCount, workbasketCount, firm] = await Promise.all([
      Category.countDocuments({ firmId }).session(activeSession),
      Team.countDocuments({ firmId, parentWorkbasketId: null }).session(activeSession),
      Firm.findById(firmId).session(activeSession),
    ]);

    log.info('[FIRM_SETUP] setup started', {
      firmId: String(firmId),
      categoryCount,
      workbasketCount,
      force,
    });

    if (!force && categoryCount > 0 && workbasketCount > 0) {
      const skipReason = 'FIRM_ALREADY_CONFIGURED';
      log.info('[FIRM_SETUP] setup skipped', {
        firmId: String(firmId),
        reason: skipReason,
        categoryCount,
        workbasketCount,
      });
      return {
        skipped: true,
        reason: skipReason,
        categoryCount,
        workbasketCount,
      };
    }

    const resolvedTemplate = normalizeTemplate(template || await getFirmSetupTemplate(templateKey, { session: activeSession }));

    try {
      const result = await runSetup({ firmId, primaryAdminUser, session: activeSession, template: resolvedTemplate });

      if (firm) {
        firm.isSetupComplete = true;
        firm.setupMetadata = {
          categories: result.categories.length,
          workbaskets: result.workbasketMap.size,
          templateKey: resolvedTemplate.key,
          completedAt: new Date(),
        };
        await firm.save({ session: activeSession || undefined });
      }

      await logAuthEvent({
        eventType: 'FIRM_SETUP_COMPLETED',
        firmId: String(firmId),
        xID: actorXid,
        performedBy: actorXid,
        description: 'Firm initialized with default setup',
        metadata: {
          categoriesCreated: result.categories.length,
          workbasketsCreated: result.workbasketMap.size,
          templateKey: resolvedTemplate.key,
        },
        session: activeSession || null,
      }).catch(() => null);

      log.info('[FIRM_SETUP] setup completed', {
        firmId: String(firmId),
        categoriesCreated: result.categories.length,
        workbasketsCreated: result.workbasketMap.size,
        templateKey: resolvedTemplate.key,
      });

      return {
        skipped: false,
        categoryCountBefore: categoryCount,
        workbasketCountBefore: workbasketCount,
        categoriesCreatedOrUpdated: result.categories.length,
        workbasketsCreatedOrUpdated: result.workbasketMap.size,
        mapping: mapSubcategoriesToWorkbaskets(resolvedTemplate),
        templateKey: resolvedTemplate.key,
      };
    } catch (error) {
      log.info('[FIRM_SETUP] setup failed', {
        firmId: String(firmId),
        reason: error.message,
        categoryCount,
        workbasketCount,
      });
      throw error;
    }
  };

  if (session) {
    return execute(session);
  }

  const localSession = await mongoose.startSession();
  try {
    let output = null;
    await localSession.withTransaction(async () => {
      output = await execute(localSession);
    });
    return output;
  } finally {
    await localSession.endSession();
  }
};

const cloneFirmSetupFromFirm = async ({ sourceFirmId, targetFirmId, adminUserId, session } = {}) => {
  if (!sourceFirmId || !targetFirmId) {
    return { skipped: true, reason: 'MISSING_SOURCE_OR_TARGET' };
  }

  const sourceWorkbaskets = await Team.find({ firmId: sourceFirmId, parentWorkbasketId: null, isActive: true })
    .select('name type')
    .session(session || null)
    .lean();

  const workbasketLookup = new Map(sourceWorkbaskets.map((workbasket) => [String(workbasket._id), workbasket.name]));

  const sourceCategories = await Category.find({ firmId: sourceFirmId, isActive: true })
    .select('name subcategories')
    .session(session || null)
    .lean();

  const template = {
    key: `CLONED_${String(sourceFirmId)}`,
    name: 'Cloned Firm Setup',
    workbaskets: sourceWorkbaskets.map((workbasket) => ({
      name: workbasket.name,
      type: workbasket.type || 'PRIMARY',
    })),
    categories: sourceCategories.map((category) => ({
      name: category.name,
      subcategories: (category.subcategories || [])
        .filter((subcategory) => subcategory.isActive)
        .map((subcategory) => ({
          name: subcategory.name,
          workbasket: workbasketLookup.get(String(subcategory.workbasketId)) || 'General',
        })),
    })),
  };

  return setupDefaultFirm(targetFirmId, adminUserId, { session, force: true, template });
};

const resetFirmSetupToDefaults = async ({ firmId, adminUserId, session } = {}) => {
  return setupDefaultFirm(firmId, adminUserId, {
    session,
    force: true,
    templateKey: DEFAULT_FIRM_SETUP_TEMPLATE_KEY,
  });
};

module.exports = {
  DEFAULT_FIRM_SETUP_TEMPLATE_KEY,
  SYSTEM_DEFAULT_TEMPLATE,
  mapSubcategoriesToWorkbaskets,
  createDefaultWorkbaskets,
  createDefaultCategories,
  getFirmSetupTemplate,
  upsertFirmSetupTemplate,
  setupDefaultFirm,
  cloneFirmSetupFromFirm,
  resetFirmSetupToDefaults,
};
