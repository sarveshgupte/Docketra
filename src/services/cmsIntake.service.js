const Lead = require('../models/Lead.model');
const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const { DocketLifecycle } = require('../domain/docketLifecycle');
const clientService = require('./client.service');
const routingService = require('./routing.service');
const docketAuditService = require('./docketAudit.service');
const log = require('../utils/log');

const SPAM_NAME_PATTERN = /https?:\/\//i;

const DEFAULT_INTAKE_CONFIG = Object.freeze({
  autoCreateClient: true,
  autoCreateDocket: true,
  defaultWorkbasketId: null,
  defaultCategoryId: null,
  defaultSubcategoryId: null,
  defaultPriority: null,
  defaultAssignee: null,
});
const RESERVED_INTAKE_KEYS = new Set([
  'name',
  'email',
  'phone',
  'source',
  'service',
  'message',
  'notes',
  'pageUrl',
  'referrer',
  'utm_source',
  'utm_campaign',
  'utm_medium',
  'pageSlug',
  'slug',
  'formSlug',
  'formId',
  'website',
  'submissionMode',
  'externalSubmissionId',
  'idempotencyKey',
]);

function normalizeTrimmedString(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function normalizeMetadata(payload = {}, requestMeta = {}, options = {}) {
  const query = requestMeta.query || {};
  const headers = requestMeta.headers || {};
  const defaultSource = normalizeTrimmedString(options.defaultSource) || 'CMS_FORM';
  const externalSubmissionId = normalizeTrimmedString(payload.externalSubmissionId);
  const idempotencyKey = normalizeTrimmedString(payload.idempotencyKey || requestMeta.idempotencyKey);

  return {
    source: normalizeTrimmedString(payload.source) || defaultSource,
    pageSlug: normalizeTrimmedString(payload.pageSlug || payload.slug),
    formSlug: normalizeTrimmedString(payload.formSlug || payload.formId),
    formId: normalizeTrimmedString(payload.formId),
    service: normalizeTrimmedString(payload.service),
    message: normalizeTrimmedString(payload.message || payload.notes),
    pageUrl: normalizeTrimmedString(payload.pageUrl || query.pageUrl || headers.origin),
    timestamp: requestMeta.receivedAt || new Date().toISOString(),
    ipAddress: normalizeTrimmedString(requestMeta.ipAddress),
    userAgent: normalizeTrimmedString(requestMeta.userAgent || headers['user-agent']),
    referrer: normalizeTrimmedString(payload.referrer || query.referrer || headers.referer || headers.referrer),
    utm_source: normalizeTrimmedString(payload.utm_source || query.utm_source),
    utm_campaign: normalizeTrimmedString(payload.utm_campaign || query.utm_campaign),
    utm_medium: normalizeTrimmedString(payload.utm_medium || query.utm_medium),
    externalSubmissionId,
    idempotencyKey: idempotencyKey || externalSubmissionId,
  };
}

function normalizeScopeValue(value) {
  return normalizeTrimmedString(value);
}

function shouldUseFormScopedIdempotency(submissionMode) {
  return submissionMode === 'public_form' || submissionMode === 'embedded_form';
}

function resolveIdempotencyScopeToken(metadata = {}) {
  const formId = normalizeScopeValue(metadata.formId);
  if (formId) return { scopeField: 'metadata.formId', scopeValue: formId };
  const formSlug = normalizeScopeValue(metadata.formSlug);
  if (formSlug) return { scopeField: 'metadata.formSlug', scopeValue: formSlug };
  const pageSlug = normalizeScopeValue(metadata.pageSlug);
  if (pageSlug) return { scopeField: 'metadata.pageSlug', scopeValue: pageSlug };
  return null;
}

function buildIdempotencyScopeQuery({ submissionMode, metadata }) {
  if (shouldUseFormScopedIdempotency(submissionMode)) {
    const scopeToken = resolveIdempotencyScopeToken(metadata);
    if (scopeToken) {
      return {
        $and: [
          { 'metadata.submissionMode': submissionMode },
          { [scopeToken.scopeField]: scopeToken.scopeValue },
        ],
      };
    }
  }
  return { 'metadata.submissionMode': submissionMode };
}

function buildDocketIdempotencyKey({ firmId, submissionMode, metadata }) {
  const intakeKey = normalizeTrimmedString(metadata.idempotencyKey);
  if (!intakeKey) return null;
  const scopeToken = resolveIdempotencyScopeToken(metadata);
  const scopeParts = [
    String(firmId),
    String(submissionMode || 'cms'),
    scopeToken?.scopeField || '-',
    (scopeToken?.scopeValue || '-').toLowerCase(),
    intakeKey.toLowerCase(),
  ];
  return `cms-intake:${scopeParts.join(':')}`;
}

function normalizeExtraFieldValue(value) {
  if (value === null || value === undefined) return null;
  if (['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => normalizeExtraFieldValue(item));
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return String(value);
    }
  }
  return String(value);
}

function extractExtraFields(payload = {}) {
  const extras = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (RESERVED_INTAKE_KEYS.has(key)) return;
    const safeKey = normalizeTrimmedString(key);
    if (!safeKey) return;
    extras[safeKey] = normalizeExtraFieldValue(value);
  });
  return Object.keys(extras).length > 0 ? extras : null;
}

function buildIntakeOutcome({
  submissionMode,
  metadata,
  config,
  client,
  docket,
  warnings = [],
}) {
  return {
    createdClient: Boolean(client?.clientId),
    createdDocket: Boolean(docket?.caseId),
    clientId: client?.clientId || null,
    docketId: docket?.caseId || null,
    source: metadata.source || null,
    submissionMode,
    formId: metadata.formId || null,
    formSlug: metadata.formSlug || null,
    autoCreateClientEnabled: Boolean(config?.autoCreateClient),
    autoCreateDocketEnabled: Boolean(config?.autoCreateDocket),
    warnings: Array.isArray(warnings) ? warnings : [],
    updatedAt: new Date().toISOString(),
  };
}

function validateSubmission(payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) {
    throw new Error('name is required');
  }

  if (SPAM_NAME_PATTERN.test(name)) {
    throw new Error('Invalid submission');
  }

  return {
    name,
    email: normalizeTrimmedString(payload.email)?.toLowerCase() || null,
    phone: normalizeTrimmedString(payload.phone),
  };
}

async function resolveIntakeConfig({ firmId, overrides = {} }) {
  const firm = await Firm.findById(firmId).select('intakeConfig').lean();
  const savedConfig = firm?.intakeConfig?.cms || {};
  return {
    ...DEFAULT_INTAKE_CONFIG,
    ...savedConfig,
    ...overrides,
  };
}

async function resolveRouting({ firmId, config, metadata }) {
  if (config.defaultCategoryId && config.defaultSubcategoryId) {
    return {
      categoryId: config.defaultCategoryId,
      subcategoryId: config.defaultSubcategoryId,
      workbasketId: config.defaultWorkbasketId || null,
    };
  }

  if (!metadata.service) {
    return {
      validationMessage: 'Docket routing is incomplete: service or default category/subcategory config is required.',
    };
  }

  try {
    const routing = await routingService.mapServiceToRouting({ firmId, service: metadata.service.toLowerCase() });
    if (!routing?.workbasketId) {
      return {
        ...routing,
        validationMessage: 'Routing matched a category/subcategory, but no workbench is mapped.',
      };
    }
    const workbench = await Team.findOne({ firmId, _id: routing.workbasketId, isActive: true }).select('_id').lean();
    if (!workbench) {
      return {
        ...routing,
        validationMessage: 'Routing points to an inactive or missing workbench. Update category/subcategory mapping.',
      };
    }
    return routing;
  } catch (error) {
    return {
      validationMessage: error.message,
    };
  }
}

async function createDocket({
  firmId,
  clientId,
  lead,
  metadata,
  config,
  routing,
}) {
  const titleService = metadata.service || metadata.formSlug || 'CMS intake';
  const title = `${titleService} request - ${lead.name}`;
  const docketIdempotencyKey = buildDocketIdempotencyKey({
    firmId,
    submissionMode: metadata.submissionMode,
    metadata,
  });

  const docket = await Case.create({
    firmId: String(firmId),
    clientId,
    title,
    description: metadata.message || `Lead captured via ${metadata.source}`,
    category: routing.category || null,
    subcategory: routing.subcategory || null,
    caseCategory: routing.category || null,
    caseSubCategory: routing.subcategory || null,
    categoryId: routing.categoryId,
    subcategoryId: routing.subcategoryId,
    status: 'OPEN',
    state: 'IN_WB',
    lifecycle: DocketLifecycle.ACTIVE,
    queueType: 'GLOBAL',
    ownerTeamId: routing.workbasketId || config.defaultWorkbasketId || null,
    routedToTeamId: routing.workbasketId || config.defaultWorkbasketId || null,
    workbasketId: routing.workbasketId || config.defaultWorkbasketId || null,
    priority: config.defaultPriority || 'MEDIUM',
    assignedToXID: config.defaultAssignee || null,
    createdByXID: 'SYSTEM',
    createdBy: 'system@docketra.local',
    idempotencyKey: docketIdempotencyKey || undefined,
  });

  return docket;
}

async function processCmsSubmission({
  firmId,
  payload = {},
  requestMeta = {},
  actor = {},
  intakeConfig: intakeConfigOverrides = {},
  submissionMode = 'cms',
}) {
  if (!firmId) {
    throw new Error('firmId is required');
  }

  const { name, email, phone } = validateSubmission(payload);
  const metadata = normalizeMetadata(payload, requestMeta, {
    defaultSource: submissionMode === 'api_intake' ? 'api_integration' : 'CMS_FORM',
  });
  metadata.submissionMode = submissionMode;
  const extraFields = extractExtraFields(payload);
  const config = await resolveIntakeConfig({ firmId, overrides: intakeConfigOverrides });
  const workflowSteps = [];

  if (metadata.idempotencyKey) {
    const existingLead = await Lead.findOne({
      firmId,
      ...buildIdempotencyScopeQuery({ submissionMode, metadata }),
      $or: [
        { 'metadata.idempotencyKey': metadata.idempotencyKey },
        { 'metadata.externalSubmissionId': metadata.idempotencyKey },
      ],
    }).sort({ createdAt: -1 }).lean();

    if (existingLead) {
      workflowSteps.push({ step: 'idempotency_replay', status: 'replayed' });
      const existingWarnings = Array.isArray(existingLead?.metadata?.intakeOutcome?.warnings)
        ? existingLead.metadata.intakeOutcome.warnings
        : [];
      return {
        lead: existingLead,
        client: null,
        docket: null,
        submissionMode,
        metadata: {
          source: existingLead.source || metadata.source,
          pageSlug: existingLead?.metadata?.pageSlug || metadata.pageSlug,
          formSlug: existingLead?.metadata?.formSlug || metadata.formSlug,
          timestamp: metadata.timestamp,
          warnings: [...existingWarnings, 'Duplicate idempotency key detected. Existing lead returned.'],
          intakeOutcome: existingLead?.metadata?.intakeOutcome || null,
          idempotentReplay: true,
          workflowSteps,
        },
      };
    }
  }

  log.info('cms_submission_received', {
    firmId,
    submissionMode,
    source: metadata.source,
    pageSlug: metadata.pageSlug,
    formSlug: metadata.formSlug,
  });

  const lead = await Lead.create({
    firmId,
    name,
    email,
    phone,
    source: metadata.source,
    status: 'new',
    metadata: {
      utm_source: metadata.utm_source,
      utm_campaign: metadata.utm_campaign,
      utm_medium: metadata.utm_medium,
      referrer: metadata.referrer,
      pageUrl: metadata.pageUrl,
      pageSlug: metadata.pageSlug,
      formSlug: metadata.formSlug,
      formId: metadata.formId,
      service: metadata.service,
      message: metadata.message,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      submissionMode,
      externalSubmissionId: metadata.externalSubmissionId,
      idempotencyKey: metadata.idempotencyKey,
      extraFields,
      intakeOutcome: buildIntakeOutcome({
        submissionMode,
        metadata,
        config,
        client: null,
        docket: null,
        warnings: [],
      }),
    },
  });

  log.info('cms_lead_created', {
    firmId,
    leadId: lead._id,
    source: metadata.source,
  });
  workflowSteps.push({ step: 'lead_created', status: 'succeeded', leadId: String(lead._id) });

  const warnings = [];
  let client = null;

  if (config.autoCreateClient) {
    if (!email && !phone) {
      warnings.push('Client was not created because email or phone is required.');
      workflowSteps.push({ step: 'client_resolution', status: 'skipped', reason: 'missing_contact' });
    } else {
      client = await clientService.findClientByEmailOrPhone({ firmId, email, phone });
      if (client) {
        workflowSteps.push({ step: 'client_resolution', status: 'matched_existing', clientId: client.clientId });
      }
      if (!client) {
        client = await clientService.createClient({
          firmId,
          name,
          email,
          phone,
          createdByXid: actor?.xid || actor?.xID || 'SYSTEM',
        });
        workflowSteps.push({ step: 'client_resolution', status: 'created_new', clientId: client?.clientId || null });
      }

      if (client) {
        log.info('cms_client_upserted', {
          firmId,
          leadId: lead._id,
          clientId: client.clientId,
        });
      }
    }
  }

  let docket = null;
  if (config.autoCreateDocket) {
    const routing = await resolveRouting({ firmId, config, metadata });
    if (routing.validationMessage) {
      warnings.push(routing.validationMessage);
      workflowSteps.push({ step: 'routing_resolution', status: 'failed', reason: routing.validationMessage });
      log.warn('cms_docket_routing_failed', {
        firmId,
        leadId: lead._id,
        message: routing.validationMessage,
      });
    } else {
      if (!client) {
        warnings.push('Docket auto-create skipped because no canonical client is available.');
        workflowSteps.push({ step: 'docket_create', status: 'skipped', reason: 'missing_client' });
      } else {
        workflowSteps.push({
          step: 'routing_resolution',
          status: 'succeeded',
          categoryId: routing.categoryId || null,
          subcategoryId: routing.subcategoryId || null,
          workbasketId: routing.workbasketId || null,
        });
        docket = await createDocket({
          firmId,
          clientId: client.clientId,
          lead,
          metadata,
          config,
          routing,
        });
        workflowSteps.push({ step: 'docket_create', status: 'succeeded', docketId: docket.caseId });

        await docketAuditService.logDocketEvent({
          docketId: docket.caseId,
          firmId,
          event: 'DOCKET_CREATED',
          userId: actor?.xid || actor?.xID || 'SYSTEM',
          userRole: actor?.role || 'SYSTEM',
          metadata: {
            source: metadata.source,
            submissionMode,
            leadId: String(lead._id),
            clientId: client.clientId,
            docketIdempotencyKey: docket.idempotencyKey || null,
          },
        });

        log.info('cms_docket_created', {
          firmId,
          leadId: lead._id,
          docketId: docket.caseId,
        });
      }
    }
  }

  const finalOutcome = buildIntakeOutcome({
    submissionMode,
    metadata,
    config,
    client,
    docket,
    warnings,
  });
  const initialOutcome = lead?.metadata?.intakeOutcome || {};
  if (
    initialOutcome.createdClient !== finalOutcome.createdClient
    || initialOutcome.createdDocket !== finalOutcome.createdDocket
    || initialOutcome.clientId !== finalOutcome.clientId
    || initialOutcome.docketId !== finalOutcome.docketId
    || JSON.stringify(initialOutcome.warnings || []) !== JSON.stringify(finalOutcome.warnings || [])
  ) {
    if (mongoose.isValidObjectId(lead._id)) {
      await Lead.findByIdAndUpdate(lead._id, { $set: { 'metadata.intakeOutcome': finalOutcome } });
    }
    if (lead.metadata) {
      lead.metadata.intakeOutcome = finalOutcome;
    }
  }

  return {
    lead,
    client: client || null,
    docket: docket || null,
    submissionMode,
    metadata: {
      source: metadata.source,
      pageSlug: metadata.pageSlug,
      formSlug: metadata.formSlug,
      timestamp: metadata.timestamp,
      warnings,
      intakeOutcome: finalOutcome,
      workflowSteps,
    },
  };
}

async function handleFormSubmission({
  firmId,
  formData,
  source = 'CMS_FORM',
}) {
  const result = await processCmsSubmission({
    firmId,
    payload: {
      ...formData,
      source,
    },
    submissionMode: 'cms',
  });

  return {
    lead: result.lead,
    client: result.client,
    docket: result.docket,
    metadata: result.metadata,
  };
}

module.exports = {
  handleFormSubmission,
  processCmsSubmission,
  validateSubmission,
  createDocket,
};
