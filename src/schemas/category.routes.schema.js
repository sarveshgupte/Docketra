const deadlineRuleSchema = z.object({
  mode: z.enum(['NONE', 'TAT_DAYS', 'FIXED_DAY_NEXT_MONTH', 'MANUAL_DATE_REQUIRED', 'EVENT_DATE_OFFSET']).optional(),
  tatDays: z.coerce.number().min(0).optional(),
  fixedDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  eventOffsetDays: z.coerce.number().optional(),
  label: z.string().trim().optional(),
  note: z.string().trim().optional(),
  allowManualOverride: z.boolean().optional(),
}).optional();

const { z, nonEmptyString, objectIdString, queryBoolean } = require('./common');

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
      deadlineRule: deadlineRuleSchema,
      deadlineRule: deadlineRuleSchema,
    }).passthrough(),
  },
  'PUT /:id': {
    params: z.object({ id: z.union([objectIdString, nonEmptyString]) }),
    body: z.object({
      name: nonEmptyString.optional(),
      description: z.string().trim().optional(),
      isActive: z.boolean().optional(),
      deadlineRule: deadlineRuleSchema,
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
      deadlineRule: deadlineRuleSchema,
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
      deadlineRule: deadlineRuleSchema,
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
