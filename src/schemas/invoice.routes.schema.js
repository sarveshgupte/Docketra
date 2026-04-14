const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'POST /': {
    body: z.object({
      clientId: z.string().trim().optional(),
      amount: z.coerce.number().min(0),
      description: nonEmptyString,
      dueDate: z.string().trim().optional(),
    }).passthrough(),
  },
  'GET /': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'PATCH /:id/pay': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
};
