const { z, nonEmptyString, objectIdString } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({
      includeInactive: z.enum(['true', 'false']).optional(),
    }).passthrough(),
  },
  'POST /': {
    body: z.object({
      name: nonEmptyString,
      description: z.string().trim().optional(),
    }).passthrough(),
  },
  'POST /sub-types': {
    body: z.object({
      name: nonEmptyString,
      workTypeId: objectIdString,
    }).passthrough(),
  },
  'PATCH /:workTypeId/status': {
    params: z.object({ workTypeId: objectIdString }),
    body: z.object({
      isActive: z.boolean(),
    }).passthrough(),
  },
};
