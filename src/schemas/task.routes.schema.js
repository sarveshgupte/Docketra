const { z, nonEmptyString, objectIdString, xidString, clientIdString, paginationQuery } = require('./common');

module.exports = {
  'GET /stats': {
    query: z.object({}).passthrough(),
  },
  'GET /': {
    query: paginationQuery.and(z.object({
      status: z.string().trim().optional(),
      assignedTo: xidString.optional(),
      clientId: clientIdString.optional(),
      priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
    })),
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }),
    query: z.object({}).passthrough(),
  },
  'POST /': {
    body: z.object({
      title: nonEmptyString,
      description: z.string().trim().optional(),
      dueDate: z.string().trim().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
      priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
      assignedTo: xidString.optional(),
      clientId: clientIdString.optional(),
    }).passthrough(),
  },
  'PUT /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().optional(),
      dueDate: z.string().trim().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
      priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
      assignedTo: xidString.optional(),
      clientId: clientIdString.optional(),
    }).passthrough(),
  },
  'DELETE /:id': {
    params: z.object({ id: objectIdString }),
  },
};

