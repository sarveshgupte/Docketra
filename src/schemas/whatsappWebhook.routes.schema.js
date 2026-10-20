const { z } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({
      'hub.mode': z.string().optional(),
      'hub.verify_token': z.string().optional(),
      'hub.challenge': z.string().optional(),
    }).passthrough(),
  },
  'POST /': {
    body: z.object({
      object: z.string().optional(),
      entry: z.array(z.any()).optional(),
    }).passthrough(),
  },
};
