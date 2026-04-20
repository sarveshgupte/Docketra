const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email().optional(),
      phone: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /': {
    query: paginationQuery,
  },
  'GET /:id': {
    params: z.object({ id: objectIdString }),
    query: z.object({}).passthrough(),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      name: z.string().trim().min(1).optional(),
      type: z.enum(['individual', 'company']).optional(),
      email: z.string().trim().email().nullable().optional(),
      phone: z.string().trim().nullable().optional(),
      leadSource: z.string().trim().nullable().optional(),
      notes: z.string().trim().nullable().optional(),
      status: z.enum(['lead', 'active', 'inactive']).optional(),
      tags: z.array(z.string().trim().min(1)).optional(),
    }).passthrough(),
  },
  'PATCH /:id/deactivate': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
};
