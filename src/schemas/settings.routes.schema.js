const { z } = require('./common');

module.exports = {
  'GET /audit': {
    query: z.object({
      key: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).passthrough(),
  },
};
