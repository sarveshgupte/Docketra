const Lead = require('../models/Lead.model');
const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const Case = require('../models/Case.model');
const Team = require('../models/Team.model');
const Client = require('../models/Client.model');
const { DocketLifecycle } = require('../domain/docketLifecycle');
const clientService = require('./client.service');
const routingService = require('./routing.service');
const docketAuditService = require('./docketAudit.service');
const log = require('../utils/log');
const { REASON_CODES, buildWarning, summarizeWarnings, logPilotEvent } = require('./pilotDiagnostics.service');

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

function canonicalizeExtraFields(extraFields = {}) {
  if (!extraFields || typeof extraFields !== 'object') return {};
  const canonical = {};
  Object.entries(extraFields).forEach(([key, value]) => {
    const normalizedKey = normalizeTrimmedString(key)?.toLowerCase();
    if (!normalizedKey) return;
    canonical[normalizedKey] = value;
  });
  return canonical;
}

const DUPLICATE_IDENTIFIER_FIELDS = Object.freeze([
  { key: 'pan', leadPath: 'metadata.extraFields.pan', clientPath: 'PAN', label: 'PAN' },
  { key: 'gst', leadPath: 'metadata.extraFields.gst', clientPath: 'GST', label: 'GST' },
  { key: 'gstin', leadPath: 'metadata.extraFields.gstin', clientPath: 'clientFactSheet.basicInfo.GSTIN', label: 'GSTIN' },
  { key: 'clientcode', leadPath: 'metadata.extraFields.clientcode', clientPath: null, label: 'Client code' },
  { key: 'firmidentifier', leadPath: 'metadata.extraFields.firmidentifier', clientPath: null, label: 'Firm identifier' },
  { key: 'firmid', leadPath: 'metadata.extraFields.firmid', clientPath: null, label: 'Firm identifier' },
]);

function normalizeIdentifier(value) {
  const normalized = normalizeTrimmedString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function buildSourceAttribution(metadata = {}) {
  return {
    source: metadata.source || 'CMS_FORM',
    submissionMode: metadata.submissionMode || 'cms',
    channel: metadata.submissionMode === 'api_intake' ? 'API Intake' : (metadata.submissionMode === 'embedded_form' ? 'Embedded form' : (metadata.submissionMode === 'public_form' ? 'Public form' : 'CMS')),
    pageUrl: metadata.pageUrl || null,
    referrer: metadata.referrer || null,
    formId: metadata.formId || null,
    formSlug: metadata.formSlug || null,
    campaign: {
      utm_source: metadata.utm_source || null,
      utm_medium: metadata.utm_medium || null,
      utm_campaign: metadata.utm_campaign || null,
    },
    externalSubmissionId: metadata.externalSubmissionId || null,
    idempotencyKey: metadata.idempotencyKey || null,
    capturedAt: metadata.timestamp || new Date().toISOString(),
  };
}

async function detectIntakeDuplicates({
  firmId,
  email,
  phone,
  extraFields = {},
  sourceAttribution = {},
  excludeLeadId = null,
}) {
  const canonicalExtraFields = canonicalizeExtraFields(extraFields);
  const warningContext = {
    leads: [],
    clients: [],
    matchedFields: [],
  };
  const leadOr = [];
  const clientOr = [];

  const normalizedEmail = normalizeTrimmedString(email)?.toLowerCase() || null;
  const normalizedPhone = normalizeTrimmedString(phone) || null;
  if (normalizedEmail) {
    leadOr.push({ email: normalizedEmail });
    clientOr.push({ businessEmail: normalizedEmail });
  }
  if (normalizedPhone) {
    leadOr.push({ phone: normalizedPhone });
    clientOr.push({ primaryContactNumber: normalizedPhone });
  }

  DUPLICATE_IDENTIFIER_FIELDS.forEach((field) => {
    const rawValue = canonicalExtraFields[field.key];
    const normalizedValue = normalizeIdentifier(rawValue);
    if (!normalizedValue) return;
    leadOr.push({ [field.leadPath]: normalizedValue });
    if (field.clientPath) clientOr.push({ [field.clientPath]: normalizedValue });
    warningContext.matchedFields.push(field.label);
  });

  const uniqueMatchedFields = new Set(warningContext.matchedFields);
  if (normalizedEmail) uniqueMatchedFields.add('Email');
  if (normalizedPhone) uniqueMatchedFields.add('Phone');
  warningContext.matchedFields = [...uniqueMatchedFields];

  if (leadOr.length > 0) {
    const leadQuery = {
      firmId,
      $or: leadOr,
    };
    if (excludeLeadId) {
      leadQuery._id = { $ne: excludeLeadId };
    }
    const leadMatches = await Lead.find(leadQuery)
      .select('_id name email phone source createdAt metadata.sourceAttribution')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    warningContext.leads = leadMatches.map((lead) => ({
      leadId: String(lead._id),
      name: lead.name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      source: lead?.metadata?.sourceAttribution?.source || lead.source || null,
      createdAt: lead.createdAt || null,
    }));
  }

  if (clientOr.length > 0) {
    const clientMatches = await Client.find({
      firmId,
      $or: clientOr,
      isActive: true,
    })
      .select('clientId businessName businessEmail primaryContactNumber PAN GST clientFactSheet.basicInfo.GSTIN')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    warningContext.clients = clientMatches.map((client) => ({
      clientId: client.clientId,
      businessName: client.businessName || null,
      businessEmail: client.businessEmail || null,
      primaryContactNumber: client.primaryContactNumber || null,
      PAN: client.PAN || null,
      GST: client.GST || client?.clientFactSheet?.basicInfo?.GSTIN || null,
    }));
  }

  if (warningContext.leads.length === 0 && warningContext.clients.length === 0) {
    return null;
  }

  return buildWarning({
    code: REASON_CODES.DUPLICATE_MATCH,
    message: 'Potential duplicate detected from prior intake/client records.',
    recovery: 'Review existing lead/client records before converting this intake. Merge or continue only if this is a legitimate new matter.',
    context: {
      source: sourceAttribution.source,
      submissionMode: sourceAttribution.submissionMode,
      matchedFields: warningContext.matchedFields,
      matches: warningContext,
    },
  });
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
      reasonCode: REASON_CODES.MISSING_ROUTING,
      validationMessage: 'Docket routing is incomplete: service or default category/subcategory config is required.',
    };
  }

  try {
    const routing = await routingService.mapServiceToRouting({ firmId, service: metadata.service.toLowerCase() });
    if (!routing?.workbasketId) {
      return {
        ...routing,
        reasonCode: REASON_CODES.MISSING_ROUTING,
        validationMessage: 'Docket skipped because no active workbench mapping exists for the selected routing rule.',
      };
    }
    const workbench = await Team.findOne({ firmId, _id: routing.workbasketId, isActive: true }).select('_id').lean();
    if (!workbench) {
      return {
        ...routing,
        reasonCode: REASON_CODES.INACTIVE_WORKBENCH,
        validationMessage: 'Docket skipped because routing points to an inactive or missing workbench.',
      };
    }
    return routing;
  } catch (error) {
    return {
      reasonCode: REASON_CODES.MISSING_ROUTING,
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
  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => {
      if (!DUPLICATE_IDENTIFIER_FIELDS.some((field) => field.key === key.toLowerCase())) return;
      const normalizedValue = normalizeIdentifier(value);
      if (!normalizedValue) return;
      extraFields[key] = normalizedValue;
    });
  }
  const sourceAttribution = buildSourceAttribution(metadata);
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
      const replayWarning = buildWarning({
        code: REASON_CODES.IDEMPOTENT_REPLAY,
        message: 'Existing lead returned due to idempotent replay.',
        recovery: 'Reuse the existing leadId/clientId/docketId and avoid retrying with the same idempotency key.',
      });
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
          warnings: [...existingWarnings, replayWarning.message],
          warningDetails: [replayWarning],
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
      sourceAttribution,
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

  const warningDetails = [];
  const addWarning = (warning) => {
    if (!warning?.message) return;
    warningDetails.push(warning);
  };
  const duplicateWarning = await detectIntakeDuplicates({
    firmId,
    email,
    phone,
    extraFields: extraFields || {},
    sourceAttribution,
    excludeLeadId: lead._id,
  });
  if (duplicateWarning) {
    addWarning(duplicateWarning);
    workflowSteps.push({
      step: 'duplicate_check',
      status: 'warning',
      reasonCode: duplicateWarning.code,
      matchedFields: duplicateWarning?.context?.matchedFields || [],
    });
  } else {
    workflowSteps.push({ step: 'duplicate_check', status: 'clear' });
  }
  let client = null;
  const conversionTrail = [];

  if (config.autoCreateClient) {
    if (!email && !phone) {
      addWarning(buildWarning({
        code: REASON_CODES.MISSING_CONTACT,
        message: 'Client not created because contact details (email or phone) are missing.',
        recovery: 'Capture at least one contact detail and retry intake.',
      }));
      workflowSteps.push({ step: 'client_resolution', status: 'skipped', reasonCode: REASON_CODES.MISSING_CONTACT });
      conversionTrail.push({
        target: 'client',
        status: 'skipped',
        reasonCode: REASON_CODES.MISSING_CONTACT,
        recovery: 'Capture email or phone before retrying client conversion.',
        at: new Date().toISOString(),
      });
    } else {
      try {
        client = await clientService.findClientByEmailOrPhone({ firmId, email, phone });
        if (client) {
          workflowSteps.push({ step: 'client_resolution', status: 'matched_existing', clientId: client.clientId });
          conversionTrail.push({
            target: 'client',
            status: 'matched_existing',
            clientId: client.clientId,
            at: new Date().toISOString(),
          });
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
          conversionTrail.push({
            target: 'client',
            status: 'created_new',
            clientId: client?.clientId || null,
            at: new Date().toISOString(),
          });
        }
      } catch (error) {
        const warning = buildWarning({
          code: REASON_CODES.CONVERSION_FAILED,
          message: `Client conversion failed: ${error.message || 'unknown error'}`,
          recovery: 'Open the intake lead and retry client conversion after fixing contact or identifier data.',
          context: { target: 'client' },
        });
        addWarning(warning);
        workflowSteps.push({ step: 'client_resolution', status: 'failed', reasonCode: REASON_CODES.CONVERSION_FAILED });
        conversionTrail.push({
          target: 'client',
          status: 'failed',
          reasonCode: REASON_CODES.CONVERSION_FAILED,
          error: error.message || 'Unknown error',
          recovery: warning.recovery,
          at: new Date().toISOString(),
        });
      }
    }
    if (client) {
      log.info('cms_client_upserted', {
        firmId,
        leadId: lead._id,
        clientId: client.clientId,
      });
    }
  }

  let docket = null;
  if (config.autoCreateDocket) {
    const routing = await resolveRouting({ firmId, config, metadata });
    if (routing.validationMessage) {
      addWarning(buildWarning({
        code: routing.reasonCode || REASON_CODES.MISSING_ROUTING,
        message: routing.validationMessage,
        recovery: 'Review category/subcategory mapping and active workbench assignment in work settings.',
      }));
      workflowSteps.push({ step: 'routing_resolution', status: 'failed', reasonCode: routing.reasonCode || REASON_CODES.MISSING_ROUTING });
      log.warn('cms_docket_routing_failed', {
        firmId,
        leadId: lead._id,
        message: routing.validationMessage,
      });
    } else {
      if (!client) {
        addWarning(buildWarning({
          code: REASON_CODES.MISSING_CLIENT,
          message: 'Docket skipped because no canonical client is available.',
          recovery: 'Resolve or create a client first, then retry docket creation.',
        }));
        workflowSteps.push({ step: 'docket_create', status: 'skipped', reasonCode: REASON_CODES.MISSING_CLIENT });
        conversionTrail.push({
          target: 'docket',
          status: 'skipped',
          reasonCode: REASON_CODES.MISSING_CLIENT,
          recovery: 'Resolve client conversion first, then retry docket conversion.',
          at: new Date().toISOString(),
        });
      } else {
        workflowSteps.push({
          step: 'routing_resolution',
          status: 'succeeded',
          categoryId: routing.categoryId || null,
          subcategoryId: routing.subcategoryId || null,
          workbasketId: routing.workbasketId || null,
        });
        try {
          docket = await createDocket({
            firmId,
            clientId: client.clientId,
            lead,
            metadata,
            config,
            routing,
          });
          workflowSteps.push({ step: 'docket_create', status: 'succeeded', docketId: docket.caseId });
          conversionTrail.push({
            target: 'docket',
            status: 'succeeded',
            docketId: docket.caseId,
            at: new Date().toISOString(),
          });

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
        } catch (error) {
          const warning = buildWarning({
            code: REASON_CODES.CONVERSION_FAILED,
            message: `Docket conversion failed: ${error.message || 'unknown error'}`,
            recovery: 'Open the intake lead, verify routing and client linkage, then retry docket conversion.',
            context: { target: 'docket' },
          });
          addWarning(warning);
          workflowSteps.push({ step: 'docket_create', status: 'failed', reasonCode: REASON_CODES.CONVERSION_FAILED });
          conversionTrail.push({
            target: 'docket',
            status: 'failed',
            reasonCode: REASON_CODES.CONVERSION_FAILED,
            error: error.message || 'Unknown error',
            recovery: warning.recovery,
            at: new Date().toISOString(),
          });
        }
      }
    }
  }

  const finalOutcome = buildIntakeOutcome({
    submissionMode,
    metadata,
    config,
    client,
    docket,
    warnings: summarizeWarnings(warningDetails),
  });
  finalOutcome.warningDetails = warningDetails;
  const initialOutcome = lead?.metadata?.intakeOutcome || {};
  if (
    initialOutcome.createdClient !== finalOutcome.createdClient
    || initialOutcome.createdDocket !== finalOutcome.createdDocket
    || initialOutcome.clientId !== finalOutcome.clientId
    || initialOutcome.docketId !== finalOutcome.docketId
    || JSON.stringify(initialOutcome.warnings || []) !== JSON.stringify(finalOutcome.warnings || [])
  ) {
    if (mongoose.isValidObjectId(lead._id)) {
      await Lead.findByIdAndUpdate(lead._id, {
        $set: {
          'metadata.intakeOutcome': finalOutcome,
          'metadata.intakeDiagnostics': {
            warningDetails,
            workflowSteps,
            conversionTrail,
            lastFailureReason: warningDetails[0]?.code || null,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
    if (lead.metadata) {
      lead.metadata.intakeOutcome = finalOutcome;
    }
  }


  logPilotEvent({
    event: 'cms_intake_outcome',
    severity: warningDetails.length ? 'warn' : 'info',
    metadata: {
      firmId,
      leadId: String(lead._id),
      submissionMode,
      createdClient: finalOutcome.createdClient,
      createdDocket: finalOutcome.createdDocket,
      warningCodes: warningDetails.map((warning) => warning.code),
    },
  });

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
      warnings: summarizeWarnings(warningDetails),
      warningDetails,
      intakeOutcome: finalOutcome,
      workflowSteps,
      sourceAttribution,
      conversionTrail,
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
