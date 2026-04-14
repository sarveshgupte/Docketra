const { z } = require('./common');

module.exports = {
  'GET /alerts': {
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
  'GET /summary': {
    query: z.object({}).passthrough(),
  },
};
