const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      unread: z.enum(['true', 'false']).optional(),
    }).passthrough(),
  },
  'GET /all': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
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
