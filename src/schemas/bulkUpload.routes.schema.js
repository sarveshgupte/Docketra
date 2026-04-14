const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /:type': {
    params: z.object({ type: z.enum(['clients', 'cases', 'users']) }),
    body: z.object({}).passthrough(),
  },
  'POST /:type/confirm': {
    params: z.object({ type: z.enum(['clients', 'cases', 'users']) }),
    body: z.object({}).passthrough(),
  },
  'GET /job/:jobId': {
    params: z.object({ jobId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
};
