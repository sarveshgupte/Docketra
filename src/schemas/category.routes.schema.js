const { z, nonEmptyString, objectIdString, queryBoolean } = require('./common');

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
});

const checklistTemplateSchema = z.array(checklistTemplateItemSchema).optional();

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


module.exports = {
  'GET /': {
    query: z.object({
      activeOnly: queryBoolean.optional(),
    }).passthrough(),
  },
  'GET /:id': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
  },
  'POST /suggest-docket-category': {
    body: z.object({
      title: z.string().trim().max(2000).optional(),
      description: z.string().trim().max(4000).optional(),
    }).passthrough(),
  },
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
      requiresRelatedEmployeeUser: z.boolean().optional(),
    }).passthrough(),
  },
  'PUT /:id': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
    body: z.object({
      name: nonEmptyString.optional(),
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
      requiresRelatedEmployeeUser: z.boolean().optional(),
    }).passthrough(),
  },
  'PATCH /:id/status': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
    body: z.object({ isActive: z.boolean() }).passthrough(),
  },
  'DELETE /:id': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
  },
  'POST /:id/subcategories': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
    body: z.object({
      name: nonEmptyString,
      workbasketId: objectIdString,
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
      requiresRelatedEmployeeUser: z.boolean().optional(),
      deadlineRule: deadlineRuleSchema,
      checklistTemplate: checklistTemplateSchema,
      sop: subcategorySopSchema,
    }).passthrough(),
  },
  'PUT /:id/subcategories/:subcategoryId': {
    params: z.object({
      id: z.union([objectIdString, nonEmptyString]),
      subcategoryId: nonEmptyString,
    }),
    body: z.object({
      name: nonEmptyString.optional(),
      workbasketId: objectIdString.optional(),
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
      requiresRelatedEmployeeUser: z.boolean().optional(),
      deadlineRule: deadlineRuleSchema,
      checklistTemplate: checklistTemplateSchema,
      sop: subcategorySopSchema,
    }).passthrough(),
  },
  'PATCH /:id/subcategories/:subcategoryId/status': {
    params: z.object({
      id: z.union([objectIdString, nonEmptyString]),
      subcategoryId: nonEmptyString,
    }),
    body: z.object({ isActive: z.boolean() }).passthrough(),
  },
  'DELETE /:id/subcategories/:subcategoryId': {
    params: z.object({
      id: z.union([objectIdString, nonEmptyString]),
      subcategoryId: nonEmptyString,
    }),
  },
};
