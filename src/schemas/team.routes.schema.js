const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({}).passthrough(),
  },
  'POST /': {
    body: z.object({
      name: nonEmptyString,
    }).passthrough(),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      name: z.string().trim().min(1).optional(),
      isActive: z.boolean().optional(),
    }).passthrough(),
  },
  'POST /:id/assign-user': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      userId: nonEmptyString,
    }).passthrough(),
  },
};
