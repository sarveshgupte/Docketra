const { z } = require('./common');

module.exports = {
  'GET /metrics': {
    query: z.object({}).passthrough(),
  },
};
