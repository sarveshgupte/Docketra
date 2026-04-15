const { z, paginationQuery } = require('./common');

module.exports = {
  'GET /alerts': {
    query: paginationQuery,
  },
  'GET /summary': {
    query: z.object({}).passthrough(),
  },
};
