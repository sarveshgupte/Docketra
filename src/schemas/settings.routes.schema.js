const { z } = require('./common');

module.exports = {
  'GET /audit': {
    query: z.object({
      category: z.enum(['roles', 'workflows', 'configs', 'integrations']).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).strict(),
  },
};
