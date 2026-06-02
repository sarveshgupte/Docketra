const { z } = require('./common');
const { ONBOARDING_EVENT_NAMES } = require('../models/OnboardingEvent.model');

const checklistItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  required: z.boolean().optional(),
  dueOffsetDays: z.coerce.number().int().min(-120).max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

const sopLinkSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2048),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(['portal', 'reference', 'template', 'internal', 'other']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

const complianceTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(180),
  obligationType: z.enum(['GST', 'TDS', 'ROC', 'ANNUAL_FILING', 'OTHER']),
  applicableEntityTypes: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  recurrencePattern: z.object({
    frequency: z.enum(['monthly', 'quarterly', 'yearly']),
    interval: z.coerce.number().int().min(1).max(12).optional(),
    startMonth: z.coerce.number().int().min(1).max(12).optional(),
  }).strict(),
  dueDateRule: z.object({
    mode: z.enum(['day_of_next_month', 'day_of_month_after_period', 'fixed_day_month']).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
    monthOffset: z.coerce.number().int().min(0).max(24).optional(),
    fixedMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  }).strict().optional(),
  internalBufferDays: z.coerce.number().int().min(0).max(120).optional(),
  defaultChecklist: z.array(checklistItemSchema).max(100).optional(),
  defaultSop: z.object({
    title: z.string().trim().max(200).optional(),
    body: z.string().trim().max(5000).optional(),
    format: z.enum(['plain_text', 'markdown']).optional(),
    links: z.array(sopLinkSchema).max(30).optional(),
  }).strict().optional(),
  defaultAssigneeXID: z.string().trim().max(30).optional().nullable(),
  defaultReviewerXID: z.string().trim().max(30).optional().nullable(),
  defaultApproverXID: z.string().trim().max(30).optional().nullable(),
  docketCategoryId: z.string().trim().optional().nullable(),
  docketSubcategoryId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

const generationBodySchema = z.object({
  rangeStart: z.string().trim().min(8),
  rangeEnd: z.string().trim().min(8),
  templateIds: z.array(z.string().trim().min(1)).max(200).optional(),
  clientIds: z.array(z.string().trim().min(1)).max(1000).optional(),
}).strict();

const emptyToUndefined = (value) => (value === '' ? undefined : value);
const optionalEnum = (values) => z.preprocess(emptyToUndefined, z.enum(values).optional());

const complianceStateQuery = optionalEnum(['not_started', 'in_progress', 'awaiting_client', 'awaiting_partner', 'ready_to_file', 'filed', 'blocked', 'closed']);
const riskLevelQuery = optionalEnum(['low', 'medium', 'high', 'critical']);
const exceptionTypeQuery = optionalEnum(['portal_issue', 'DSC_authorisation_pending', 'client_delay', 'query_raised', 'other']);

module.exports = {
  'GET /summary': {
    query: z.object({}).passthrough(),
  },
  'GET /risk-brief': {
    query: z.object({}).passthrough(),
  },
  'GET /partner-morning': {
    query: z.object({
      assigneeXID: z.string().trim().optional(),
      clientId: z.string().trim().optional(),
      obligationType: z.string().trim().optional(),
      state: complianceStateQuery,
      dueFrom: z.string().trim().optional(),
      dueTo: z.string().trim().optional(),
      riskLevel: riskLevelQuery,
      approverXID: z.string().trim().optional(),
      exceptionType: exceptionTypeQuery,
    }).strict(),
  },
  'GET /compliance-control-room': {
    query: z.object({
      assigneeXID: z.string().trim().optional(),
      clientId: z.string().trim().optional(),
      obligationType: z.string().trim().optional(),
      state: complianceStateQuery,
      dueFrom: z.string().trim().optional(),
      dueTo: z.string().trim().optional(),
      riskLevel: riskLevelQuery,
      useDemo: z.enum(['true', 'false']).optional(),
    }).strict(),
  },
  'PATCH /compliance-control-room/:caseId/state': {
    params: z.object({ caseId: z.string().trim().min(1) }).strict(),
    body: z.object({
      nextState: z.enum(['not_started', 'in_progress', 'awaiting_client', 'awaiting_partner', 'ready_to_file', 'filed', 'blocked', 'closed']),
      blockedReason: z.string().trim().max(600).optional(),
      pendUntil: z.string().trim().optional(),
      filedAt: z.string().trim().optional(),
    }).strict(),
  },
  'GET /approval-queues': {
    query: z.object({
      view: z.enum(['my_approvals', 'awaiting_partner', 'awaiting_client_signatory', 'overdue']).optional(),
      assigneeXID: z.string().trim().optional(),
      clientId: z.string().trim().optional(),
      approvalType: optionalEnum(['internal_partner', 'client', 'authorised_signatory', 'other']),
    }).strict(),
  },
  'POST /approval-queues/:caseId/remind': {
    params: z.object({ caseId: z.string().trim().min(1) }).strict(),
    body: z.object({
      escalate: z.boolean().optional(),
    }).strict(),
  },
  'GET /compliance-templates': {
    query: z.object({
      includeInactive: z.enum(['true', 'false']).optional(),
    }).strict(),
  },
  'POST /compliance-templates': {
    body: complianceTemplateBodySchema,
  },
  'PUT /compliance-templates/:templateId': {
    params: z.object({ templateId: z.string().trim().min(1) }).strict(),
    body: complianceTemplateBodySchema.partial(),
  },
  'POST /compliance-templates/seed-samples': {
    body: z.object({}).passthrough(),
  },
  'POST /compliance-generation/preview': {
    body: generationBodySchema,
  },
  'POST /compliance-generation/run': {
    body: generationBodySchema,
  },
  'GET /onboarding-progress': {
    query: z.object({}).passthrough(),
  },
  'POST /onboarding-event': {
    body: z.object({
      eventName: z.enum(ONBOARDING_EVENT_NAMES),
      stepId: z.string().trim().max(120).optional().nullable(),
      source: z.enum(['detected', 'manual']).optional().nullable(),
      metadata: z.record(z.any()).optional(),
    }).passthrough(),
  },
};
