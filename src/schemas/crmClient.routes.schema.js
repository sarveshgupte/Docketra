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
};
