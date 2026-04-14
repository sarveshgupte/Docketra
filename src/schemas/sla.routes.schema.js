const { z, nonEmptyString, objectIdString, queryBoolean } = require('./common');

module.exports = {
  'GET /rules': {
    query: z.object({ includeInactive: queryBoolean.optional() }).passthrough(),
  },
  'POST /rules': {
    body: z.object({
      _id: objectIdString.optional(),
      id: objectIdString.optional(),
      category: z.string().trim().optional().nullable(),
      subcategory: z.string().trim().optional().nullable(),
      workbasketId: objectIdString.optional().nullable(),
      slaHours: z.coerce.number().positive(),
      isActive: z.boolean().optional(),
    }).passthrough(),
  },
  'DELETE /rules/:ruleId': {
    params: z.object({ ruleId: objectIdString }),
    query: z.object({}).passthrough(),
    body: z.object({}).passthrough(),
  },
};
