const { randomUUID } = require('crypto');
const Case = require('../models/Case.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const ComplianceObligationTemplate = require('../models/ComplianceObligationTemplate.model');
const { COMPLIANCE_STATES } = require('../domain/compliance/complianceStateMachine');

const OBLIGATION_TYPE_LABEL = {
  GST: 'GST',
  TDS: 'TDS',
  ROC: 'ROC',
  ANNUAL_FILING: 'Annual Filing',
  OTHER: 'Other',
};

const asDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const startOfUtcDay = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const startOfUtcMonth = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
const endOfUtcMonth = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
const addUtcDays = (value, days) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + Number(days || 0)));
const addUtcMonths = (value, months) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + Number(months || 0), 1));
const clampDay = (year, monthZeroBased, dayOfMonth) => {
  const end = endOfUtcMonth(new Date(Date.UTC(year, monthZeroBased, 1)));
  const safeDay = Math.max(1, Math.min(Number(dayOfMonth || 1), end.getUTCDate()));
  return new Date(Date.UTC(year, monthZeroBased, safeDay));
};
const periodKeyFromStart = (value) => `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
const formatMonthPeriod = (value) => value.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(' ', '-');

const normalizeEntityType = (value) => String(value || '').trim().toLowerCase();

const isTemplateApplicableToEntityType = (template = {}, entityType = '') => {
  const configured = Array.isArray(template.applicableEntityTypes)
    ? template.applicableEntityTypes.map((item) => normalizeEntityType(item)).filter(Boolean)
    : [];
  if (!configured.length) return true;
  const normalizedEntityType = normalizeEntityType(entityType);
  return configured.includes('all') || configured.includes(normalizedEntityType);
};

const expandRecurringPeriods = ({ recurrencePattern = {}, rangeStart, rangeEnd }) => {
  const normalizedStart = startOfUtcMonth(rangeStart);
  const normalizedEnd = startOfUtcMonth(rangeEnd);
  const frequency = String(recurrencePattern?.frequency || 'monthly').toLowerCase();
  const interval = Math.max(1, Number(recurrencePattern?.interval || 1));
  const configuredStartMonth = Math.max(1, Math.min(12, Number(recurrencePattern?.startMonth || 1))) - 1;

  const periods = [];
  let cursor = new Date(normalizedStart);

  if (frequency === 'quarterly') {
    const quarterStartMonth = Math.floor(cursor.getUTCMonth() / 3) * 3;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), quarterStartMonth, 1));
  } else if (frequency === 'yearly') {
    const year = cursor.getUTCMonth() > configuredStartMonth ? cursor.getUTCFullYear() + 1 : cursor.getUTCFullYear();
    cursor = new Date(Date.UTC(year, configuredStartMonth, 1));
  }

  while (cursor <= normalizedEnd) {
    let monthsSpan = 1;
    if (frequency === 'quarterly') monthsSpan = 3 * interval;
    else if (frequency === 'yearly') monthsSpan = 12 * interval;
    else monthsSpan = interval;

    const periodStart = new Date(cursor);
    const nextPeriodStart = addUtcMonths(periodStart, monthsSpan);
    const periodEnd = addUtcDays(nextPeriodStart, -1);

    if (periodStart >= normalizedStart && periodStart <= normalizedEnd) {
      periods.push({ periodStart, periodEnd });
    }
    cursor = nextPeriodStart;
  }

  return periods;
};

const computeStatutoryDueDate = ({ periodStart, periodEnd, dueDateRule = {} }) => {
  const mode = String(dueDateRule?.mode || 'day_of_next_month').toLowerCase();
  const dayOfMonth = Math.max(1, Math.min(28, Number(dueDateRule?.dayOfMonth || 20)));
  if (mode === 'fixed_day_month') {
    const fixedMonth = Math.max(1, Math.min(12, Number(dueDateRule?.fixedMonth || (periodEnd.getUTCMonth() + 1))));
    const year = periodEnd.getUTCFullYear();
    return clampDay(year, fixedMonth - 1, dayOfMonth);
  }
  const monthOffset = mode === 'day_of_month_after_period'
    ? Math.max(0, Number(dueDateRule?.monthOffset || 1))
    : 1;
  const dueMonthStart = addUtcMonths(new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1)), monthOffset);
  return clampDay(dueMonthStart.getUTCFullYear(), dueMonthStart.getUTCMonth(), dayOfMonth);
};

const computeInternalDueDate = ({ statutoryDueDate, internalBufferDays = 0 }) => addUtcDays(statutoryDueDate, -Math.max(0, Number(internalBufferDays || 0)));

const buildObligationPeriodLabel = ({ periodStart, recurrencePattern = {} }) => {
  const frequency = String(recurrencePattern?.frequency || 'monthly').toLowerCase();
  if (frequency === 'quarterly') {
    const quarter = Math.floor(periodStart.getUTCMonth() / 3) + 1;
    return `Q${quarter}-${periodStart.getUTCFullYear()}`;
  }
  if (frequency === 'yearly') {
    const startYear = periodStart.getUTCFullYear();
    const endYear = startYear + 1;
    return `FY ${startYear}-${String(endYear).slice(-2)}`;
  }
  return formatMonthPeriod(periodStart);
};

const buildChecklistSnapshot = ({ checklist = [], internalDueDate }) => {
  if (!Array.isArray(checklist)) return [];
  return checklist
    .filter((item) => String(item?.title || '').trim())
    .map((item, idx) => {
      const dueOffsetDays = Number.isFinite(Number(item?.dueOffsetDays)) ? Number(item.dueOffsetDays) : 0;
      const dueDate = internalDueDate ? addUtcDays(internalDueDate, dueOffsetDays) : null;
      return {
        id: randomUUID(),
        templateItemId: null,
        title: String(item.title || '').trim().slice(0, 200),
        description: String(item.description || '').trim().slice(0, 1000),
        required: Boolean(item.required),
        completed: false,
        completedAt: null,
        completedByXID: null,
        assignedToXID: null,
        dueDate,
        status: 'requested',
        uploadedAttachmentId: null,
        uploadedFileName: null,
        reviewerNotes: '',
        submittedAt: null,
        submittedBy: null,
        reviewedAt: null,
        reviewedByXID: null,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : idx,
      };
    });
};

const buildSopSnapshot = ({ sop = {}, subcategoryId = null }) => {
  const links = Array.isArray(sop?.links) ? sop.links : [];
  const files = Array.isArray(sop?.files) ? sop.files : [];
  return {
    title: String(sop?.title || '').trim(),
    body: String(sop?.body || '').trim(),
    format: ['plain_text', 'markdown'].includes(String(sop?.format || 'markdown')) ? String(sop.format) : 'markdown',
    links: links.map((link, idx) => ({
      id: String(link?.id || randomUUID()),
      title: String(link?.title || '').trim(),
      url: String(link?.url || '').trim(),
      description: String(link?.description || '').trim(),
      type: ['portal', 'reference', 'template', 'internal', 'other'].includes(String(link?.type || 'reference')) ? String(link.type) : 'reference',
      sortOrder: Number.isFinite(Number(link?.sortOrder)) ? Number(link.sortOrder) : idx,
    })).filter((link) => link.title && link.url),
    files: files.map((file, idx) => ({
      id: String(file?.id || randomUUID()),
      fileName: String(file?.fileName || '').trim(),
      mimeType: String(file?.mimeType || '').trim(),
      size: Number.isFinite(Number(file?.size)) ? Number(file.size) : 0,
      storageProvider: String(file?.storageProvider || '').trim(),
      storageFileId: file?.storageFileId ? String(file.storageFileId) : null,
      objectKey: file?.objectKey ? String(file.objectKey) : null,
      webViewLink: file?.webViewLink ? String(file.webViewLink) : null,
      uploadedAt: file?.uploadedAt || new Date(),
      uploadedByXID: file?.uploadedByXID ? String(file.uploadedByXID).trim() : null,
      uploadedByName: file?.uploadedByName ? String(file.uploadedByName).trim() : null,
      description: String(file?.description || '').trim(),
      sortOrder: Number.isFinite(Number(file?.sortOrder)) ? Number(file.sortOrder) : idx,
    })).filter((file) => file.fileName && file.mimeType && file.storageProvider),
    sourceSubcategoryId: subcategoryId || null,
    capturedAt: new Date(),
  };
};

const buildGenerationCandidates = ({ templates = [], clients = [], rangeStart, rangeEnd }) => {
  const candidates = [];
  templates.forEach((template) => {
    const periods = expandRecurringPeriods({
      recurrencePattern: template.recurrencePattern || {},
      rangeStart,
      rangeEnd,
    });
    clients.forEach((client) => {
      const entityType = client?.clientFactSheet?.basicInfo?.entityType || '';
      if (!isTemplateApplicableToEntityType(template, entityType)) return;
      periods.forEach(({ periodStart, periodEnd }) => {
        const statutoryDueDate = computeStatutoryDueDate({ periodStart, periodEnd, dueDateRule: template.dueDateRule || {} });
        const internalDueDate = computeInternalDueDate({ statutoryDueDate, internalBufferDays: template.internalBufferDays || 0 });
        const periodKey = periodKeyFromStart(periodStart);
        candidates.push({
          template,
          client,
          periodStart,
          periodEnd,
          periodKey,
          periodLabel: buildObligationPeriodLabel({ periodStart, recurrencePattern: template.recurrencePattern || {} }),
          statutoryDueDate,
          internalDueDate,
          idempotencyKey: `compliance:${String(client.clientId)}:${String(template.obligationType || 'OTHER').toLowerCase()}:${periodKey}`,
        });
      });
    });
  });
  return candidates;
};

const resolveFallbackCategoryConfig = async ({ firmId }) => {
  const category = await Category.findOne({ firmId, isActive: true }).lean();
  if (!category) return null;
  const subcategory = Array.isArray(category.subcategories)
    ? category.subcategories.find((item) => item?.isActive !== false)
    : null;
  if (!subcategory?.id) return null;
  return {
    categoryId: category._id,
    subcategoryId: subcategory.id,
    categoryName: category.name || 'Compliance',
    subcategoryName: subcategory.name || 'Compliance Obligation',
  };
};

const loadTemplates = async ({ firmId, templateIds = null, includeInactive = false }) => {
  const query = {
    firmId: String(firmId),
    ...(includeInactive ? {} : { isActive: true }),
  };
  if (Array.isArray(templateIds) && templateIds.length) {
    query._id = { $in: templateIds };
  }
  return ComplianceObligationTemplate.find(query).sort({ name: 1 }).lean();
};

const loadClientsForGeneration = async ({ firmId, clientIds = null }) => {
  const query = {
    firmId,
    status: { $ne: 'inactive' },
    isInternal: { $ne: true },
  };
  if (Array.isArray(clientIds) && clientIds.length) {
    query.clientId = { $in: clientIds };
  }
  return Client.find(query)
    .select('clientId businessName clientFactSheet.basicInfo.entityType status')
    .lean();
};

const seedSampleTemplates = async ({ firmId, actorXID }) => {
  const existingSamples = await ComplianceObligationTemplate.countDocuments({ firmId: String(firmId), isSample: true });
  if (existingSamples > 0) {
    return { inserted: 0, skipped: existingSamples };
  }
  const fallback = await resolveFallbackCategoryConfig({ firmId: String(firmId) });
  const categoryConfig = fallback
    ? { docketCategoryId: fallback.categoryId, docketSubcategoryId: fallback.subcategoryId }
    : { docketCategoryId: null, docketSubcategoryId: null };

  const baseChecklist = [
    { title: 'Collect supporting documents', description: 'Ask client for source documents and reconciliations', required: true, dueOffsetDays: -2, sortOrder: 0 },
    { title: 'Perform internal review', description: 'Validate completeness before submission', required: true, dueOffsetDays: -1, sortOrder: 1 },
  ];

  const sampleTemplates = [
    {
      name: 'Sample GST Monthly Return (Configurable)',
      obligationType: 'GST',
      applicableEntityTypes: ['private limited company', 'llp', 'proprietorship'],
      recurrencePattern: { frequency: 'monthly', interval: 1, startMonth: 1 },
      dueDateRule: { mode: 'day_of_next_month', dayOfMonth: 20, monthOffset: 1 },
      internalBufferDays: 3,
      defaultChecklist: baseChecklist,
      defaultSop: { title: 'GST monthly return SOP', body: 'Validate books and reconcile sales/purchase data before filing.', format: 'markdown', links: [] },
      notes: 'Sample only. Verify due-date rule per client before production use.',
    },
    {
      name: 'Sample TDS Quarterly Return (Configurable)',
      obligationType: 'TDS',
      applicableEntityTypes: ['private limited company', 'llp', 'partnership'],
      recurrencePattern: { frequency: 'quarterly', interval: 1, startMonth: 1 },
      dueDateRule: { mode: 'day_of_month_after_period', dayOfMonth: 31, monthOffset: 1 },
      internalBufferDays: 5,
      defaultChecklist: baseChecklist,
      defaultSop: { title: 'TDS quarterly return SOP', body: 'Validate challans and deductee details before upload.', format: 'markdown', links: [] },
      notes: 'Sample only. Configure dates for your filing practice.',
    },
    {
      name: 'Sample ROC Annual Filing (Configurable)',
      obligationType: 'ANNUAL_FILING',
      applicableEntityTypes: ['private limited company', 'public limited company'],
      recurrencePattern: { frequency: 'yearly', interval: 1, startMonth: 4 },
      dueDateRule: { mode: 'fixed_day_month', dayOfMonth: 30, fixedMonth: 10 },
      internalBufferDays: 10,
      defaultChecklist: baseChecklist,
      defaultSop: { title: 'ROC annual filing SOP', body: 'Collect board approvals and audited financials before filing.', format: 'markdown', links: [] },
      notes: 'Sample only. Replace with firm-approved ROC due-date logic.',
    },
  ];

  const payload = sampleTemplates.map((template) => ({
    firmId: String(firmId),
    ...template,
    ...categoryConfig,
    isSample: true,
    createdByXID: actorXID || null,
    updatedByXID: actorXID || null,
  }));
  await ComplianceObligationTemplate.insertMany(payload);
  return { inserted: payload.length, skipped: 0 };
};

const previewOrGenerate = async ({
  firmId,
  actor = {},
  rangeStart,
  rangeEnd,
  templateIds = [],
  clientIds = [],
  execute = false,
}) => {
  const start = asDate(rangeStart);
  const end = asDate(rangeEnd);
  if (!start || !end) throw new Error('Valid rangeStart and rangeEnd are required');
  if (start > end) throw new Error('rangeStart cannot be after rangeEnd');

  const [templates, clients, fallbackCategory] = await Promise.all([
    loadTemplates({ firmId, templateIds }),
    loadClientsForGeneration({ firmId, clientIds }),
    resolveFallbackCategoryConfig({ firmId: String(firmId) }),
  ]);

  const candidates = buildGenerationCandidates({
    templates,
    clients,
    rangeStart: start,
    rangeEnd: end,
  });

  const existingDocs = candidates.length
    ? await Case.find({ firmId: String(firmId), idempotencyKey: { $in: candidates.map((item) => item.idempotencyKey) } })
      .select('idempotencyKey')
      .lean()
    : [];
  const existingKeys = new Set(existingDocs.map((item) => String(item.idempotencyKey)));

  const summary = {
    totalCandidates: candidates.length,
    generated: 0,
    skippedDuplicate: 0,
    failed: 0,
  };
  const items = [];

  for (const candidate of candidates) {
    const templateCategoryId = candidate.template?.docketCategoryId || fallbackCategory?.categoryId || null;
    const templateSubcategoryId = candidate.template?.docketSubcategoryId || fallbackCategory?.subcategoryId || null;
    const categoryName = fallbackCategory?.categoryName || `${OBLIGATION_TYPE_LABEL[candidate.template.obligationType] || 'Compliance'} Docket`;
    const subcategoryName = fallbackCategory?.subcategoryName || candidate.template?.name || 'Compliance Obligation';

    if (!templateCategoryId || !templateSubcategoryId) {
      summary.failed += 1;
      items.push({
        clientId: candidate.client.clientId,
        clientName: candidate.client.businessName || '',
        templateId: String(candidate.template._id),
        templateName: candidate.template.name,
        obligationType: candidate.template.obligationType,
        period: candidate.periodLabel,
        status: 'failed',
        reason: 'Template category/subcategory mapping is missing',
      });
      continue;
    }

    if (existingKeys.has(candidate.idempotencyKey)) {
      summary.skippedDuplicate += 1;
      items.push({
        clientId: candidate.client.clientId,
        clientName: candidate.client.businessName || '',
        templateId: String(candidate.template._id),
        templateName: candidate.template.name,
        obligationType: candidate.template.obligationType,
        period: candidate.periodLabel,
        status: 'skipped_duplicate',
        reason: 'Existing docket found for this entity/obligation/period',
      });
      continue;
    }

    if (!execute) {
      items.push({
        clientId: candidate.client.clientId,
        clientName: candidate.client.businessName || '',
        templateId: String(candidate.template._id),
        templateName: candidate.template.name,
        obligationType: candidate.template.obligationType,
        period: candidate.periodLabel,
        statutoryDueDate: candidate.statutoryDueDate,
        internalDueDate: candidate.internalDueDate,
        status: 'ready_to_generate',
      });
      continue;
    }

    const casePayload = {
      firmId: String(firmId),
      title: `${candidate.template.name} · ${candidate.periodLabel}`,
      description: `${candidate.template.name} for ${candidate.client.businessName || candidate.client.clientId} (${candidate.periodLabel})`,
      categoryId: templateCategoryId,
      subcategoryId: templateSubcategoryId,
      category: categoryName,
      caseCategory: categoryName,
      caseSubCategory: subcategoryName,
      subcategory: subcategoryName,
      clientId: candidate.client.clientId,
      isInternal: false,
      workType: 'client',
      status: 'OPEN',
      priority: 'medium',
      dueDate: candidate.statutoryDueDate,
      slaDueAt: candidate.internalDueDate || candidate.statutoryDueDate,
      compliance_state: COMPLIANCE_STATES.NOT_STARTED,
      statutory_due_date: candidate.statutoryDueDate,
      internal_due_date: candidate.internalDueDate,
      obligation_type: candidate.template.obligationType,
      obligation_period: candidate.periodLabel,
      reviewer_xid: candidate.template.defaultReviewerXID || null,
      approver_xid: candidate.template.defaultApproverXID || null,
      assignedToXID: candidate.template.defaultAssigneeXID || null,
      assignedTo: candidate.template.defaultAssigneeXID || null,
      queueType: candidate.template.defaultAssigneeXID ? 'PERSONAL' : 'GLOBAL',
      createdByXID: String(actor?.xID || actor?.xid || 'SYSTEM').toUpperCase(),
      createdBy: String(actor?.email || '').toLowerCase() || null,
      checklist: buildChecklistSnapshot({
        checklist: candidate.template.defaultChecklist || [],
        internalDueDate: candidate.internalDueDate,
      }),
      sopSnapshot: buildSopSnapshot({
        sop: candidate.template.defaultSop || {},
        subcategoryId: templateSubcategoryId,
      }),
      expectedMinutes: candidate.template.expectedMinutes || 0,
      estimatedBudget: candidate.template.estimatedBudget || 0,
      idempotencyKey: candidate.idempotencyKey,
    };

    try {
      const docketDoc = new Case(casePayload);
      await docketDoc.saveWithRetry();
      summary.generated += 1;
      items.push({
        clientId: candidate.client.clientId,
        clientName: candidate.client.businessName || '',
        templateId: String(candidate.template._id),
        templateName: candidate.template.name,
        obligationType: candidate.template.obligationType,
        period: candidate.periodLabel,
        docketId: docketDoc.caseId || docketDoc.caseNumber,
        status: 'generated',
      });
      existingKeys.add(candidate.idempotencyKey);
    } catch (error) {
      if (error?.code === 11000 || String(error?.message || '').includes('idempotencyKey')) {
        summary.skippedDuplicate += 1;
        items.push({
          clientId: candidate.client.clientId,
          clientName: candidate.client.businessName || '',
          templateId: String(candidate.template._id),
          templateName: candidate.template.name,
          obligationType: candidate.template.obligationType,
          period: candidate.periodLabel,
          status: 'skipped_duplicate',
          reason: 'Duplicate prevented by idempotency key',
        });
      } else {
        summary.failed += 1;
        items.push({
          clientId: candidate.client.clientId,
          clientName: candidate.client.businessName || '',
          templateId: String(candidate.template._id),
          templateName: candidate.template.name,
          obligationType: candidate.template.obligationType,
          period: candidate.periodLabel,
          status: 'failed',
          reason: error?.message || 'Failed to generate docket',
        });
      }
    }
  }

  if (!execute) {
    summary.generated = 0;
    summary.failed = items.filter((item) => item.status === 'failed').length;
    summary.skippedDuplicate = items.filter((item) => item.status === 'skipped_duplicate').length;
  }

  return {
    summary,
    items,
  };
};

module.exports = {
  isTemplateApplicableToEntityType,
  expandRecurringPeriods,
  computeStatutoryDueDate,
  computeInternalDueDate,
  buildGenerationCandidates,
  loadTemplates,
  seedSampleTemplates,
  previewOrGenerate,
};
