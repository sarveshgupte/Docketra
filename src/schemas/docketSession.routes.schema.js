const { z, nonEmptyString } = require('./common');

module.exports = {
  'POST /dockets/:id/session/start': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'POST /dockets/:id/session/heartbeat': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
  'POST /dockets/:id/session/end': {
    params: z.object({ id: nonEmptyString }),
    body: z.object({}).passthrough(),
  },
};
