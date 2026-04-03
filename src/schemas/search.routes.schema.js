const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({
      q: z.string().trim().min(1).optional(),
    }).passthrough(),
  },
  'GET /global': {
    query: z.object({
      clientId: nonEmptyString.optional(),
      category: nonEmptyString.optional(),
      createdAtFrom: nonEmptyString.optional(),
      createdAtTo: nonEmptyString.optional(),
      slaStatus: z.enum(['overdue', 'due_soon', 'on_track']).optional(),
      sortBy: z.enum(['clientId', 'category', 'slaDueAt', 'createdAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
    }).passthrough(),
  },
  'GET /category/:categoryId': {
    params: z.object({ categoryId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
  'GET /employee/me': {
    query: z.object({
      limit: z.coerce.number().int().positive().max(100).optional(),
    }).passthrough(),
  },
};
