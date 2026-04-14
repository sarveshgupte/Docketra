const { z, nonEmptyString, paginationQuery } = require('./common');

module.exports = {
  'GET /': {
    query: paginationQuery.and(z.object({
      unread: z.enum(['true', 'false']).optional(),
    })),
  },
  'GET /all': {
    query: paginationQuery,
  },
  'PATCH /:id/read': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'POST /:id/read': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
};
