const { z } = require('./common');

module.exports = {
  'GET /': {
    query: z.object({
      q: z.string().trim().min(1).optional(),
    }).passthrough(),
  },
};
