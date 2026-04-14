const { z, nonEmptyString, objectIdString } = require('./common');

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
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
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
