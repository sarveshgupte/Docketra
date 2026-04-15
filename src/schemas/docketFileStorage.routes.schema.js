const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /dockets/:docketId/attachments': {
    params: z.object({ docketId: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'GET /dockets/:docketId/attachments': {
    params: z.object({ docketId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
  'GET /attachments/:attachmentId/download': {
    params: z.object({ attachmentId: nonEmptyString }),
    query: z.object({}).passthrough(),
  },
};
