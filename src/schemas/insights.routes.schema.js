const { z } = require('./common');

module.exports = {
  'GET /overview': {
    query: z.object({}).passthrough(),
  },
};
