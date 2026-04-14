const { z } = require('./common');

module.exports = {
  'GET /summary': {
    query: z.object({}).passthrough(),
  },
};
