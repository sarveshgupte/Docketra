const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({}).passthrough(),
  },
  'POST /': {
    body: z.object({
      title: nonEmptyString,
      description: z.string().trim().optional(),
      dueDate: nonEmptyString,
      clientId: z.string().trim().optional(),
      clientName: z.string().trim().optional(),
      categoryId: z.string().trim().optional(),
      categoryName: z.string().trim().optional(),
      linkedCaseId: z.string().trim().optional(),
    }).passthrough(),
  },
  'PUT /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().optional(),
      dueDate: z.string().trim().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
      clientId: z.string().trim().optional(),
      clientName: z.string().trim().optional(),
      categoryId: z.string().trim().optional(),
      categoryName: z.string().trim().optional(),
      linkedCaseId: z.string().trim().optional(),
    }).passthrough(),
  },
  'DELETE /:id': {
    params: z.object({ id: objectIdString }),
  },
};
