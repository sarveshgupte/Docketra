const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({}).strict(),
  },
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      managerId: objectIdString.optional(),
    }).strict(),
  },
  'PATCH /:id': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      name: z.string().trim().min(1).optional(),
      isActive: z.boolean().optional(),
    }).strict(),
  },
  'POST /:id/assign-user': {
    params: z.object({ id: objectIdString }),
    body: z.object({
      userId: nonEmptyString,
    }).strict(),
  },
};
