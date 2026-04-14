const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email().optional(),
      phone: z.string().trim().optional(),
      source: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /': {
    query: paginationQuery.and(z.object({
      status: z.string().trim().optional(),
    })),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      status: z.enum(['new', 'contacted', 'qualified', 'lost', 'converted']).optional(),
    }).passthrough(),
  },
  'POST /:id/convert': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
};
