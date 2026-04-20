const { z, nonEmptyString, objectIdString, paginationQuery } = require('./common');

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
    query: paginationQuery,
  },
  'PATCH /:id/pay': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
  'PATCH /:id/paid': {
    params: z.object({ id: objectIdString }),
    body: z.object({}).passthrough(),
  },
};
