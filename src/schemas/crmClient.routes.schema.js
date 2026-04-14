const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      email: z.string().trim().email().optional(),
      phone: z.string().trim().optional(),
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
};
