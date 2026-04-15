const { z, nonEmptyString } = require('./common');

module.exports = {
  'GET /:attachmentId/ai-insights': {
    params: z.object({ attachmentId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
};
