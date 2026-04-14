const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      title: nonEmptyString,
      clientId: z.string().trim().optional(),
      value: z.coerce.number().min(0).optional(),
      stage: z.string().trim().optional(),
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
      stage: z.string().trim().min(1).optional(),
    }).passthrough(),
  },
};
