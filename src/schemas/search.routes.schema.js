const { z, nonEmptyString, xidString } = require('./common');

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
      sortBy: z.enum(['clientId', 'category', 'slaDueAt', 'slaDueDate', 'createdAt']).optional(),
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
      assigneeXID: xidString.optional(),
      status: z.union([
        z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'QC_PENDING', 'PENDING']),
        z.array(z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'QC_PENDING', 'PENDING'])),
      ]).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      search: z.string().trim().min(1).max(200).optional(),
      category: nonEmptyString.optional(),
      subcategory: nonEmptyString.optional(),
      sortBy: z.enum(['caseId', 'clientId', 'clientName', 'category', 'subcategory', 'dueDate', 'pendingUntil', 'updatedAt', 'createdAt']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    }).strict(),
  },
};
