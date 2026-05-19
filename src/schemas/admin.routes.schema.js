const { z, nonEmptyString, objectIdString, xidString, clientIdString, queryBoolean } = require('./common');

const objectIdOrString = z.union([objectIdString, nonEmptyString]);
const deadlineRuleSchema = z.object({
  mode: z.enum(['NONE', 'TAT_DAYS', 'FIXED_DAY_NEXT_MONTH', 'MANUAL_DATE_REQUIRED', 'EVENT_DATE_OFFSET']).optional(),
  tatDays: z.coerce.number().min(0).optional(),
  fixedDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  eventOffsetDays: z.coerce.number().optional(),
  label: z.string().trim().optional(),
  note: z.string().trim().optional(),
  allowManualOverride: z.boolean().optional(),
}).optional();
const checklistTemplateItemSchema = z.object({
  id: nonEmptyString,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  required: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  defaultAssigneeXID: z.string().trim().min(1).max(120).optional(),
  dueOffsetDays: z.coerce.number().int().min(0).optional(),
}).strict();


const sopLinkSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().max(2048).regex(/^https?:\/\//i, 'URL must start with http:// or https://'),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(['portal', 'reference', 'template', 'internal', 'other']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).strict();

const subcategorySopSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(10000).optional(),
  format: z.enum(['plain_text', 'markdown']).optional(),
  lastUpdatedByXID: z.string().trim().optional(),
  links: z.array(sopLinkSchema).max(25).optional(),
}).strict().optional();

const passthroughQuery = z.object({}).passthrough();
const passthroughBody = z.object({}).passthrough();
const cmsIntakeSettingsBody = z.object({
  autoCreateClient: z.boolean(),
  autoCreateDocket: z.boolean(),
  intakeApiEnabled: z.boolean(),
  defaultCategoryId: objectIdString.nullable().optional(),
  defaultSubcategoryId: z.string().trim().min(1).max(120).nullable().optional(),
  defaultWorkbasketId: objectIdString.nullable().optional(),
  defaultPriority: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable().optional(),
  defaultAssignee: xidString.nullable().optional(),
}).strict();

const firmSettingsBody = z.object({
  firm: z.object({
    slaDefaultDays: z.coerce.number().int().min(1).max(365).optional(),
    escalationInactivityThresholdHours: z.coerce.number().int().min(1).max(24 * 365).optional(),
    workloadThreshold: z.coerce.number().int().min(1).max(1000).optional(),
    enablePerformanceView: z.boolean().optional(),
    enableEscalationView: z.boolean().optional(),
    enableBulkActions: z.boolean().optional(),
    brandLogoUrl: z.string().trim().max(2048).optional(),
    strictFirmOwnedStorage: z.boolean().optional(),
  }).strict().optional(),
  work: z.object({
    assignmentStrategy: z.enum(['manual', 'balanced']).optional(),
    statusWorkflowMode: z.enum(['flexible', 'strict']).optional(),
    autoAssignmentEnabled: z.boolean().optional(),
    highPrioritySlaDays: z.coerce.number().int().min(1).max(365).optional(),
    dueSoonWarningDays: z.coerce.number().int().min(1).max(365).optional(),
  }).strict().optional(),
}).strict();

const adminStorageUpdateBody = z.object({
  mode: z.enum(['docketra_managed', 'firm_connected']).optional(),
  provider: z.enum(['google_drive', 'onedrive']).nullable().optional(),
  google: z.object({
    rootFolderId: z.string().trim().min(1).max(512).optional(),
    driveId: z.string().trim().min(1).max(512).optional(),
    connectedEmail: z.string().trim().email().optional(),
  }).strict().optional(),
  onedrive: z.object({
    rootFolderId: z.string().trim().min(1).max(512).optional(),
    driveId: z.string().trim().min(1).max(512).optional(),
    connectedEmail: z.string().trim().email().optional(),
  }).strict().optional(),
}).strict();

module.exports = {
  'GET /stats': { query: passthroughQuery },

  'GET /clients': { query: passthroughQuery },
  'POST /clients': { body: passthroughBody },
  'PUT /clients/:clientId': {
    params: z.object({ clientId: clientIdString }),
    body: passthroughBody,
  },
  'PATCH /clients/:clientId/status': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).strict(),
  },
  'POST /clients/:clientId/change-name': {
    params: z.object({ clientId: clientIdString }),
    body: z.object({ legalName: nonEmptyString }).strict(),
  },
  'PUT /clients/:clientId/fact-sheet': {
    params: z.object({ clientId: clientIdString }),
    body: passthroughBody,
  },
  'POST /clients/:clientId/fact-sheet/files': {
    params: z.object({ clientId: clientIdString }),
    body: passthroughBody,
  },
  'DELETE /clients/:clientId/fact-sheet/files/:fileId': {
    params: z.object({ clientId: clientIdString, fileId: nonEmptyString }),
  },

  'GET /categories': {
    query: z.object({ activeOnly: queryBoolean.optional() }).passthrough(),
  },
  'POST /categories': {
    body: z.object({ name: nonEmptyString }).strict(),
  },
  'PUT /categories/:id': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ name: nonEmptyString.optional(), defaultSlaDays: z.number().int().min(0).optional() }).strict(),
  },
  'PATCH /categories/:id/status': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ isActive: z.boolean() }).strict(),
  },
  'POST /categories/:id/subcategories': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({ name: nonEmptyString, workbasketId: objectIdString, defaultSlaDays: z.number().int().min(0).optional(), deadlineRule: deadlineRuleSchema, checklistTemplate: z.array(checklistTemplateItemSchema).optional(), sop: subcategorySopSchema }).strict(),
  },
  'PUT /categories/:id/subcategories/:subcategoryId': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
    body: z.object({ name: nonEmptyString.optional(), workbasketId: objectIdString.optional(), defaultSlaDays: z.number().int().min(0).optional(), deadlineRule: deadlineRuleSchema, checklistTemplate: z.array(checklistTemplateItemSchema).optional(), sop: subcategorySopSchema }).strict(),
  },
  'PATCH /categories/:id/subcategories/:subcategoryId/status': {
    params: z.object({ id: objectIdOrString, subcategoryId: nonEmptyString }),
    body: z.object({ isActive: z.boolean() }).strict(),
  },

  'GET /hierarchy': { query: passthroughQuery },
  'GET /audit-logs': {
    query: z.object({
      userId: objectIdOrString.optional(),
      actor: objectIdOrString.optional(),
      action: nonEmptyString.optional(),
      actionType: nonEmptyString.optional(),
      module: nonEmptyString.optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targetEntity: nonEmptyString.optional(),
      severity: nonEmptyString.optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
    }).passthrough(),
  },
  'GET /users': { query: passthroughQuery },
  'POST /users': { body: z.object({ name: nonEmptyString, email: z.string().trim().email(), role: z.enum(['ADMIN','MANAGER','USER']), teamIds: z.array(objectIdOrString).min(1), department: z.string().trim().max(120).optional(), assignQcWorkbaskets: z.boolean().optional() }).strict() },
  'PUT /users/:xID/activate': {
    params: z.object({ xID: xidString }),
    body: z.object({}).strict(),
  },
  'PUT /users/:xID/deactivate': {
    params: z.object({ xID: xidString }),
    body: z.object({}).strict(),
  },
  'POST /users/:xID/resend-invite': {
    params: z.object({ xID: xidString }),
    body: z.object({}).strict(),
  },
  'PATCH /users/:xID/restrict-clients': {
    params: z.object({ xID: xidString }),
    body: z.union([
      z.object({
        accessMode: z.literal('ALL'),
      }).strict(),
      z.object({
        accessMode: z.literal('SELECTED'),
        clientIds: z.array(clientIdString).min(1),
      }).strict(),
    ]),
  },
  'PATCH /users/:xID/workbaskets': {
    params: z.object({ xID: xidString }),
    body: z.object({ teamIds: z.array(objectIdOrString).min(1), assignQcWorkbaskets: z.boolean().optional() }).strict(),
  },
  'PATCH /users/:id/hierarchy': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({
      adminId: objectIdOrString.nullish(),
      managerId: objectIdOrString.nullish(),
    }).strict(),
  },
  'GET /firm-settings': { query: passthroughQuery },
  'GET /firm-settings/activity': { query: passthroughQuery },
  'GET /settings/audit': {
    query: z.object({
      key: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'PUT /firm-settings': { body: firmSettingsBody },
  'GET /cms-intake-settings': { query: passthroughQuery },
  'PUT /cms-intake-settings': { body: cmsIntakeSettingsBody },
  'POST /cms-intake-settings/intake-api-key/regenerate': { body: z.object({}).strict() },
  'GET /workbaskets': { query: passthroughQuery },
  'POST /work-settings/default-routing': { body: z.object({}).strict() },
  'POST /workbaskets': { body: z.object({ name: nonEmptyString }).strict() },
  'PUT /workbaskets/:workbasketId': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ name: nonEmptyString }).strict(),
  },
  'PATCH /workbaskets/:workbasketId/status': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ isActive: z.boolean() }).strict(),
  },
  'POST /workbaskets/:workbasketId/qc-members': {
    params: z.object({ workbasketId: objectIdOrString }),
    body: z.object({ userId: objectIdOrString }).strict(),
  },
  'POST /users/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({}).strict(),
  },

  'GET /system-diagnostics': { query: passthroughQuery },

  'GET /cases/open': { query: passthroughQuery },
  'GET /cases/pending': { query: passthroughQuery },
  'GET /cases/filed': { query: passthroughQuery },
  'GET /cases/resolved': { query: passthroughQuery },
  'POST /cases/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({}).strict(),
  },

  'GET /storage': { query: passthroughQuery },
  'PUT /storage': { body: adminStorageUpdateBody },
  'POST /storage/disconnect': { body: z.object({}).strict() },

  'POST /clients/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({}).strict(),
  },
  'POST /tasks/:id/restore': {
    params: z.object({ id: objectIdOrString }),
    body: z.object({}).strict(),
  },
  'GET /retention-preview': { query: passthroughQuery },
};
